const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

// دالة مساعدة لتوليد رمز الحساب المحاسبي التالي تحت حساب العملاء 112
function getNextAccountCode() {
  const existingCodes = query("SELECT code FROM accounts WHERE code LIKE '112%' AND LENGTH(code) >= 6 ORDER BY code DESC");
  let nextSeq = 1;
  if (existingCodes && existingCodes.length > 0) {
    const maxNum = Math.max(...existingCodes.map(row => {
      const num = parseInt(row.code.replace('112', ''), 10);
      return isNaN(num) ? 0 : num;
    }));
    nextSeq = maxNum + 1;
  }
  return `112${String(nextSeq).padStart(3, '0')}`;
}

// 1. استعلام رقم الحساب المحاسبي التالي لفتح حساب عميل جديد
router.get('/next-account-code', (req, res) => {
  try {
    const nextCode = getNextAccountCode();
    res.json({ success: true, next_code: nextCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في توليد رمز الحساب', error: err.message });
  }
});

// 2. جلب جميع العملاء مع بيانات حساباتهم المحاسبية والشجرية وأرصدتهم
router.get('/', (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*,
        a.code as account_code,
        a.name as account_name,
        COALESCE(a.balance, c.current_balance) as ledger_balance,
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id) as invoices_count,
        (SELECT COUNT(*) FROM payments WHERE client_id = c.id AND type = 'قبض') as payments_count,
        (SELECT COUNT(*) FROM bills WHERE client_id = c.id) as bills_count
      FROM clients c
      LEFT JOIN accounts a ON c.account_id = a.id
      ORDER BY c.id ASC
    `;
    const clients = query(sql);
    res.json({ success: true, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب العملاء والحسابات', error: err.message });
  }
});

// 3. جلب عميل محدد بالمعرف
router.get('/:id', (req, res) => {
  try {
    const sql = `
      SELECT 
        c.*,
        a.code as account_code,
        a.name as account_name,
        COALESCE(a.balance, c.current_balance) as ledger_balance
      FROM clients c
      LEFT JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `;
    const client = get(sql, [req.params.id]);
    if (!client) {
      return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    }
    res.json({ success: true, data: client });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات العميل', error: err.message });
  }
});

// 4. بطاقة الحساب المالي والمحاسبي للعميل (Customer Ledger Card)
router.get('/:id/account-card', (req, res) => {
  try {
    const client = get(`
      SELECT 
        c.*,
        a.code as account_code,
        a.name as account_name,
        COALESCE(a.balance, c.current_balance) as ledger_balance
      FROM clients c
      LEFT JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!client) {
      return res.status(404).json({ success: false, message: 'حساب العميل غير موجود' });
    }

    // جلب العمليات المحاسبية المرتبطة بالعميل
    const invoices = query(`
      SELECT id, invoice_no as ref_no, date, total_amount as amount, 'فاتورة مبيعات / أعمال' as type, 'debit' as side, notes
      FROM invoices 
      WHERE client_id = ? AND invoice_type = 'آجل'
    `, [client.id]);

    const bills = query(`
      SELECT id, bill_no as ref_no, date, net_amount as amount, 'مستخلص معتمد' as type, 'debit' as side, notes
      FROM bills
      WHERE client_id = ? AND status = 'معتمد'
    `, [client.id]);

    const payments = query(`
      SELECT id, receipt_no as ref_no, date, amount, 'سند قبض وتحصيل' as type, 'credit' as side, notes
      FROM payments
      WHERE client_id = ? AND type = 'قبض'
    `, [client.id]);

    let manualEntries = [];
    if (client.account_id) {
      manualEntries = query(`
        SELECT je.id, je.entry_no as ref_no, je.date, jel.debit, jel.credit, je.description as notes, 'قيد يومية' as type
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.entry_id = je.id
        WHERE jel.account_id = ? AND je.reference_type != 'سند قبض' AND je.reference_type != 'فاتورة آجلة'
      `, [client.account_id]).map(je => ({
        id: je.id,
        ref_no: je.ref_no,
        date: je.date,
        amount: je.debit > 0 ? je.debit : je.credit,
        side: je.debit > 0 ? 'debit' : 'credit',
        type: 'قيد محاسبي عام',
        notes: je.notes
      }));
    }

    const allTx = [...invoices, ...bills, ...payments, ...manualEntries];
    allTx.sort((a, b) => new Date(a.date) - new Date(b.date));

    // حساب إجمالي المدين والدائن والرصيد المتحرك
    let running = Number(client.previous_balance || 0);
    const statementWithRunning = allTx.map(t => {
      const deb = t.side === 'debit' ? Number(t.amount) : 0;
      const cred = t.side === 'credit' ? Number(t.amount) : 0;
      running += (deb - cred);
      return {
        ...t,
        debit: deb,
        credit: cred,
        running_balance: running
      };
    });

    const totalDebits = statementWithRunning.reduce((s, t) => s + t.debit, 0) + Number(client.previous_balance || 0);
    const totalCredits = statementWithRunning.reduce((s, t) => s + t.credit, 0);
    const limit = Number(client.credit_limit || 0);
    const curBal = Number(client.current_balance || 0);
    const creditRemaining = limit > 0 ? Math.max(0, limit - curBal) : null;
    const creditUtilization = limit > 0 ? Math.min(100, Math.round((curBal / limit) * 100)) : 0;

    res.json({
      success: true,
      data: {
        client,
        stats: {
          opening_balance: Number(client.previous_balance || 0),
          total_debits: totalDebits,
          total_credits: totalCredits,
          current_balance: curBal,
          credit_limit: limit,
          credit_remaining: creditRemaining,
          credit_utilization_percent: creditUtilization,
          is_limit_exceeded: limit > 0 && curBal > limit
        },
        transactions: statementWithRunning
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بطاقة الحساب', error: err.message });
  }
});

// 5. خدمة فتح حساب عميل جديد (Customer Account Opening Service)
router.post('/', (req, res) => {
  try {
    const {
      name,
      company,
      phone,
      email,
      address,
      previous_balance = 0,
      currency = 'ر.ي',
      notes,
      account_code,
      credit_limit = 0,
      payment_terms_days = 30,
      tax_number,
      commercial_reg,
      account_status = 'نشط',
      opening_balance_date = new Date().toISOString().split('T')[0],
      opening_balance_type = 'مدين',
      create_opening_entry = true
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'اسم العميل / صاحب الحساب مطلوب' });
    }

    const trimmedName = name.trim();
    const prevBal = Number(previous_balance) || 0;
    const selectedCurrency = currency || 'ر.ي';
    const parsedLimit = Number(credit_limit) || 0;
    const parsedTerms = Number(payment_terms_days) || 30;

    // 1. تحديد أو توليد رمز الحساب المحاسبي الشجري
    let finalAccountCode = account_code ? account_code.trim() : '';
    if (!finalAccountCode) {
      finalAccountCode = getNextAccountCode();
    }

    // التأكد من عدم تكرار كود الحساب في جدول الحسابات
    const existingAcc = get('SELECT id FROM accounts WHERE code = ?', [finalAccountCode]);
    if (existingAcc) {
      finalAccountCode = getNextAccountCode();
    }

    // التأكد من حساب الأب 112 (العملاء - الذمم المدينة)
    let parentAcc = get("SELECT id FROM accounts WHERE code = '112'");
    if (!parentAcc) {
      const insP = run("INSERT INTO accounts (code, name, type, parent_id, balance) VALUES ('112', 'العملاء (الذمم المدينة)', 'أصول', 2, 0)");
      parentAcc = { id: insP.lastInsertRowid };
    }

    // 2. فتح الحساب في دليل الحسابات الشجري العام
    const subAccName = `عميل: ${trimmedName}`;
    const accResult = run(`
      INSERT INTO accounts (code, name, type, parent_id, balance)
      VALUES (?, ?, 'أصول', ?, ?)
    `, [finalAccountCode, subAccName, parentAcc.id, prevBal]);

    const accountId = accResult.lastInsertRowid;

    // 3. إدراج سجل العميل في جدول العملاء وربطه بالحساب المحاسبي
    const clientResult = run(`
      INSERT INTO clients (
        name, company, phone, email, address, 
        previous_balance, total_paid, total_due, current_balance, currency,
        account_id, account_code, credit_limit, payment_terms_days,
        tax_number, commercial_reg, account_status, opening_balance_date, opening_balance_type,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trimmedName,
      company ? company.trim() : '',
      phone ? phone.trim() : '',
      email ? email.trim() : '',
      address ? address.trim() : '',
      prevBal,
      prevBal,
      selectedCurrency,
      accountId,
      finalAccountCode,
      parsedLimit,
      parsedTerms,
      tax_number ? tax_number.trim() : '',
      commercial_reg ? commercial_reg.trim() : '',
      account_status || 'نشط',
      opening_balance_date,
      opening_balance_type || 'مدين',
      notes ? notes.trim() : ''
    ]);

    const clientId = clientResult.lastInsertRowid;

    // 4. إنشاء قيد افتتاحي متزن تلقائياً في دفتر اليومية إذا وجد رصيد افتتاحي
    let openingEntryId = null;
    let entryNo = null;
    if (prevBal > 0 && create_opening_entry) {
      const countRes = get('SELECT COUNT(*) as cnt FROM journal_entries');
      let jeSeq = (countRes ? countRes.cnt : 0) + 1;
      entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
      while (get('SELECT id FROM journal_entries WHERE entry_no = ?', [entryNo])) {
        jeSeq++;
        entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
      }

      // القيد الافتتاحي: مدين حساب العميل | دائن حساب رأس المال / حقوق الملكية (كود 3)
      const equityAcc = get("SELECT id FROM accounts WHERE code = '3' OR type = 'حقوق ملكية' LIMIT 1") || { id: 8 };

      const jeRes = run(`
        INSERT INTO journal_entries (entry_no, date, description, reference_type, reference_id, total_debit, total_credit)
        VALUES (?, ?, ?, 'قيد افتتاحي', ?, ?, ?)
      `, [
        entryNo,
        opening_balance_date,
        `قيد رصيد افتتاحي لفتح حساب العميل: ${trimmedName} (${finalAccountCode})`,
        clientId,
        prevBal,
        prevBal
      ]);

      openingEntryId = jeRes.lastInsertRowid;

      // سطر المدين: حساب العميل الفرعي الجديد
      run(`
        INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes)
        VALUES (?, ?, NULL, ?, 0, ?)
      `, [openingEntryId, accountId, prevBal, `رصيد افتتاحي لفتح الحساب`]);

      // سطر الدائن: حساب حقوق الملكية / رأس المال
      run(`
        INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes)
        VALUES (?, ?, NULL, 0, ?, ?)
      `, [openingEntryId, equityAcc.id, prevBal, `إثبات الرصيد الافتتاحي لفتح حساب العميل`]);
    }

    // 5. تحديث رصيد حساب العملاء الرئيسي (112) ليطابق شجرة الحسابات بدقة
    run(`
      UPDATE accounts 
      SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = ?)
      WHERE id = ?
    `, [parentAcc.id, parentAcc.id]);

    // التحقق النهائي من قاعدة البيانات
    const confirmedClient = get(`
      SELECT c.*, a.code as account_code, a.name as account_name, a.balance as account_balance
      FROM clients c
      JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `, [clientId]);

    res.json({
      success: true,
      message: `تم فتح الحساب المحاسبي للعميل (${confirmedClient.name}) برقم حساب شجري (${finalAccountCode}) بنجاح`,
      data: confirmedClient,
      id: clientId,
      account_id: accountId,
      account_code: finalAccountCode,
      opening_entry_no: entryNo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء فتح حساب العميل: ' + err.message, error: err.message });
  }
});

// 6. تعديل بيانات الحساب والشروط المالية والائتمانية
router.put('/:id', (req, res) => {
  try {
    const clientId = req.params.id;
    const client = get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    }

    const {
      name,
      company,
      phone,
      email,
      address,
      credit_limit,
      payment_terms_days,
      tax_number,
      commercial_reg,
      account_status,
      currency,
      notes
    } = req.body;

    const trimmedName = (name && name.trim()) ? name.trim() : client.name;
    const parsedLimit = (credit_limit !== undefined) ? Number(credit_limit) : client.credit_limit;
    const parsedTerms = (payment_terms_days !== undefined) ? Number(payment_terms_days) : client.payment_terms_days;

    run(`
      UPDATE clients SET
        name = ?,
        company = ?,
        phone = ?,
        email = ?,
        address = ?,
        credit_limit = ?,
        payment_terms_days = ?,
        tax_number = ?,
        commercial_reg = ?,
        account_status = ?,
        currency = ?,
        notes = ?
      WHERE id = ?
    `, [
      trimmedName,
      company !== undefined ? company.trim() : client.company,
      phone !== undefined ? phone.trim() : client.phone,
      email !== undefined ? email.trim() : client.email,
      address !== undefined ? address.trim() : client.address,
      parsedLimit,
      parsedTerms,
      tax_number !== undefined ? tax_number.trim() : client.tax_number,
      commercial_reg !== undefined ? commercial_reg.trim() : client.commercial_reg,
      account_status || client.account_status,
      currency || client.currency,
      notes !== undefined ? notes.trim() : client.notes,
      clientId
    ]);

    // تحديث اسم الحساب في جدول accounts إن وجد
    if (client.account_id) {
      run("UPDATE accounts SET name = ? WHERE id = ?", [`عميل: ${trimmedName}`, client.account_id]);
    }

    const updated = get(`
      SELECT c.*, a.code as account_code, a.name as account_name
      FROM clients c
      LEFT JOIN accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `, [clientId]);

    res.json({
      success: true,
      message: `تم تحديث بيانات الحساب للعميل (${trimmedName}) بنجاح`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء تحديث بيانات الحساب: ' + err.message, error: err.message });
  }
});

// 7. حذف عميل مع التحقق من سلامة الدورة المحاسبية
router.delete('/:id', (req, res) => {
  try {
    const clientId = req.params.id;
    const client = get('SELECT * FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    }

    // فحص العمليات المرتبطة
    const hasInvoices = get('SELECT COUNT(*) as cnt FROM invoices WHERE client_id = ?', [clientId]);
    const hasPayments = get('SELECT COUNT(*) as cnt FROM payments WHERE client_id = ?', [clientId]);
    const hasProjects = get('SELECT COUNT(*) as cnt FROM projects WHERE client_id = ?', [clientId]);
    const hasBills = get('SELECT COUNT(*) as cnt FROM bills WHERE client_id = ?', [clientId]);

    const totalTx = (hasInvoices?.cnt || 0) + (hasPayments?.cnt || 0) + (hasProjects?.cnt || 0) + (hasBills?.cnt || 0);

    if (totalTx > 0) {
      // بدلاً من الحذف الفيزيائي الذي يكسر الحسابات، يتم تعطيل الحساب وتغيير حالته إلى موقوف
      run("UPDATE clients SET account_status = 'موقوف' WHERE id = ?", [clientId]);
      return res.json({
        success: true,
        message: `تم إيقاف حساب العميل (${client.name}) بنجاح لحماية وتوثيق العمليات المحاسبية المرتبطة به (${totalTx} حركة مسجلة)`
      });
    }

    // إذا لم تكن هناك أي حركات محاسبية، يمكن الحذف
    if (client.account_id) {
      run('DELETE FROM accounts WHERE id = ?', [client.account_id]);
    }
    run('DELETE FROM clients WHERE id = ?', [clientId]);

    // إعادة ضبط رصيد الحساب الرئيسي 112
    run(`
      UPDATE accounts 
      SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
      WHERE code = '112';
    `);

    res.json({ success: true, message: `تم حذف الحساب والعميل (${client.name}) بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء حذف العميل: ' + err.message, error: err.message });
  }
});

module.exports = router;
