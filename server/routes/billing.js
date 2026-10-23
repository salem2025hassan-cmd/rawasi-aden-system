const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

// جلب الفواتير والمستخلصات
router.get('/', (req, res) => {
  try {
    const { project_id, client_id, status } = req.query;
    let sql = `
      SELECT b.*, 
        p.name as project_name, 
        c.name as client_name 
      FROM bills b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN clients c ON b.client_id = c.id
    `;
    const params = [];
    const conditions = [];

    if (project_id) {
      conditions.push('b.project_id = ?');
      params.push(project_id);
    }
    if (client_id) {
      conditions.push('b.client_id = ?');
      params.push(client_id);
    }
    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY b.date DESC, b.id DESC';
    const bills = query(sql, params);
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المستخلصات', error: err.message });
  }
});

// إنشاء مستخلص أو فاتورة أعمال جديدة
router.post('/', (req, res) => {
  try {
    const {
      bill_type = 'مستخلص جاري',
      project_id,
      client_id,
      amount,
      deduction = 0,
      status = 'معتمد',
      date = new Date().toISOString().split('T')[0],
      notes
    } = req.body;

    if (!project_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المشروع والمبلغ الإجمالي' });
    }

    const parsedAmount = Number(amount);
    const parsedDeduction = Number(deduction);
    const net_amount = parsedAmount - parsedDeduction;

    // جلب معرف العميل إن لم يكن محدد
    let finalClientId = client_id;
    if (!finalClientId) {
      const proj = get('SELECT client_id FROM projects WHERE id = ?', [project_id]);
      if (proj) finalClientId = proj.client_id;
    }

    // توليد رقم المستخلص
    const countRes = get('SELECT COUNT(*) as cnt FROM bills');
    const bill_no = `INV-${new Date().getFullYear()}-${String((countRes.cnt || 0) + 1).padStart(4, '0')}`;

    const result = run(`
      INSERT INTO bills (
        bill_no, bill_type, project_id, client_id, 
        amount, deduction, net_amount, status, date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bill_no, bill_type, project_id, finalClientId || null,
      parsedAmount, parsedDeduction, net_amount, status, date, notes || ''
    ]);

    // زيادة مستحقات العميل (الذمم المدينة) بصافي المستخلص وربطها محاسبياً
    if (finalClientId && status === 'معتمد') {
      const clObj = get('SELECT id, name, account_id, account_code FROM clients WHERE id = ?', [finalClientId]);
      const projObj = get('SELECT name FROM projects WHERE id = ?', [project_id]);

      run(`
        UPDATE clients SET 
          total_due = total_due + ?,
          current_balance = current_balance + ?
        WHERE id = ?
      `, [net_amount, net_amount, finalClientId]);

      // تحديث رصيد الحساب الفرعي للعميل في دليل الحسابات
      if (clObj && clObj.account_id) {
        run("UPDATE accounts SET balance = balance + ? WHERE id = ?", [net_amount, clObj.account_id]);
        run(`
          UPDATE accounts 
          SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
          WHERE code = '112'
        `);
      }

      // توليد قيد يومي تلقائي لإثبات المستخلص محاسبياً
      const countJE = get('SELECT COUNT(*) as cnt FROM journal_entries');
      let jeSeq = (countJE ? countJE.cnt : 0) + 1;
      let entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
      while (get('SELECT id FROM journal_entries WHERE entry_no = ?', [entryNo])) {
        jeSeq++;
        entryNo = `JE-${String(jeSeq).padStart(5, '0')}`;
      }

      const clientAccId = (clObj && clObj.account_id) ? clObj.account_id : 4;
      const clientNameStr = clObj ? `${clObj.name} (${clObj.account_code || ''})` : 'عميل';

      const jeRes = run(`
        INSERT INTO journal_entries (entry_no, date, description, reference_type, reference_id, total_debit, total_credit)
        VALUES (?, ?, ?, 'مستخلص', ?, ?, ?)
      `, [entryNo, date, `إثبات مستخلص أعمال رقم ${bill_no} - مشروع: ${projObj ? projObj.name : ''} (${clientNameStr})`, result.lastInsertRowid, net_amount, net_amount]);

      if (jeRes && jeRes.lastInsertRowid) {
        // مدين: حساب العميل الفرعي
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, ?, ?, ?, 0, ?)`,
          [jeRes.lastInsertRowid, clientAccId, project_id || null, net_amount, `استحقاق مستخلص ${bill_no} على العميل`]
        );
        // دائن: إيرادات المشاريع
        run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 9, ?, 0, ?, ?)`,
          [jeRes.lastInsertRowid, project_id || null, net_amount, `إيرادات أعمال ومستخلصات`]
        );
      }
    }

    res.json({
      success: true,
      message: 'تم إنشاء المستخلص واعتماده وتوليد قيده المحاسبي بنجاح',
      bill_no,
      id: result.lastInsertRowid,
      net_amount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إنشاء المستخلص', error: err.message });
  }
});

// حذف مستخلص مع عكس الأثر المالي والمحاسبي
router.delete('/:id', (req, res) => {
  try {
    const bill = get('SELECT * FROM bills WHERE id = ?', [req.params.id]);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'المستخلص غير موجود' });
    }

    // عكس أثر ذمة العميل وحسابه المحاسبي
    if (bill.client_id && bill.status === 'معتمد') {
      run(`
        UPDATE clients SET
          total_due = MAX(0, total_due - ?),
          current_balance = MAX(0, current_balance - ?)
        WHERE id = ?
      `, [bill.net_amount, bill.net_amount, bill.client_id]);

      const clObj = get('SELECT account_id FROM clients WHERE id = ?', [bill.client_id]);
      if (clObj && clObj.account_id) {
        run("UPDATE accounts SET balance = MAX(0, balance - ?) WHERE id = ?", [bill.net_amount, clObj.account_id]);
        run(`
          UPDATE accounts 
          SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
          WHERE code = '112'
        `);
      }

      // حذف قيد اليومية المرتبط بالمستخلص إن وجد
      try {
        const je = get("SELECT id FROM journal_entries WHERE reference_type = 'مستخلص' AND reference_id = ?", [bill.id]);
        if (je) {
          run("DELETE FROM journal_entry_lines WHERE entry_id = ?", [je.id]);
          run("DELETE FROM journal_entries WHERE id = ?", [je.id]);
        }
      } catch (jeErr) {}
    }

    run('DELETE FROM bills WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `تم حذف المستخلص (${bill.bill_no}) وعكس أثره المحاسبي بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء حذف المستخلص: ' + err.message, error: err.message });
  }
});

module.exports = router;
