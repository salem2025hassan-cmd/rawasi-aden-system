const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, connectionManager } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'rawasi_aden_secret_key_2024';

function getRoleDefaultPermissions(role) {
  switch (role) {
    case 'admin':
      return [
        'dashboard:view',
        'projects:view', 'projects:manage', 'projects:print',
        'revenues:view', 'revenues:create', 'revenues:print',
        'expenses:view', 'expenses:create',
        'custody:view', 'custody:manage',
        'clients:view', 'clients:manage', 'clients:statement',
        'suppliers:view', 'suppliers:manage', 'suppliers:statement',
        'inventory:view', 'inventory:manage', 'inventory:issue',
        'cash:view',
        'reports:view',
        'settings:company', 'settings:users', 'settings:backup'
      ];
    case 'accountant':
      return [
        'dashboard:view',
        'revenues:view', 'revenues:create', 'revenues:print',
        'expenses:view', 'expenses:create',
        'custody:view', 'custody:manage',
        'clients:view', 'clients:manage', 'clients:statement',
        'suppliers:view', 'suppliers:manage', 'suppliers:statement',
        'cash:view',
        'reports:view'
      ];
    case 'project_manager':
      return [
        'dashboard:view',
        'projects:view', 'projects:manage', 'projects:print',
        'expenses:view', 'expenses:create',
        'custody:view',
        'inventory:view', 'inventory:issue',
        'reports:view'
      ];
    case 'storekeeper':
      return [
        'inventory:view', 'inventory:manage', 'inventory:issue',
        'projects:view'
      ];
    default:
      return ['dashboard:view'];
  }
}

function parseUserPermissions(user) {
  let permissionsList = [];
  if (user.permissions) {
    try {
      permissionsList = typeof user.permissions === 'string' && (user.permissions.startsWith('[') || user.permissions.startsWith('{'))
        ? JSON.parse(user.permissions)
        : user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      permissionsList = user.permissions.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (!permissionsList || permissionsList.length === 0) {
    permissionsList = getRoleDefaultPermissions(user.role);
  }

  return permissionsList;
}

// تسجيل الدخول (Login) مع التحقق من الاتصال بقاعدة البيانات
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const cleanUsername = String(username).trim();
    const user = get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'هذا الحساب معطل حالياً، يرجى مراجعة إدارة النظام' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const permissionsList = parseUserPermissions(user);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // التحقق من حالة الاتصال بقاعدة البيانات عند تسجيل الدخول
    let dbStatus = connectionManager ? connectionManager.getStatus() : { isOnline: false, mode: 'offline' };
    if (connectionManager && connectionManager.mode !== 'offline_only' && connectionManager.onlineUrl) {
      try {
        await connectionManager.verifyOnlineConnection(null, 2500);
        dbStatus = connectionManager.getStatus();
      } catch (e) {
        console.warn('Login connection check note:', e.message);
      }
    }

    res.json({
      success: true,
      message: `مرحباً بك ${user.full_name}! تم تسجيل الدخول بنجاح`,
      token,
      dbStatus,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        email: user.email,
        phone: user.phone,
        status: user.status,
        permissions: permissionsList
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم أثناء تسجيل الدخول', error: err.message });
  }
});

// التحقق من صحة الجلسة (Verify Token)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'جلسة غير صالحة' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = get('SELECT id, username, full_name, role, email, phone, status, permissions FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'هذا الحساب معطل حالياً' });
    }

    const permissionsList = parseUserPermissions(user);

    res.json({
      success: true,
      user: {
        ...user,
        permissions: permissionsList
      }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'انتهت صلاحية الجلسة' });
  }
});

module.exports = router;
