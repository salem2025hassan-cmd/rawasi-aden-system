const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { query, run, get, backupDatabase, restoreDatabase, listBackups, createLogoutBackup, listLogoutBackups, connectionManager, db, dbPath } = require('../database/db');

// جلب إعدادات الشركة
router.get('/', (req, res) => {
  try {
    const settingsRows = query('SELECT * FROM settings');
    const settingsObj = {};
    settingsRows.forEach(row => {
      settingsObj[row.key] = row.value;
    });
    res.json({ success: true, data: settingsObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الإعدادات', error: err.message });
  }
});

// تحديث الإعدادات
router.post('/', (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      run(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [key, String(value)]);
    }
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حفظ الإعدادات', error: err.message });
  }
});

// جلب قائمة النسخ الاحتياطية المحفوظة محلياً
router.get('/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ success: true, data: backups });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب قائمة النسخ الاحتياطية', error: err.message });
  }
});

// إنشاء وتنزيل نسخة احتياطية من قاعدة البيانات
router.get('/backup', (req, res) => {
  try {
    const backup = backupDatabase();
    res.download(backup.filePath, backup.fileName, (err) => {
      if (err) {
        console.error('Error sending backup file:', err);
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إنشاء النسخة الاحتياطية', error: err.message });
  }
});

// استعادة نسخة احتياطية من ملف محلي على السيرفر
router.post('/restore-local', (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ success: false, message: 'اسم ملف النسخة الاحتياطية مطلوب' });
    }
    const backupsDir = path.join(__dirname, '..', 'database', 'backups');
    const filePath = path.join(backupsDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'ملف النسخة الاحتياطية غير موجود على الخادم' });
    }
    const result = restoreDatabase(filePath);
    res.json({
      success: true,
      message: `تمت استعادة النسخة الاحتياطية (${fileName}) بنجاح`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, error: err.message });
  }
});

// استعادة نسخة احتياطية مرفوعة (Raw Binary)
router.post('/restore-upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ success: false, message: 'لم يتم استلام أي بيانات لملف النسخة الاحتياطية' });
    }
    const result = restoreDatabase(req.body);
    res.json({
      success: true,
      message: 'تمت استعادة قاعدة البيانات بنجاح من الملف المرفوع وتأكيد سلامة الجداول',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, error: err.message });
  }
});

// =================== مسارات الاتصال السحابي والمحلي (Online/Offline) ===================

// جلب حالة الاتصال الحالية بقاعدة البيانات
router.get('/db-status', async (req, res) => {
  try {
    const status = connectionManager.getStatus();
    const lastBackupRow = get ? get("SELECT value FROM settings WHERE key = 'last_logout_backup'") : null;
    let lastLogoutBackup = null;
    if (lastBackupRow && lastBackupRow.value) {
      try { lastLogoutBackup = JSON.parse(lastBackupRow.value); } catch {}
    }
    res.json({
      success: true,
      data: {
        ...status,
        lastLogoutBackup
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في قراءة حالة الاتصال', error: err.message });
  }
});

// فحص واختبار الاتصال بالسيرفر السحابي
router.post('/test-online-db', async (req, res) => {
  try {
    const { url } = req.body;
    const testResult = await connectionManager.verifyOnlineConnection(url);
    res.json({
      success: testResult.success,
      data: testResult
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في فحص الاتصال', error: err.message });
  }
});

// حفظ وتحديث إعدادات الاتصال السحابي
router.post('/update-db-config', async (req, res) => {
  try {
    const { mode, onlineUrl, apiKey } = req.body;
    connectionManager.updateConfig(db, { mode, onlineUrl, apiKey });
    const verifyResult = await connectionManager.verifyOnlineConnection();
    res.json({
      success: true,
      message: 'تم حفظ إعدادات الاتصال بنجاح',
      data: {
        ...connectionManager.getStatus(),
        verifyResult
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حفظ إعدادات الاتصال', error: err.message });
  }
});

// =================== مسارات النسخ الاحتياطي التلقائي عند تسجيل الخروج ===================

// إنشاء نسخة احتياطية فورية عند تسجيل الخروج
router.post('/auto-backup-logout', (req, res) => {
  try {
    const { username, mode, notes } = req.body;
    const backupItem = createLogoutBackup(username, { mode, notes });
    res.json({
      success: true,
      message: 'تم حفظ نسخة احتياطية بنجاح عند تسجيل الخروج وتجميد كافة التعديلات الأخيرة',
      data: backupItem
    });
  } catch (err) {
    console.error('Error creating logout backup:', err);
    res.status(500).json({ success: false, message: 'تعذر إنشاء نسخة الخروج الاحتياطية: ' + err.message });
  }
});

// جلب قائمة نسخ تسجيل الخروج المحفوظة
router.get('/logout-backups', (req, res) => {
  try {
    const backups = listLogoutBackups();
    res.json({ success: true, data: backups });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب قائمة نسخ الخروج', error: err.message });
  }
});

module.exports = router;

