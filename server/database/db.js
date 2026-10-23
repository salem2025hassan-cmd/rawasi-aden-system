const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const connectionManager = require('./connectionManager');

const dbDir = __dirname;
const dbPath = path.join(dbDir, 'rawasi_aden.db');
const schemaPath = path.join(dbDir, 'schema.sql');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = new DatabaseSync(dbPath);

// Enable foreign keys & WAL mode for high performance
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema if not initialized
function initSchema() {
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }

  // Safe migration for permissions column in users table
  try {
    const cols = db.prepare("PRAGMA table_info(users)").all();
    const hasPerm = cols.some(c => c.name === 'permissions');
    if (!hasPerm) {
      db.exec("ALTER TABLE users ADD COLUMN permissions TEXT;");
    }
  } catch (e) {
    console.warn('Migration note (users.permissions):', e.message);
  }

  // Safe migration for currency column in financial tables
  const tablesWithCurrency = ['payments', 'expenses', 'custodies', 'projects', 'items', 'bills', 'clients', 'suppliers', 'cash_movements', 'purchases'];
  tablesWithCurrency.forEach(tableName => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
      const hasCurrency = cols.some(c => c.name === 'currency');
      if (!hasCurrency) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN currency TEXT DEFAULT 'ر.ي';`);
      }
    } catch (e) {
      console.warn(`Migration note (${tableName}.currency):`, e.message);
    }
  });
  // Safe migration for recipient & reference_no in payments & expenses
  try {
    const pCols = db.prepare("PRAGMA table_info(payments)").all();
    if (!pCols.some(c => c.name === 'recipient')) {
      db.exec("ALTER TABLE payments ADD COLUMN recipient TEXT;");
    }
    if (!pCols.some(c => c.name === 'reference_no')) {
      db.exec("ALTER TABLE payments ADD COLUMN reference_no TEXT;");
    }
  } catch (e) {
    console.warn('Migration note (payments extras):', e.message);
  }

  try {
    const eCols = db.prepare("PRAGMA table_info(expenses)").all();
    if (!eCols.some(c => c.name === 'reference_no')) {
      db.exec("ALTER TABLE expenses ADD COLUMN reference_no TEXT;");
    }
  } catch (e) {
    console.warn('Migration note (expenses extras):', e.message);
  }

  // إنشاء جداول عروض الأسعار عند تحديث النسخ القديمة بأمان
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, quotation_no TEXT UNIQUE, client_id INTEGER REFERENCES clients(id), project_id INTEGER REFERENCES projects(id), date DATE NOT NULL, valid_until DATE, subtotal REAL DEFAULT 0, total_amount REAL DEFAULT 0, currency TEXT DEFAULT 'ر.ي', status TEXT DEFAULT 'مسودة', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    db.exec(`CREATE TABLE IF NOT EXISTS quotation_items (id INTEGER PRIMARY KEY AUTOINCREMENT, quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE, description TEXT NOT NULL, unit TEXT DEFAULT 'وحدة', quantity REAL NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0);`);
  } catch (e) { console.warn('Migration note (quotations):', e.message); }

  // إنشاء جداول جدول الكميات BOQ وعقود المشاريع
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS boq_projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boq_no TEXT UNIQUE,
        project_id INTEGER REFERENCES projects(id),
        client_id INTEGER REFERENCES clients(id),
        title TEXT NOT NULL,
        date DATE NOT NULL,
        currency TEXT DEFAULT 'ر.ي',
        total_amount REAL DEFAULT 0,
        executed_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'نشط',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS boq_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boq_id INTEGER NOT NULL REFERENCES boq_projects(id) ON DELETE CASCADE,
        item_order INTEGER DEFAULT 1,
        category TEXT DEFAULT 'عام',
        description TEXT NOT NULL,
        unit TEXT DEFAULT 'وحدة',
        quantity REAL NOT NULL DEFAULT 0,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        executed_qty REAL DEFAULT 0,
        notes TEXT
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_no TEXT UNIQUE,
        project_id INTEGER REFERENCES projects(id),
        client_id INTEGER REFERENCES clients(id),
        title TEXT NOT NULL,
        first_party TEXT DEFAULT 'شركة رواسي عدن للهندسة والمقاولات',
        first_party_rep TEXT DEFAULT 'المدير العام',
        second_party TEXT,
        second_party_rep TEXT,
        second_party_phone TEXT,
        second_party_address TEXT,
        project_location TEXT,
        contract_date DATE NOT NULL,
        start_date DATE,
        completion_date DATE,
        duration_days INTEGER DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'ر.ي',
        advance_payment REAL DEFAULT 0,
        retention_percent REAL DEFAULT 5,
        payment_terms TEXT,
        conditions TEXT,
        status TEXT DEFAULT 'ساري',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('Migration note (boq & contracts):', e.message);
  }

  // إنشاء جداول الفواتير والأرشفة بأمان
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no TEXT UNIQUE,
        invoice_type TEXT NOT NULL DEFAULT 'نقد',
        client_id INTEGER REFERENCES clients(id),
        client_name TEXT,
        project_id INTEGER REFERENCES projects(id),
        date DATE NOT NULL,
        due_date DATE,
        subtotal REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'نقدي',
        currency TEXT DEFAULT 'ر.ي',
        status TEXT DEFAULT 'مدفوعة',
        is_archived INTEGER DEFAULT 0,
        archived_at DATETIME,
        notes TEXT,
        terms TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        item_order INTEGER DEFAULT 1,
        description TEXT NOT NULL,
        unit TEXT DEFAULT 'وحدة',
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        completion_percentage REAL DEFAULT 100,
        total REAL NOT NULL DEFAULT 0,
        notes TEXT
      );
    `);

    // إضافة وتأكيد حقول فواتير السكانر والمشروع المخصص
    try {
      const invCols = db.prepare("PRAGMA table_info(invoices)").all().map(c => c.name);
      if (!invCols.includes('project_name')) db.exec("ALTER TABLE invoices ADD COLUMN project_name TEXT");
      if (!invCols.includes('source')) db.exec("ALTER TABLE invoices ADD COLUMN source TEXT DEFAULT 'نظام'");
      if (!invCols.includes('category')) db.exec("ALTER TABLE invoices ADD COLUMN category TEXT DEFAULT 'مبيعات'");
      if (!invCols.includes('attachment_url')) db.exec("ALTER TABLE invoices ADD COLUMN attachment_url TEXT");
      if (!invCols.includes('attachment_name')) db.exec("ALTER TABLE invoices ADD COLUMN attachment_name TEXT");
      if (!invCols.includes('attachment_type')) db.exec("ALTER TABLE invoices ADD COLUMN attachment_type TEXT");
      if (!invCols.includes('physical_archive_no')) db.exec("ALTER TABLE invoices ADD COLUMN physical_archive_no TEXT");
    } catch (colErr) {
      console.warn('Migration note (invoices columns check):', colErr.message);
    }

    // إضافة وتأكيد حقل نسبة الإنجاز في بنود الفواتير
    try {
      const itemCols = db.prepare("PRAGMA table_info(invoice_items)").all().map(c => c.name);
      if (!itemCols.includes('completion_percentage')) {
        db.exec("ALTER TABLE invoice_items ADD COLUMN completion_percentage REAL DEFAULT 100;");
      }
    } catch (itemErr) {
      console.warn('Migration note (invoice_items columns check):', itemErr.message);
    }
  } catch (e) {
    console.warn('Migration note (invoices):', e.message);
  }

  // إضافة وتأكيد الحقول المحاسبية لجدول العملاء (خدمات فتح الحسابات والربط المالي الشجري)
  try {
    const clientCols = db.prepare("PRAGMA table_info(clients)").all().map(c => c.name);
    if (!clientCols.includes('account_id')) db.exec("ALTER TABLE clients ADD COLUMN account_id INTEGER REFERENCES accounts(id);");
    if (!clientCols.includes('account_code')) db.exec("ALTER TABLE clients ADD COLUMN account_code TEXT;");
    if (!clientCols.includes('credit_limit')) db.exec("ALTER TABLE clients ADD COLUMN credit_limit REAL DEFAULT 0;");
    if (!clientCols.includes('payment_terms_days')) db.exec("ALTER TABLE clients ADD COLUMN payment_terms_days INTEGER DEFAULT 30;");
    if (!clientCols.includes('tax_number')) db.exec("ALTER TABLE clients ADD COLUMN tax_number TEXT;");
    if (!clientCols.includes('commercial_reg')) db.exec("ALTER TABLE clients ADD COLUMN commercial_reg TEXT;");
    if (!clientCols.includes('account_status')) db.exec("ALTER TABLE clients ADD COLUMN account_status TEXT DEFAULT 'نشط';");
    if (!clientCols.includes('opening_balance_date')) db.exec("ALTER TABLE clients ADD COLUMN opening_balance_date DATE;");
    if (!clientCols.includes('opening_balance_type')) db.exec("ALTER TABLE clients ADD COLUMN opening_balance_type TEXT DEFAULT 'مدين';");

    // التأكد من وجود حساب المراقبة الرئيسي للعملاء (112 - العملاء / الذمم المدينة)
    let parentAcc = db.prepare("SELECT id FROM accounts WHERE code = '112'").get();
    if (!parentAcc) {
      const insParent = db.prepare("INSERT INTO accounts (code, name, type, parent_id, balance) VALUES ('112', 'العملاء (الذمم المدينة)', 'أصول', 2, 0)");
      const res = insParent.run();
      parentAcc = { id: res.lastInsertRowid };
    }

    // تهيئة وربط الحسابات المحاسبية الفرعية لجميع العملاء غير المربوطين تلقائياً (Auto-provisioning)
    const clientsWithoutAcc = db.prepare("SELECT * FROM clients WHERE account_id IS NULL OR account_code IS NULL").all();
    if (clientsWithoutAcc.length > 0) {
      clientsWithoutAcc.forEach((cl, idx) => {
        const existingCodes = db.prepare("SELECT code FROM accounts WHERE code LIKE '112%' AND LENGTH(code) >= 6 ORDER BY code DESC").all();
        let nextSeq = 1;
        if (existingCodes.length > 0) {
          const maxNum = Math.max(...existingCodes.map(row => {
            const num = parseInt(row.code.replace('112', ''), 10);
            return isNaN(num) ? 0 : num;
          }));
          nextSeq = maxNum + 1;
        } else {
          nextSeq = idx + 1;
        }

        const subAccCode = `112${String(nextSeq).padStart(3, '0')}`;
        const subAccName = `عميل: ${cl.name}`;
        const bal = Number(cl.current_balance) || Number(cl.previous_balance) || 0;

        // إدراج الحساب الفرعي في دليل الحسابات الشجري
        const insSub = db.prepare("INSERT INTO accounts (code, name, type, parent_id, balance) VALUES (?, ?, 'أصول', ?, ?)");
        const subRes = insSub.run(subAccCode, subAccName, parentAcc.id, bal);

        // ربط العميل بالحساب المحاسبي الجديد
        db.prepare(`
          UPDATE clients SET 
            account_id = ?, 
            account_code = ?,
            credit_limit = COALESCE(credit_limit, 500000),
            payment_terms_days = COALESCE(payment_terms_days, 30),
            account_status = COALESCE(account_status, 'نشط')
          WHERE id = ?
        `).run(subRes.lastInsertRowid, subAccCode, cl.id);
      });
    }

    // تحديث رصيد حساب العملاء الرئيسي (112) ليطابق مجموع أرصدة حسابات العملاء بدقة محاسبية
    db.exec(`
      UPDATE accounts 
      SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
      WHERE code = '112';
    `);
  } catch (clientAccErr) {
    console.warn('Migration note (clients accounting provisioning):', clientAccErr.message);
  }

  // تهيئة إعدادات الاتصال وفحص ما قبل التشغيل
  connectionManager.initFromDb(db);
  // فحص أولي للاتصال السحابي بالخلفية
  connectionManager.verifyOnlineConnection().then(status => {
    console.log(`📡 [Rawasi Aden DB] Status: ${status.isOnline ? '🟢 ONLINE (سحابي متصل)' : '🟠 OFFLINE (محلي نشط)'} - ${status.message}`);
  }).catch(e => {
    console.warn('Startup connection check note:', e.message);
  });
}

