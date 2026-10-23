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

