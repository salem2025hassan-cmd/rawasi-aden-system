-- ============================================================================
-- مخطط قاعدة بيانات نظام رواسي عدن للهندسة والمقاولات (Rawasi Aden System)
-- متوافق مع SQLite و MySQL
-- ============================================================================

-- 1. جدول الأدوار والصلاحيات
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    permissions TEXT NOT NULL, -- JSON format or comma-separated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول المستخدمين
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    role TEXT DEFAULT 'admin',
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active', -- active, inactive
    permissions TEXT, -- JSON array or comma-separated permissions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول العملاء والحسابات المالية
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    previous_balance REAL DEFAULT 0,
    total_paid REAL DEFAULT 0,
    total_due REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'ر.ي',
    account_id INTEGER REFERENCES accounts(id),
    account_code TEXT UNIQUE,
    credit_limit REAL DEFAULT 0,
    payment_terms_days INTEGER DEFAULT 30,
    tax_number TEXT,
    commercial_reg TEXT,
    account_status TEXT DEFAULT 'نشط',
    opening_balance_date DATE,
    opening_balance_type TEXT DEFAULT 'مدين',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. جدول الموردين
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT, -- مواد بناء، حديد، أسمنت، كهرباء، تأجير معدات
    phone TEXT,
    email TEXT,
    address TEXT,
    balance REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول المشاريع
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    contract_value REAL DEFAULT 0,    -- قيمة العقد
    estimated_cost REAL DEFAULT 0,    -- القيمة التقديرية
    actual_cost REAL DEFAULT 0,       -- التكلفة الفعلية
    progress_percentage REAL DEFAULT 0, -- نسبة الإنجاز %
    expected_profit REAL DEFAULT 0,   -- الربح المتوقع
    actual_profit REAL DEFAULT 0,     -- الربح الفعلي
    status TEXT DEFAULT 'active',     -- active, completed, paused
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. جدول المواد والأصناف
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT, -- حديد، أسمنت، بلوك، خرسانة، أدوات صحية، كهربائية
    unit TEXT,     -- طن، كيس، متر مكعب، حبة
    min_quantity REAL DEFAULT 10,
    current_quantity REAL DEFAULT 0,
    unit_price REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. حركات المخزون (صرف، توريد، تحويل)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER REFERENCES items(id),
    project_id INTEGER REFERENCES projects(id),
    type TEXT NOT NULL, -- in (توريد), out (صرف لمشروع), transfer
    quantity REAL NOT NULL,
    unit_price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    reference_no TEXT,
    recipient TEXT,     -- المستلم أو المهندس المشرف
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. فواتير المشتريات
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    supplier_id INTEGER REFERENCES suppliers(id),
    project_id INTEGER REFERENCES projects(id),
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'pending', -- paid, partial, pending
    payment_method TEXT DEFAULT 'نقدي',    -- نقدي، شيك، تحويل بنكي
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. جدول المصروفات (سندات الصرف)
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT UNIQUE,
    expense_type TEXT NOT NULL, -- مواد بناء، أجور عمالة، معدات، نقل ومواصلات، مصروفات إدارية، أخرى
    project_id INTEGER REFERENCES projects(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'نقدي', -- نقدي، تحويل بنكي، شيك
    recipient TEXT,
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. جدول الفواتير والمستخلصات
CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no TEXT UNIQUE,
    bill_type TEXT DEFAULT 'مستخلص', -- مستخلص جاري، مستخلص ختامي، فاتورة أعمال
    project_id INTEGER REFERENCES projects(id),
    client_id INTEGER REFERENCES clients(id),
    amount REAL NOT NULL,           -- قيمة المستخلص الإجمالية
    deduction REAL DEFAULT 0,       -- استقطاعات (دفعة مقدمة / ضمان)
    net_amount REAL NOT NULL,       -- صافي المستخلص المستحق
    status TEXT DEFAULT 'معتمد',     -- مسودة، معتمد، محصل جزئي، محصل كامل
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. جدول المدفوعات والتحصيلات (سندات القبض والصرف)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_no TEXT UNIQUE,
    type TEXT NOT NULL, -- 'قبض' أو 'صرف'
    client_id INTEGER REFERENCES clients(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    project_id INTEGER REFERENCES projects(id),
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT 'نقدي', -- نقدي، تحويل بنكي، شيك
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. جدول النثريات والعهد
CREATE TABLE IF NOT EXISTS custodies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- صرف عهدة، تصفية عهدة، نثريات
    employee_name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    spent_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. جدول حركة الصندوق والبنك
CREATE TABLE IF NOT EXISTS cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    previous_balance REAL DEFAULT 0,
    cash_in REAL DEFAULT 0,
    cash_out REAL DEFAULT 0,
    withdrawals REAL DEFAULT 0,
    current_balance REAL DEFAULT 0,
    date DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. دليل الحسابات
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- أصول، خصوم، حقوق ملكية، إيرادات، مصروفات
    parent_id INTEGER REFERENCES accounts(id),
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. القيود اليومية العامة
CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_no TEXT UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    reference_type TEXT, -- سند قبض، سند صرف، فاتورة، مستخلص
    reference_id INTEGER,
    total_debit REAL DEFAULT 0,
    total_credit REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. سطور القيود اليومية
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id),
    project_id INTEGER REFERENCES projects(id),
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0,
    notes TEXT
);

-- 17. إعدادات النظام ومعلومات الشركة
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);


-- 13. عروض الأسعار وبنودها
CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_no TEXT UNIQUE,
    client_id INTEGER REFERENCES clients(id),
    project_id INTEGER REFERENCES projects(id),
    date DATE NOT NULL,
    valid_until DATE,
    subtotal REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'ر.ي',
    status TEXT DEFAULT 'مسودة',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    unit TEXT DEFAULT 'وحدة',
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
);

-- 18. جداول الكميات والمواصفات (BOQ)
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

-- 19. عقود المشاريع
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

-- 20. فواتير المبيعات والأعمال (نقد وآجل مع الأرشفة)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT UNIQUE,
    invoice_type TEXT NOT NULL DEFAULT 'نقد', -- 'نقد' أو 'آجل'
    client_id INTEGER REFERENCES clients(id),
    client_name TEXT,
    project_id INTEGER REFERENCES projects(id),
    project_name TEXT,                        -- اسم المشروع المخصص أو المكتوب يدوياً
    attachment TEXT,                          -- صورة الفاتورة الممسوحة بالإسكانر (Base64 أو رابط)
    attachment_name TEXT,                     -- اسم ملف الفاتورة الممسوحة
    date DATE NOT NULL,
    due_date DATE,
    subtotal REAL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    remaining_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'نقدي',       -- نقدي، تحويل بنكي، شيك، آجل
    currency TEXT DEFAULT 'ر.ي',
    status TEXT DEFAULT 'مدفوعة',             -- 'مدفوعة' (للنقد)، 'مستحقة' (للآجل)، 'مسودة'
    is_archived INTEGER DEFAULT 0,           -- 0: نشطة، 1: مؤرشفة
    archived_at DATETIME,
    notes TEXT,
    terms TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 21. بنود الفاتورة
CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_order INTEGER DEFAULT 1,
    description TEXT NOT NULL,
    unit TEXT DEFAULT 'وحدة',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    completion_percentage REAL DEFAULT 100, -- نسبة الإنجاز %
    total REAL NOT NULL DEFAULT 0,
    notes TEXT
);


