const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

// جلب جميع سندات القبض وسندات الصرف الموحدة مع التلخيص والفلترة
router.get('/all-vouchers', (req, res) => {
  try {
    const { type, project_id, from_date, to_date, search } = req.query;

    let receiptSql = `
      SELECT 
        p.id,
        'payment' as source,
        p.receipt_no,
        p.type,
        p.date,
        p.amount,
        COALESCE(p.currency, 'ر.ي') as currency,
        p.payment_method,
        p.notes,
        p.project_id,
        p.reference_no,
        pr.name as project_name,
        p.client_id,
        c.name as client_name,
        p.supplier_id,
        s.name as supplier_name,
        COALESCE(p.recipient, c.name, 'عميل') as party_name,
        'إيراد / دفعة مستخلص' as category
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
    `;

    let expenseSql = `
      SELECT 
        e.id,
        'expense' as source,
        e.receipt_no,
        'صرف' as type,
        e.date,
        e.amount,
        COALESCE(e.currency, 'ر.ي') as currency,
        e.payment_method,
        e.notes,
        e.project_id,
        e.reference_no,
        pr.name as project_name,
        NULL as client_id,
        NULL as client_name,
        e.supplier_id,
        s.name as supplier_name,
        COALESCE(e.recipient, s.name, 'مستفيد') as party_name,
        e.expense_type as category
      FROM expenses e
      LEFT JOIN suppliers s ON e.supplier_id = s.id
      LEFT JOIN projects pr ON e.project_id = pr.id
    `;

    const receipts = query(receiptSql);
    const expenses = query(expenseSql);

    let all = [...receipts, ...expenses];

    // Filter by type
    if (type && type !== 'all' && type !== 'الكل') {
      all = all.filter(v => v.type === type);
    }
    // Filter by project
    if (project_id && project_id !== '' && project_id !== 'all') {
      all = all.filter(v => String(v.project_id) === String(project_id));
    }
    // Filter by date
    if (from_date) {
      all = all.filter(v => v.date >= from_date);
    }
    if (to_date) {
      all = all.filter(v => v.date <= to_date);
    }
    // Search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      all = all.filter(v => 
        (v.receipt_no && v.receipt_no.toLowerCase().includes(q)) ||
        (v.party_name && v.party_name.toLowerCase().includes(q)) ||
        (v.project_name && v.project_name.toLowerCase().includes(q)) ||
        (v.notes && v.notes.toLowerCase().includes(q)) ||
        (v.category && v.category.toLowerCase().includes(q)) ||
        (v.reference_no && v.reference_no.toLowerCase().includes(q))
      );
    }

    // Sort by date DESC, then id DESC
    all.sort((a, b) => {
      const dComp = (b.date || '').localeCompare(a.date || '');
      if (dComp !== 0) return dComp;
      return (b.id || 0) - (a.id || 0);
    });

    // Summary calculation
    const totalReceipts = all.filter(v => v.type === 'قبض').reduce((s, v) => s + (Number(v.amount) || 0), 0);
    const totalExpenses = all.filter(v => v.type === 'صرف').reduce((s, v) => s + (Number(v.amount) || 0), 0);
    const countReceipts = all.filter(v => v.type === 'قبض').length;
    const countExpenses = all.filter(v => v.type === 'صرف').length;

    res.json({
      success: true,
      data: all,
      summary: {
        totalReceipts,
        totalExpenses,
        netBalance: totalReceipts - totalExpenses,
        countReceipts,
        countExpenses,
        totalCount: all.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السندات', error: err.message });
  }
});

// استعلام رقم السند التالي المتوقع
router.get('/next-number', (req, res) => {
  try {
    const { type = 'قبض' } = req.query;
    const prefix = type === 'قبض' ? 'RC' : 'PV';
    const currentYear = new Date().getFullYear();

    if (type === 'صرف') {
      const countRes = get('SELECT COUNT(*) as cnt FROM expenses');
      let seq = (countRes ? countRes.cnt : 0) + 1;
      let receipt_no = `EP-${currentYear}-${String(seq).padStart(4, '0')}`;
      while (get('SELECT id FROM expenses WHERE receipt_no = ?', [receipt_no])) {
        seq++;
        receipt_no = `EP-${currentYear}-${String(seq).padStart(4, '0')}`;
      }
      return res.json({ success: true, next_no: receipt_no });
    } else {
      const countRes = get('SELECT COUNT(*) as cnt FROM payments WHERE type = ?', [type]);
      let seq = (countRes ? countRes.cnt : 0) + 1;
      let receipt_no = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
      while (get('SELECT id FROM payments WHERE receipt_no = ?', [receipt_no])) {
        seq++;
        receipt_no = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
      }
      return res.json({ success: true, next_no: receipt_no });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في توليد رقم السند', error: err.message });
  }
});

// جلب سندات القبض والصرف
router.get('/', (req, res) => {
  try {
    const { type, client_id, supplier_id, project_id } = req.query;
    let sql = `
      SELECT p.*, 
        c.name as client_name, 
        s.name as supplier_name,
        pr.name as project_name
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
    `;
    const params = [];
    const conditions = [];

    if (type) {
      conditions.push('p.type = ?');
      params.push(type);
    }
    if (client_id) {
      conditions.push('p.client_id = ?');
      params.push(client_id);
    }
    if (supplier_id) {
      conditions.push('p.supplier_id = ?');
      params.push(supplier_id);
    }
    if (project_id) {
      conditions.push('p.project_id = ?');
      params.push(project_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.date DESC, p.id DESC';
    const payments = query(sql, params);
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب السندات والمدفوعات', error: err.message });
  }
});

// إنشاء سند قبض أو صرف
router.post('/', (req, res) => {
  try {
    const {
      type = 'قبض', // 'قبض' أو 'صرف'
      client_id,
      supplier_id,
      project_id,
      amount,
      currency = 'ر.ي',
      payment_method = 'تحويل بنكي', // تحويل بنكي، نقدي، شيك
      date = new Date().toISOString().split('T')[0],
      notes,
      recipient,
      reference_no
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ مطلوب ويجب أن يكون أكبر من الصفر' });
    }

    const parsedAmount = Number(amount);
    const selectedCurrency = currency || 'ر.ي';

    // توليد رقم السند بطريقة آمنة تمنع التكرار: RC-2026-0001 أو PV-2026-0001
    const prefix = type === 'قبض' ? 'RC' : 'PV';
    const currentYear = new Date().getFullYear();
    const countRes = get('SELECT COUNT(*) as cnt FROM payments WHERE type = ?', [type]);
    let seq = (countRes ? countRes.cnt : 0) + 1;
    let receipt_no = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
    while (get('SELECT id FROM payments WHERE receipt_no = ?', [receipt_no])) {
      seq++;
      receipt_no = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
    }

    const cId = client_id && client_id !== '' ? Number(client_id) : null;
    const sId = supplier_id && supplier_id !== '' ? Number(supplier_id) : null;
    const pId = project_id && project_id !== '' ? Number(project_id) : null;

    const result = run(`
      INSERT INTO payments (
        receipt_no, type, client_id, supplier_id, project_id, 
        amount, currency, payment_method, date, notes, recipient, reference_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receipt_no, type, cId, sId, pId,
      parsedAmount, selectedCurrency, payment_method, date, notes || '',
      recipient || '', reference_no || ''
    ]);

    // جلب بيانات العميل وحسابه المحاسبي الشجري إن وجد
    let clientObj = null;
    if (cId) {
      clientObj = get('SELECT id, name, account_id, account_code FROM clients WHERE id = ?', [cId]);
    }

    // التأثير المحاسبي على العميل أو المورد
    if (type === 'قبض' && cId) {
      run(`
        UPDATE clients SET 
          total_paid = total_paid + ?,
          current_balance = MAX(0, current_balance - ?)
        WHERE id = ?
      `, [parsedAmount, parsedAmount, cId]);

      // تحديث رصيد الحساب الفرعي للعميل في دليل الحسابات الشجري
      if (clientObj && clientObj.account_id) {
        run("UPDATE accounts SET balance = MAX(0, balance - ?) WHERE id = ?", [parsedAmount, clientObj.account_id]);
        run(`
          UPDATE accounts 
          SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
          WHERE code = '112'
        `);
      }
    } else if (type === 'صرف' && sId) {
      run(`
        UPDATE suppliers SET balance = MAX(0, balance - ?) WHERE id = ?
      `, [parsedAmount, sId]);
    }

    // التأثير على الصندوق والبنك
    const lastCash = get('SELECT current_balance FROM cash_movements ORDER BY id DESC LIMIT 1') || { current_balance: 125000 };
    const prevBal = lastCash.current_balance;
    const newBal = type === 'قبض' ? prevBal + parsedAmount : prevBal - parsedAmount;
    
    run(`
      INSERT INTO cash_movements (previous_balance, cash_in, cash_out, withdrawals, current_balance, date, notes)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `, [
      prevBal,
      type === 'قبض' ? parsedAmount : 0,
      type === 'صرف' ? parsedAmount : 0,
      newBal,
      date,
      `سند ${type}: ${receipt_no}`
    ]);

    // توليد قيد يومي تلقائي بدون تكرار
    const entryCount = get('SELECT COUNT(*) as cnt FROM journal_entries');
    let jeSeq = (entryCount ? entryCount.cnt : 0) + 1;
    let entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
    while (get('SELECT id FROM journal_entries WHERE entry_no = ?', [entryNo])) {
      jeSeq++;
      entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
    }

    const jeRes = run(`
      INSERT INTO journal_entries (entry_no, date, description, reference_type, reference_id, total_debit, total_credit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      entryNo,
      date,
      `سند ${type} رقم ${receipt_no} - ${notes || ''}`,
      `سند ${type}`,
      result.lastInsertRowid,
      parsedAmount,
      parsedAmount
    ]);

    if (type === 'قبض') {
      const clientAccId = (clientObj && clientObj.account_id) ? clientObj.account_id : 4;
      const clientNote = clientObj ? `تخفيض ذمة العميل: ${clientObj.name} (${clientObj.account_code || ''})` : `تخفيض ذمة العميل`;

      // مدين: الصندوق والبنك (111) | دائن: حساب العميل الفرعي
      run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 3, ?, ?, 0, ?)`,
        [jeRes.lastInsertRowid, project_id || null, parsedAmount, `قبض في الصندوق / البنك - طريقة: ${payment_method}`]
      );
      run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, ?, ?, 0, ?, ?)`,
        [jeRes.lastInsertRowid, clientAccId, project_id || null, parsedAmount, clientNote]
      );
    } else {
      // مدين: الموردون (21) | دائن: الصندوق والبنك (111)
      run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 7, ?, ?, 0, ?)`,
        [jeRes.lastInsertRowid, project_id || null, parsedAmount, `سداد للمورد`]
      );
      run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 3, ?, 0, ?, ?)`,
        [jeRes.lastInsertRowid, project_id || null, parsedAmount, `صرف من الصندوق`]
      );
    }

    res.json({
      success: true,
      message: `تم تسجيل سند ال${type} بنجاح برقم ${receipt_no}`,
      receipt_no,
      id: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء تسجيل السند', error: err.message });
  }
});

// حذف سند قبض أو صرف مع عكس الأثر المالي
router.delete('/:id', (req, res) => {
  try {
    const payment = get('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'السند غير موجود' });
    }

    const amount = Number(payment.amount) || 0;
    const isReceipt = (payment.type === 'قبض');

    // عكس الأثر على العميل أو المورد
    if (isReceipt && payment.client_id) {
      run(`
        UPDATE clients SET
          total_paid = MAX(0, total_paid - ?),
          current_balance = current_balance + ?
        WHERE id = ?
      `, [amount, amount, payment.client_id]);

      // عكس الأثر على الحساب الفرعي للعميل في دليل الحسابات
      const cl = get('SELECT account_id FROM clients WHERE id = ?', [payment.client_id]);
      if (cl && cl.account_id) {
        run("UPDATE accounts SET balance = balance + ? WHERE id = ?", [amount, cl.account_id]);
        run(`
          UPDATE accounts 
          SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
          WHERE code = '112'
        `);
      }
    } else if (!isReceipt && payment.supplier_id) {
      run(`
        UPDATE suppliers SET balance = balance + ? WHERE id = ?
      `, [amount, payment.supplier_id]);
    }

    // حذف القيد اليومي المرتبط بالسند
    try {
      const je = get("SELECT id FROM journal_entries WHERE reference_type = ? AND reference_id = ?", [`سند ${payment.type}`, payment.id]);
      if (je) {
        run("DELETE FROM journal_entry_lines WHERE entry_id = ?", [je.id]);
        run("DELETE FROM journal_entries WHERE id = ?", [je.id]);
      }
    } catch (jeDelErr) {
      console.warn('Error deleting payment journal entry:', jeDelErr.message);
    }

    // عكس الأثر على الصندوق والبنك
    const lastCash = get('SELECT current_balance FROM cash_movements ORDER BY id DESC LIMIT 1') || { current_balance: 0 };
    const prevBal = Number(lastCash.current_balance) || 0;
    const newBal = isReceipt ? (prevBal - amount) : (prevBal + amount);

    run(`
      INSERT INTO cash_movements (previous_balance, cash_in, cash_out, withdrawals, current_balance, date, notes)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `, [
      prevBal,
      isReceipt ? 0 : amount,
      isReceipt ? amount : 0,
      newBal,
      new Date().toISOString().split('T')[0],
      `إلغاء/حذف سند ${payment.type} رقم: ${payment.receipt_no}`
    ]);

    // حذف السند نفسه
    run('DELETE FROM payments WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: `تم حذف سند ال${payment.type} (${payment.receipt_no}) وعكس أثره المحاسبي بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء حذف السند: ' + err.message, error: err.message });
  }
});

module.exports = router;
