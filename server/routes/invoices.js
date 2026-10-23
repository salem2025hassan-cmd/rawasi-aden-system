const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { query, get, run } = require('../database/db');

// دالة مساعدة لحفظ الملفات الممسوحة ضوئياً من Base64
function saveBase64File(file_base64, originalFilename) {
  if (!file_base64 || typeof file_base64 !== 'string') return null;
  try {
    const matches = file_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const base64Data = matches ? matches[2] : file_base64;

    let ext = '.jpg';
    if (mimeType.includes('pdf')) ext = '.pdf';
    else if (mimeType.includes('png')) ext = '.png';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('jpeg')) ext = '.jpg';

    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'invoices');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeName = (originalFilename || 'scan_doc').replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, '_');
    const fileName = `scan_${Date.now()}_${Math.floor(Math.random() * 10000)}_${safeName.endsWith(ext) ? safeName : safeName + ext}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    return {
      url: `/uploads/invoices/${fileName}`,
      name: originalFilename || fileName,
      type: mimeType
    };
  } catch (err) {
    console.error('Error saving base64 file:', err);
    return null;
  }
}

// 1. نقطة رفع مستند ممسوح ضوئياً بشكل فوري
router.post('/upload-scan', (req, res) => {
  try {
    const { file_base64, filename } = req.body;
    if (!file_base64) {
      return res.status(400).json({ success: false, message: 'لم يتم إرسال ملف' });
    }
    const fileInfo = saveBase64File(file_base64, filename);
    if (!fileInfo) {
      return res.status(500).json({ success: false, message: 'فشل حفظ الملف على الخادم' });
    }
    res.json({
      success: true,
      url: fileInfo.url,
      filename: fileInfo.name,
      mime_type: fileInfo.type
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء رفع الملف: ' + err.message });
  }
});

// 2. جلب قائمة الفواتير مع التصفية والأرشفة والمشروع الحر والمرفقات
router.get('/', (req, res) => {
  try {
    const { is_archived, invoice_type, client_id, project_id, search, source } = req.query;
    let sql = `
      SELECT inv.*,
        c.name as client_display_name,
        c.phone as client_phone,
        COALESCE(p.name, inv.project_name) as project_name,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = inv.id) as items_count
      FROM invoices inv
      LEFT JOIN clients c ON inv.client_id = c.id
      LEFT JOIN projects p ON inv.project_id = p.id
    `;
    const params = [];
    const conditions = [];

    if (is_archived !== undefined && is_archived !== '') {
      conditions.push('inv.is_archived = ?');
      params.push(Number(is_archived));
    }
    if (invoice_type) {
      conditions.push('inv.invoice_type = ?');
      params.push(invoice_type);
    }
    if (source) {
      conditions.push('inv.source = ?');
      params.push(source);
    }
    if (client_id) {
      conditions.push('inv.client_id = ?');
      params.push(client_id);
    }
    if (project_id) {
      conditions.push('inv.project_id = ?');
      params.push(project_id);
    }
    if (search && search.trim()) {
      conditions.push('(inv.invoice_no LIKE ? OR inv.client_name LIKE ? OR c.name LIKE ? OR inv.project_name LIKE ? OR p.name LIKE ? OR inv.notes LIKE ? OR inv.physical_archive_no LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term, term);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY inv.date DESC, inv.id DESC';
    const invoices = query(sql, params);

    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الفواتير', error: err.message });
  }
});

// 3. جلب فاتورة مفردة بكافة بنودها وتفاصيلها ومرفقاتها
router.get('/:id', (req, res) => {
  try {
    const invoice = get(`
      SELECT inv.*,
        c.name as client_display_name,
        c.phone as client_phone,
        c.address as client_address,
        COALESCE(p.name, inv.project_name) as project_name,
        p.code as project_code
      FROM invoices inv
      LEFT JOIN clients c ON inv.client_id = c.id
      LEFT JOIN projects p ON inv.project_id = p.id
      WHERE inv.id = ?
    `, [req.params.id]);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    const items = query(`
      SELECT * FROM invoice_items 
      WHERE invoice_id = ? 
      ORDER BY item_order ASC, id ASC
    `, [invoice.id]);

    res.json({ success: true, data: { ...invoice, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب تفاصيل الفاتورة', error: err.message });
  }
});

// 4. إنشاء فاتورة جديدة (نظامية أو من السكانر) مع دعم المشروع الحر والأرشفة
router.post('/', (req, res) => {
  try {
    const {
      invoice_no: custom_invoice_no,
      invoice_type = 'نقد', // 'نقد' أو 'آجل'
      client_id,
      client_name,
      project_id,
      project_name, // حقل حر للمشروع يسجل فيه المستخدم أي شيء يريده
      date = new Date().toISOString().split('T')[0],
      due_date,
      subtotal = 0,
      discount = 0,
      tax_amount = 0,
      total_amount,
      payment_method = 'نقدي',
      currency = 'ر.ي',
      status,
      notes,
      terms,
      items = [],
      source = 'نظام', // 'نظام' أو 'سكانر'
      category = 'مبيعات',
      is_archived = 0,
      physical_archive_no,
      attachment_url,
      attachment_name,
      attachment_type,
      file_base64,
      skip_financial_impact = false // تفعيل أو إلغاء الأثر المالي (للأرشفة التوثيقية)
    } = req.body;

    let parsedSubtotal = Number(subtotal) || 0;
    if (parsedSubtotal <= 0 && Array.isArray(items) && items.length > 0) {
      parsedSubtotal = items.reduce((sum, it) => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.unit_price) || 0;
        const cp = (it.completion_percentage !== undefined && it.completion_percentage !== '' && !isNaN(Number(it.completion_percentage)))
          ? Number(it.completion_percentage)
          : 100;
        const t = (it.total !== undefined && it.total !== null && !isNaN(Number(it.total)))
          ? Number(it.total)
          : Math.round(((q * p * (cp / 100)) + Number.EPSILON) * 100) / 100;
        return sum + t;
      }, 0);
    }
    const parsedDiscount = Number(discount) || 0;
    const parsedTax = Number(tax_amount) || 0;
    let parsedTotal = Number(total_amount);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      parsedTotal = Math.max(0, parsedSubtotal - parsedDiscount + parsedTax);
    }

    // إذا تم رفع ملف من السكانر مباشرة كـ Base64
    let finalAttachmentUrl = attachment_url || null;
    let finalAttachmentName = attachment_name || null;
    let finalAttachmentType = attachment_type || null;

    if (file_base64) {
      const saved = saveBase64File(file_base64, attachment_name);
      if (saved) {
        finalAttachmentUrl = saved.url;
        finalAttachmentName = saved.name;
        finalAttachmentType = saved.type;
      }
    }

    // تحديد المبالغ المسددة والمتبقية والحالة
    const isCash = (invoice_type === 'نقد');
    const finalPaid = isCash ? parsedTotal : 0;
    const finalRemaining = isCash ? 0 : parsedTotal;
    const finalStatus = status || (isCash ? 'مدفوعة' : 'مستحقة');
    const finalDueDate = isCash ? null : (due_date || date);
    const finalArchived = Number(is_archived) === 1 ? 1 : 0;
    const archivedAt = finalArchived ? new Date().toISOString() : null;

    // تحديد رقم الفاتورة (إما رقم الفاتورة الورقية المدخلة يدوياً أو ترقيم تلقائي)
    let finalInvoiceNo = custom_invoice_no ? custom_invoice_no.trim() : '';
    if (!finalInvoiceNo) {
      const currentYear = new Date().getFullYear();
      const countRes = get('SELECT COUNT(*) as cnt FROM invoices');
      let seq = (countRes ? countRes.cnt : 0) + 1;
      const prefix = (source === 'سكانر') ? 'SCN' : 'INV';
      finalInvoiceNo = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
      while (get('SELECT id FROM invoices WHERE invoice_no = ?', [finalInvoiceNo])) {
        seq++;
        finalInvoiceNo = `${prefix}-${currentYear}-${String(seq).padStart(4, '0')}`;
      }
    }

    // إدراج رأس الفاتورة في جدول invoices مع الحقول الإضافية
    const invResult = run(`
      INSERT INTO invoices (
        invoice_no, invoice_type, client_id, client_name, project_id, project_name,
        date, due_date, subtotal, discount, tax_amount, total_amount,
        paid_amount, remaining_amount, payment_method, currency,
        status, is_archived, archived_at, notes, terms,
        source, category, attachment_url, attachment_name, attachment_type, physical_archive_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalInvoiceNo,
      invoice_type,
      client_id ? Number(client_id) : null,
      client_name ? client_name.trim() : null,
      project_id ? Number(project_id) : null,
      project_name ? project_name.trim() : null, // المشروع الحر
      date,
      finalDueDate,
      parsedSubtotal,
      parsedDiscount,
      parsedTax,
      parsedTotal,
      finalPaid,
      finalRemaining,
      payment_method,
      currency || 'ر.ي',
      finalStatus,
      finalArchived,
      archivedAt,
      notes || '',
      terms || '',
      source || 'نظام',
      category || 'مبيعات',
      finalAttachmentUrl,
      finalAttachmentName,
      finalAttachmentType,
      physical_archive_no || null
    ]);

    const invoiceId = invResult.lastInsertRowid;

    // إدراج سطور البنود إن وجدت
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((it, index) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unit_price) || 0;
        const compPercent = (it.completion_percentage !== undefined && it.completion_percentage !== '' && !isNaN(Number(it.completion_percentage)))
          ? Number(it.completion_percentage)
          : 100;
        const calculatedTotal = Math.round(((qty * price * (compPercent / 100)) + Number.EPSILON) * 100) / 100;
        const tot = (it.total !== undefined && it.total !== null && !isNaN(Number(it.total)))
          ? Number(it.total)
          : calculatedTotal;

        run(`
          INSERT INTO invoice_items (
            invoice_id, item_order, description, unit, quantity, unit_price, completion_percentage, total, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceId, index + 1, it.description || 'بند غير مسمى',
          it.unit || 'وحدة', qty, price, compPercent, tot, it.notes || ''
        ]);
      });
    }

    // التأثير المحاسبي التلقائي (إلا إذا تم طلب تخطيه كأرشفة توثيقية)
    if (!skip_financial_impact && parsedTotal > 0) {
      if (isCash) {
        // فاتورة نقدية: تغذية الصندوق بحركة دخل نقدية
        const lastCash = get('SELECT current_balance FROM cash_movements ORDER BY id DESC LIMIT 1') || { current_balance: 125000 };
        const prevBal = Number(lastCash.current_balance) || 0;
        const newBal = prevBal + parsedTotal;

        run(`
          INSERT INTO cash_movements (previous_balance, cash_in, cash_out, withdrawals, current_balance, date, notes)
          VALUES (?, ?, 0, 0, ?, ?, ?)
        `, [prevBal, parsedTotal, newBal, date, `فاتورة ${source === 'سكانر' ? 'سكانر ' : ''}نقدية: ${finalInvoiceNo} (${client_name || 'عميل'})`]);

        // إنشاء قيد يومي تلقائي
        const countJE = get('SELECT COUNT(*) as cnt FROM journal_entries');
        const entryNo = `JE-${String((countJE ? countJE.cnt : 0) + 1).padStart(5, '0')}`;
        const jeRes = run(`
          INSERT INTO journal_entries (entry_no, date, description, reference_type, reference_id, total_debit, total_credit)
          VALUES (?, ?, ?, 'فاتورة نقدية', ?, ?, ?)
        `, [entryNo, date, `إيراد فاتورة نقدية رقم ${finalInvoiceNo}`, invoiceId, parsedTotal, parsedTotal]);

        if (jeRes && jeRes.lastInsertRowid) {
          run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 3, ?, ?, 0, ?)`,
            [jeRes.lastInsertRowid, project_id || null, parsedTotal, `تحصيل نقدي للفاتورة ${finalInvoiceNo}`]
          );
          run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 9, ?, 0, ?, ?)`,
            [jeRes.lastInsertRowid, project_id || null, parsedTotal, `إيرادات مبيعات / أعمال`]
          );
        }
      } else {
        // فاتورة آجلة: زيادة مستحقات العميل وذمته المالية وربطها بحسابه المحاسبي الشجري
        let clientAccId = 4;
        let clientNameStr = client_name || 'عميل';

        if (client_id) {
          const clObj = get('SELECT id, name, account_id, account_code FROM clients WHERE id = ?', [Number(client_id)]);
          if (clObj) {
            clientNameStr = clObj.name;
            if (clObj.account_id) clientAccId = clObj.account_id;
          }

          run(`
            UPDATE clients SET
              total_due = total_due + ?,
              current_balance = current_balance + ?
            WHERE id = ?
          `, [parsedTotal, parsedTotal, Number(client_id)]);

          // تحديث رصيد الحساب المحاسبي للعميل في دليل الحسابات
          if (clObj && clObj.account_id) {
            run("UPDATE accounts SET balance = balance + ? WHERE id = ?", [parsedTotal, clObj.account_id]);
            run(`
              UPDATE accounts 
              SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
              WHERE code = '112'
            `);
          }
        }

        const countJE = get('SELECT COUNT(*) as cnt FROM journal_entries');
        const entryNo = `JE-${String((countJE ? countJE.cnt : 0) + 1).padStart(5, '0')}`;
        const jeRes = run(`
          INSERT INTO journal_entries (entry_no, date, description, reference_type, reference_id, total_debit, total_credit)
          VALUES (?, ?, ?, 'فاتورة آجلة', ?, ?, ?)
        `, [entryNo, date, `فاتورة مبيعات آجلة رقم ${finalInvoiceNo} (${clientNameStr})`, invoiceId, parsedTotal, parsedTotal]);

        if (jeRes && jeRes.lastInsertRowid) {
          run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, ?, ?, ?, 0, ?)`,
            [jeRes.lastInsertRowid, clientAccId, project_id || null, parsedTotal, `ذمة عميل للفاتورة الآجلة ${finalInvoiceNo} (${clientNameStr})`]
          );
          run(`INSERT INTO journal_entry_lines (entry_id, account_id, project_id, debit, credit, notes) VALUES (?, 9, ?, 0, ?, ?)`,
            [jeRes.lastInsertRowid, project_id || null, parsedTotal, `إيرادات مبيعات آجلة`]
          );
        }
      }
    }

    res.json({
      success: true,
      message: (source === 'سكانر') 
        ? `تمت أرشفة وتسجيل فاتورة السكانر بنجاح برقم (${finalInvoiceNo})` 
        : `تم إنشاء الفاتورة ال${isCash ? 'نقدية' : 'آجلة'} بنجاح برقم ${finalInvoiceNo}`,
      id: invoiceId,
      invoice_no: finalInvoiceNo,
      attachment_url: finalAttachmentUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء إنشاء / أرشفة الفاتورة: ' + err.message, error: err.message });
  }
});

