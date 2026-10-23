const bcrypt = require('bcryptjs');
const { db, query, run } = require('./db');

function seedDatabase() {
  console.log('🚀 بدء بذر البيانات الأولية لنظام رواسي عدن...');

  // 1. Roles
  db.exec(`
    DELETE FROM roles;
    DELETE FROM users;
    DELETE FROM settings;
    DELETE FROM clients;
    DELETE FROM suppliers;
    DELETE FROM projects;
    DELETE FROM items;
    DELETE FROM expenses;
    DELETE FROM payments;
    DELETE FROM custodies;
    DELETE FROM cash_movements;
    DELETE FROM accounts;
    DELETE FROM bills;
  `);

  const insertRole = db.prepare('INSERT INTO roles (id, name, display_name, permissions) VALUES (?, ?, ?, ?)');
  insertRole.run(1, 'admin', 'المدير العام', 'all');
  insertRole.run(2, 'accountant', 'المحاسب المالي', 'accounting,reports,payments,billing');
  insertRole.run(3, 'project_manager', 'مدير المشاريع', 'projects,inventory,expenses');
  insertRole.run(4, 'storekeeper', 'أمين المخزن', 'inventory,items');

  // 2. Users
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const accountantHash = bcrypt.hashSync('account123', salt);

  const insertUser = db.prepare('INSERT INTO users (username, password_hash, full_name, role_id, role, email, phone, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertUser.run('admin', adminHash, 'المدير العام', 1, 'admin', 'aalwi@engineer.com', '773413937', 'active');
  insertUser.run('accountant', accountantHash, 'المحاسب المالي', 2, 'accountant', 'accountant@rawasiaden.com', '773413937', 'active');

  // 3. Settings
  const insertSetting = db.prepare('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)');
  insertSetting.run('company_name', 'رواسي عدن للهندسة والمقاولات', 'اسم الشركة بالعربي');
  insertSetting.run('company_name_en', 'Rawasi Aden for Engineering & Contracting', 'اسم الشركة بالإنجليزي');
  insertSetting.run('slogan', 'نبني الحاضر لنستثمر المستقبل', 'شعار الشركة اللفظي');
  insertSetting.run('phone1', '773413937', 'رقم الهاتف الرئيسي');
  insertSetting.run('phone2', '773413937', 'رقم الهاتف الإضافي');
  insertSetting.run('email', 'aalwi@engineer.com', 'البريد الإلكتروني');
  insertSetting.run('address', 'عدن - الجمهورية اليمنية', 'عنوان المركز الرئيسي');
  insertSetting.run('currency', 'ر.ي', 'العملة الافتراضية');

  // 4. Clients
  const insertClient = db.prepare('INSERT INTO clients (name, company, phone, email, address, previous_balance, total_paid, total_due, current_balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertClient.run('شركة البناء الحديثة', 'شركة البناء الحديثة للتطوير العقاري', '771122334', 'binaa@info.com', 'عدن - المنصورة', 120000, 550000, 320000, 190000, 'عميل رئيسي للمشاريع السكنية');
  insertClient.run('أحمد عبدالله', 'مجموعة عبدالله للتجارة', '772233445', 'ahmed@aden.com', 'عدن - خور مكسر', 50000, 250000, 80000, 80000, 'مالك فيلا سكنية خاصة');
  insertClient.run('مؤسسة التربية', 'مؤسسة التربية والتعليم الأهلية', '773344556', 'tarbiah@aden.edu', 'عدن - المعلا', 0, 800000, 50000, 50000, 'مشروع مدرسة أهلية');
  insertClient.run('شركة الاستثمار', 'الشركة اليمنية للاستثمار العقاري', '774455667', 'invest@yemen.com', 'عدن - كريتر', 0, 400000, 0, 0, 'مستثمر مشروع تجاري');

  // 5. Suppliers
  const insertSupplier = db.prepare('INSERT INTO suppliers (name, category, phone, email, address, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertSupplier.run('مؤسسة مواد البناء', 'مواد بناء وأسمنت', '775566778', 'binaamaterials@aden.com', 'عدن - الشيخ عثمان', 120000, 'المورد المعتمد للأسمنت والمواد');
  insertSupplier.run('شركة اليمامة للحديد', 'حديد تسليح', '776677889', 'yamama_steel@aden.com', 'عدن - المنطقة الحرة', 65000, 'مورد حديد التسليح');
  insertSupplier.run('مؤسسة الأمل للخرسانة', 'خرسانة جاهزة ومعدات', '777788990', 'amal_concrete@aden.com', 'عدن - دار سعد', 25000, 'مورد الخرسانة الجاهزة');

  // 6. Projects (Matching UI mockup exactly)
  const insertProj = db.prepare('INSERT INTO projects (code, name, client_id, contract_value, estimated_cost, actual_cost, progress_percentage, expected_profit, actual_profit, status, start_date, end_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  
  // 4 Featured from Dashboard
  insertProj.run('PRJ-001', 'مشروع بناء مجمع سكني', 1, 1200000, 800000, 650000, 65, 400000, 350000, 'active', '2024-01-01', '2024-12-30', 'مشروع مجمع سكني 4 طوابق');
  insertProj.run('PRJ-002', 'مشروع فيلا خاصة', 2, 600000, 400000, 350000, 80, 200000, 150000, 'active', '2024-02-15', '2024-08-30', 'تشطيب وتسليم فيلا VIP');
  insertProj.run('PRJ-003', 'مشروع مدرسة أهلية', 3, 2000000, 1500000, 1200000, 60, 500000, 300000, 'active', '2023-11-01', '2024-10-30', 'مبنى تعليمي وملاعب');
  insertProj.run('PRJ-004', 'مشروع عمارة تجارية', 4, 1600000, 1300000, 1300000, 40, 500000, 200000, 'active', '2024-03-01', '2025-03-01', 'برج تجاري 6 أدوار');
  
  // Additional active & completed projects to match 8 active and 15 total!
  insertProj.run('PRJ-005', 'مشروع مركز صحي السلام', 1, 950000, 700000, 400000, 55, 250000, 180000, 'active', '2024-01-10', '2024-09-20', 'إنشاء مبنى عيادات');
  insertProj.run('PRJ-006', 'مشروع ترميم برج النصر', 4, 450000, 320000, 190000, 70, 130000, 95000, 'active', '2024-02-01', '2024-07-15', 'أعمال تدعيم وتجديد واجهات');
  insertProj.run('PRJ-007', 'مشروع تشييد مستودعات التوزيع', 1, 850000, 600000, 350000, 50, 250000, 150000, 'active', '2024-03-15', '2024-11-30', 'هناجر ومستودعات عزل حراري');
  insertProj.run('PRJ-008', 'مشروع سفلتة وإنارة مجمع الفردوس', 3, 380000, 280000, 140000, 45, 100000, 60000, 'active', '2024-04-01', '2024-08-01', 'أعمال البنية التحتية');
  
  // 7 Completed / Archived Projects (Total = 15)
  insertProj.run('PRJ-009', 'مشروع برج الأندلس السكني', 1, 1500000, 1100000, 1050000, 100, 400000, 450000, 'completed', '2023-01-01', '2023-12-01', 'تم التسليم بنجاح');
  insertProj.run('PRJ-010', 'مشروع فيلا الشاطئ الذهبي', 2, 750000, 550000, 530000, 100, 200000, 220000, 'completed', '2023-03-01', '2023-10-15', 'تم التسليم');
  insertProj.run('PRJ-011', 'مشروع مبنى إداري المنصورة', 4, 1100000, 800000, 810000, 100, 300000, 290000, 'completed', '2023-02-01', '2023-11-20', 'تم التسليم');
  insertProj.run('PRJ-012', 'مشروع حديقة ومتنزه النصر', 3, 400000, 300000, 290000, 100, 100000, 110000, 'completed', '2023-04-01', '2023-09-01', 'تم التسليم');
  insertProj.run('PRJ-013', 'مشروع محطة توليد طاقة شمسية', 1, 900000, 650000, 640000, 100, 250000, 260000, 'completed', '2023-05-01', '2023-12-30', 'تم التسليم');
  insertProj.run('PRJ-014', 'مشروع شبكة مياه خور مكسر', 3, 620000, 480000, 470000, 100, 140000, 150000, 'completed', '2023-06-01', '2023-11-30', 'تم التسليم');
  insertProj.run('PRJ-015', 'مشروع مجمع المعلا التجاري', 4, 1800000, 1400000, 1380000, 100, 400000, 420000, 'completed', '2022-09-01', '2023-08-15', 'تم التسليم');

  // 7. Recent Operations & Expenses
  const insertExpense = db.prepare('INSERT INTO expenses (receipt_no, expense_type, project_id, supplier_id, amount, payment_method, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertExpense.run('EXP-2024-001', 'مواد بناء', 2, 1, 45000, 'نقدي', '2024-05-20', 'شراء إسمنت وحديد');
  insertExpense.run('EXP-2024-002', 'أجور عمالة', 1, null, 20000, 'نقدي', '2024-05-19', 'أجور عمالة صب خرسانة');
  insertExpense.run('EXP-2024-003', 'نقل ومواصلات', 2, null, 5000, 'نقدي', '2024-05-18', 'نقل ومواصلات نقل تربة');
  insertExpense.run('EXP-2024-004', 'معدات', 3, 3, 127500, 'تحويل بنكي', '2024-05-10', 'استئجار حفار ومضخة خرسانة');
  insertExpense.run('EXP-2024-005', 'مواد بناء', 1, 2, 295000, 'شيك', '2024-05-05', 'توريد حديد تسليح');
  insertExpense.run('EXP-2024-006', 'أجور عمالة', 3, null, 192500, 'نقدي', '2024-04-28', 'رواتب وأجور فرق البناء');
  insertExpense.run('EXP-2024-007', 'مصروفات إدارية', null, null, 42500, 'نقدي', '2024-05-02', 'فواتير اتصالات وضيافة مكتبية');
  insertExpense.run('EXP-2024-008', 'أخرى', null, null, 42500, 'نقدي', '2024-05-12', 'مصروفات صيانة ونثريات عامة');
  insertExpense.run('EXP-2024-009', 'أجور عمالة', 4, null, 80000, 'نقدي', '2024-05-15', 'أعمال نجارة مسلحة وحدادة');

  // 8. Payments (Revenues and Collections)
  const insertPayment = db.prepare('INSERT INTO payments (receipt_no, type, client_id, supplier_id, project_id, amount, payment_method, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertPayment.run('RC-2024-001', 'قبض', 1, null, 1, 150000, 'تحويل بنكي', '2024-05-20', 'دفعة أولى من المستخلص رقم 3');
  insertPayment.run('RC-2024-002', 'قبض', 3, null, 3, 200000, 'تحويل بنكي', '2024-05-19', 'دفعة من العميل عن أعمال الدور الثاني');
  insertPayment.run('RC-2024-003', 'قبض', 2, null, 2, 350000, 'شيك', '2024-04-15', 'دفعة مقدمة مرحلية');
  insertPayment.run('RC-2024-004', 'قبض', 4, null, 4, 400000, 'تحويل بنكي', '2024-03-10', 'دفعة حفر وأساسات');
  insertPayment.run('RC-2024-005', 'قبض', 1, null, 1, 150000, 'نقدي', '2024-02-18', 'دفعة نقدية');

  // 9. Custodies (النثريات والعهد)
  const insertCustody = db.prepare('INSERT INTO custodies (operation_type, employee_name, total_amount, spent_amount, remaining_amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertCustody.run('صرف عهدة', 'أحمد محمد', 10000, 3500, 6500, '2024-05-20', 'قرطاسية ومصروفات مكتبية يومية');
  insertCustody.run('صرف عهدة', 'م. خالد سالم', 50000, 42000, 8000, '2024-05-15', 'عهدة مشتريات طارئة لمشروع المجمع');
  insertCustody.run('تصفية عهدة', 'سالم بازرعة', 25000, 25000, 0, '2024-05-10', 'تصفية عهدة نقل ومحروقات');

  // 10. Cash Movements (حركة الصندوق)
  const insertCash = db.prepare('INSERT INTO cash_movements (previous_balance, cash_in, cash_out, withdrawals, current_balance, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertCash.run(50000, 25000, 15000, 5000, 55000, '2024-05-20', 'إغلاق وردية يوم 20 مايو');

  // 11. Items & Inventory
  const insertItem = db.prepare('INSERT INTO items (code, name, category, unit, min_quantity, current_quantity, unit_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  insertItem.run('ITM-01', 'أسمنت بورتلاندي مقاوم', 'أسمنت', 'كيس', 100, 850, 4500, 'أسمنت ذو جودة عالية للمقاولات');
  insertItem.run('ITM-02', 'حديد تسليح 12 ملم تركي', 'حديد', 'طن', 5, 28, 480000, 'حديد مطابق للمواصفات الهندسية');
  insertItem.run('ITM-03', 'حديد تسليح 16 ملم تركي', 'حديد', 'طن', 5, 18, 490000, 'حديد للقواعد والأعمدة');
  insertItem.run('ITM-04', 'بلوك أسمنتي 20 سم', 'بلوك', 'حبة', 500, 6200, 350, 'بلوك هردي وبناء');
  insertItem.run('ITM-05', 'رمل سيليكا ناعم', 'رمل', 'متر مكعب', 20, 120, 8500, 'رمل ناعم لأعمال اللياسة');
  insertItem.run('ITM-06', 'كري وخرسانة سن 1-2', 'ركام', 'متر مكعب', 20, 150, 12000, 'ركام صلب لخلطات الخرسانة');

  // 12. Chart of Accounts (دليل الحسابات الشجري القياسي)
  const insertAccount = db.prepare('INSERT INTO accounts (id, code, name, type, parent_id, balance) VALUES (?, ?, ?, ?, ?, ?)');
  insertAccount.run(1, '1', 'الأصول', 'أصول', null, 2450000);
  insertAccount.run(2, '11', 'الأصول المتداولة', 'أصول', 1, 1850000);
  insertAccount.run(3, '111', 'الصندوق الرئيسي والبنك', 'أصول', 2, 125000);
  insertAccount.run(4, '112', 'العملاء (الذمم المدينة)', 'أصول', 2, 320000);
  insertAccount.run(5, '113', 'المخزون السلعي', 'أصول', 2, 1405000);
  insertAccount.run(6, '2', 'الخصوم', 'خصوم', null, 210000);
  insertAccount.run(7, '21', 'الموردون (الذمم الدائنة)', 'خصوم', 6, 210000);
  insertAccount.run(8, '3', 'حقوق الملكية', 'حقوق ملكية', null, 1840000);
  insertAccount.run(9, '4', 'الإيرادات', 'إيرادات', null, 1250000);
  insertAccount.run(10, '5', 'المصروفات وتكاليف المشاريع', 'مصروفات', null, 850000);

  // 13. Bills (المستخلصات)
  const insertBill = db.prepare('INSERT INTO bills (bill_no, bill_type, project_id, client_id, amount, deduction, net_amount, status, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  insertBill.run('INV-2024-001', 'مستخلص جاري رقم 3', 1, 1, 400000, 40000, 360000, 'معتمد', '2024-05-15', 'أعمال صب سقف الدور الثالث وتشطيبات الكهرباء');
  insertBill.run('INV-2024-002', 'مستخلص جاري رقم 2', 2, 2, 220000, 20000, 200000, 'معتمد', '2024-05-10', 'أعمال اللياسة والدهانات الأولية');
  insertBill.run('INV-2024-003', 'مستخلص جاري رقم 1', 3, 3, 300000, 30000, 270000, 'معتمد', '2024-05-02', 'أعمال الأساسات والقواعد الخرسانية');

  console.log('✅ تم بذر البيانات الأولية بنجاح وتطابق كامل مع إحصائيات النظام!');
}

seedDatabase();