initSchema();

/**
 * Run a query returning all rows
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Run a query returning a single row
 */
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

/**
 * Execute INSERT, UPDATE, DELETE returning { changes, lastInsertRowid }
 */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Execute raw SQL script
 */
function exec(sql) {
  return db.exec(sql);
}

/**
 * Backup the database file
 */
function backupDatabase() {
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup_rawasi_${timestamp}.db`;
  const backupFilePath = path.join(backupsDir, backupFileName);
  fs.copyFileSync(dbPath, backupFilePath);
  return { fileName: backupFileName, filePath: backupFilePath };
}

/**
 * Restore database from a file path or Buffer
 */
function restoreDatabase(sourceFilePathOrBuffer) {
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // 1. Create a safety backup of the current database before restoring
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safetyBackupPath = path.join(backupsDir, `safety_before_restore_${timestamp}.db`);
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, safetyBackupPath);
  }

  try {
    // 2. Close current database instance
    if (db) {
      try {
        db.close();
      } catch (e) {
        console.warn('DB close note:', e.message);
      }
    }

    // 3. Remove WAL/SHM auxiliary files if present
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // 4. Overwrite active database file
    if (Buffer.isBuffer(sourceFilePathOrBuffer)) {
      fs.writeFileSync(dbPath, sourceFilePathOrBuffer);
    } else if (typeof sourceFilePathOrBuffer === 'string') {
      fs.copyFileSync(sourceFilePathOrBuffer, dbPath);
    } else {
      throw new Error('بيانات النسخة الاحتياطية غير صالحة');
    }

    // 5. Reopen database connection
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');

    // 6. Verify restored database tables
    const testStmt = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tables = testStmt.all();
    if (!tables || tables.length === 0) {
      throw new Error('الملف المستعاد لا يحتوي على جداول صالحة لنظام رواسي عدن');
    }

    return {
      success: true,
      message: 'تمت استعادة قاعدة البيانات بنجاح',
      tablesCount: tables.length,
      safetyBackup: path.basename(safetyBackupPath)
    };
  } catch (err) {
    console.error('Error during database restore:', err);

    // Rollback to safety backup
    try {
      if (fs.existsSync(safetyBackupPath)) {
        fs.copyFileSync(safetyBackupPath, dbPath);
        db = new DatabaseSync(dbPath);
        db.exec('PRAGMA foreign_keys = ON;');
      }
    } catch (rbErr) {
      console.error('Failed to rollback safety backup:', rbErr);
    }

    throw new Error('فشلت عملية استعادة النسخة الاحتياطية: ' + err.message);
  }
}

/**
 * List all backup files
 */
function listBackups() {
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
    return [];
  }
  const files = fs.readdirSync(backupsDir);
  const backups = [];
  files.forEach(file => {
    if (file.endsWith('.db') || file.endsWith('.sqlite')) {
      const filePath = path.join(backupsDir, file);
      const stat = fs.statSync(filePath);
      backups.push({
        fileName: file,
        size: stat.size,
        createdAt: stat.mtime
      });
    }
  });
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * إنشاء نسخة احتياطية مخصصة وفورية عند تسجيل الخروج
 * لحفظ وتجميد أحدث تعديلات المشروع بدقة
 */
function createLogoutBackup(username = 'unknown', meta = {}) {
  const backupsDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // 1. مزامنة وتفريغ الذاكرة المؤقتة (WAL Checkpoint) لضمان كتابة كافة التعديلات على القرص
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    console.warn('WAL checkpoint note:', e.message);
  }

  // 2. توليد اسم ملف فريد ومعبر
  const safeUser = String(username || 'user').replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_');
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const backupFileName = `backup_logout_${safeUser}_${dateStr}.db`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  // 3. نسخ ملف قاعدة البيانات فورياً
  fs.copyFileSync(dbPath, backupFilePath);
  const stat = fs.statSync(backupFilePath);

  // 4. تسجيل البيانات الوصفية في ملف المانيفست logout_backups_manifest.json
  const manifestPath = path.join(backupsDir, 'logout_backups_manifest.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!Array.isArray(manifest)) manifest = [];
    } catch {
      manifest = [];
    }
  }

  const backupItem = {
    fileName: backupFileName,
    filePath: backupFilePath,
    username: username || 'مستخدم',
    timestamp: now.toISOString(),
    displayTime: now.toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'medium' }),
    size: stat.size,
    mode: meta.mode || (connectionManager.isOnline ? 'online' : 'offline'),
    notes: meta.notes || 'نسخة تلقائية تم إنشاؤها فور تسجيل الخروج لحفظ أحدث التعديلات'
  };

  manifest.unshift(backupItem);
  // الاحتفاظ بأحدث 50 نسخة خروج تلقائية
  if (manifest.length > 50) manifest = manifest.slice(0, 50);

  try {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to write logout_backups_manifest.json:', err.message);
  }

  // 5. حفظ البيانات في جدول settings لسرعة الرجوع إليها
  try {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run('last_logout_backup', JSON.stringify(backupItem));
  } catch (e) {
    console.warn('Note updating last_logout_backup setting:', e.message);
  }

  return backupItem;
}

/**
 * جلب قائمة نسخ الخروج الاحتياطية
 */
function listLogoutBackups() {
  const backupsDir = path.join(__dirname, 'backups');
  const manifestPath = path.join(backupsDir, 'logout_backups_manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(list)) {
        return list.filter(item => fs.existsSync(item.filePath || path.join(backupsDir, item.fileName)));
      }
    } catch {
      // fallback to folder scan
    }
  }

  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir);
  const list = [];
  files.forEach(f => {
    if (f.startsWith('backup_logout_') && (f.endsWith('.db') || f.endsWith('.sqlite'))) {
      const p = path.join(backupsDir, f);
      const stat = fs.statSync(p);
      const parts = f.split('_');
      list.push({
        fileName: f,
        filePath: p,
        username: parts[2] || 'مستخدم',
        timestamp: stat.mtime.toISOString(),
        displayTime: new Date(stat.mtime).toLocaleString('ar-YE'),
        size: stat.size,
        mode: 'auto',
        notes: 'نسخة تسجيل خروج محفوظة'
      });
    }
  });

  return list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  backupDatabase,
  restoreDatabase,
  listBackups,
  createLogoutBackup,
  listLogoutBackups,
  connectionManager,
  dbPath
};