// 5. إرفاق أو تعديل مستند ممسوح ضوئياً لفاتورة موجودة
router.post('/:id/attach-scan', (req, res) => {
  try {
    const inv = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    const { file_base64, filename, physical_archive_no } = req.body;
    let finalUrl = inv.attachment_url;
    let finalName = inv.attachment_name;
    let finalType = inv.attachment_type;

    if (file_base64) {
      const saved = saveBase64File(file_base64, filename);
      if (saved) {
        finalUrl = saved.url;
        finalName = saved.name;
        finalType = saved.type;
      }
    }

    run(`
      UPDATE invoices SET
        attachment_url = ?,
        attachment_name = ?,
        attachment_type = ?,
        physical_archive_no = COALESCE(?, physical_archive_no)
      WHERE id = ?
    `, [finalUrl, finalName, finalType, physical_archive_no || null, req.params.id]);

    res.json({
      success: true,
      message: 'تم إرفاق المستند الممسوح ضوئياً بنجاح',
      attachment_url: finalUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إرفاق المستند: ' + err.message });
  }
});

// 6. أرشفة / استعادة فاتورة (تبديل حالة الأرشفة)
router.put('/:id/archive', (req, res) => {
  try {
    const inv = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    const newArchived = inv.is_archived ? 0 : 1;
    const archivedAt = newArchived ? new Date().toISOString() : null;

    run('UPDATE invoices SET is_archived = ?, archived_at = ? WHERE id = ?', [newArchived, archivedAt, req.params.id]);

    res.json({
      success: true,
      message: newArchived ? 'تمت أرشفة الفاتورة وحفظها في أرشيف النظام بنجاح' : 'تم استعادة الفاتورة من الأرشيف إلى قائمة الفواتير النشطة',
      is_archived: newArchived
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ أثناء تغيير حالة أرشفة الفاتورة', error: err.message });
  }
});

// 7. حذف الفاتورة مع بنودها وعكس أثرها المالي ومسح ملف المرفق
router.delete('/:id', (req, res) => {
  try {
    const inv = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!inv) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    // عكس الأثر المالي قبل الحذف إن وجد
    if (inv.total_amount > 0) {
      if (inv.invoice_type === 'آجل' && inv.client_id) {
        run(`
          UPDATE clients SET
            total_due = MAX(0, total_due - ?),
            current_balance = MAX(0, current_balance - ?)
          WHERE id = ?
        `, [inv.total_amount, inv.total_amount, inv.client_id]);

        // عكس الأثر على الحساب المحاسبي الشجري للعميل
        const clObj = get('SELECT account_id FROM clients WHERE id = ?', [inv.client_id]);
        if (clObj && clObj.account_id) {
          run("UPDATE accounts SET balance = MAX(0, balance - ?) WHERE id = ?", [inv.total_amount, clObj.account_id]);
          run(`
            UPDATE accounts 
            SET balance = (SELECT COALESCE(SUM(balance), 0) FROM accounts WHERE parent_id = (SELECT id FROM accounts WHERE code = '112'))
            WHERE code = '112'
          `);
        }

        // حذف قيد اليومية المرتبط بالفاتورة
        try {
          const je = get("SELECT id FROM journal_entries WHERE reference_type = 'فاتورة آجلة' AND reference_id = ?", [inv.id]);
          if (je) {
            run("DELETE FROM journal_entry_lines WHERE entry_id = ?", [je.id]);
            run("DELETE FROM journal_entries WHERE id = ?", [je.id]);
          }
        } catch (jeErr) {}
      } else if (inv.invoice_type === 'نقد') {
        const lastCash = get('SELECT current_balance FROM cash_movements ORDER BY id DESC LIMIT 1') || { current_balance: 0 };
        const prevBal = Number(lastCash.current_balance) || 0;
        const newBal = prevBal - inv.total_amount;
        run(`
          INSERT INTO cash_movements (previous_balance, cash_in, cash_out, withdrawals, current_balance, date, notes)
          VALUES (?, 0, ?, 0, ?, ?, ?)
        `, [prevBal, inv.total_amount, newBal, new Date().toISOString().split('T')[0], `إلغاء/حذف فاتورة: ${inv.invoice_no}`]);
      }
    }

    // حذف بنود الفاتورة ثم الفاتورة نفسها
    run('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    run('DELETE FROM invoices WHERE id = ?', [req.params.id]);

    // مسح ملف المرفق من القرص إن وجد
    if (inv.attachment_url && inv.attachment_url.startsWith('/uploads/invoices/')) {
      try {
        const filePath = path.join(__dirname, '..', '..', inv.attachment_url.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fErr) {
        console.warn('Could not delete attachment file:', fErr.message);
      }
    }

    res.json({ success: true, message: `تم حذف الفاتورة ${inv.invoice_no} بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف الفاتورة', error: err.message });
  }
});

module.exports = router;
