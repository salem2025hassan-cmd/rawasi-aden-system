const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

function nextQuotationNo() {
  const count = get('SELECT COUNT(*) as cnt FROM quotations');
  return `QT-${new Date().getFullYear()}-${String((count?.cnt || 0) + 1).padStart(4, '0')}`;
}

router.get('/', (req, res) => {
  try {
    const rows = query(`
      SELECT q.*, c.name AS client_name, p.name AS project_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      ORDER BY q.date DESC, q.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب عروض الأسعار', error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const quotation = get(`
      SELECT q.*, c.name AS client_name, c.phone AS client_phone, c.address AS client_address, p.name AS project_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN projects p ON q.project_id = p.id
      WHERE q.id = ?
    `, [req.params.id]);
    if (!quotation) return res.status(404).json({ success: false, message: 'عرض السعر غير موجود' });
    const items = query('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC', [req.params.id]);
    res.json({ success: true, data: { ...quotation, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب عرض السعر', error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { client_id = null, project_id = null, date, valid_until = null, currency = 'ر.ي', notes = '', items = [] } = req.body;
    const cleanItems = Array.isArray(items) ? items.map(i => ({
      description: String(i.description || '').trim(),
      unit: String(i.unit || 'وحدة').trim(),
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0
    })).filter(i => i.description && i.quantity > 0).map(i => ({ ...i, total: i.quantity * i.unit_price })) : [];
    if (!cleanItems.length) return res.status(400).json({ success: false, message: 'أضف بنداً واحداً على الأقل مع الكمية' });

    const subtotal = cleanItems.reduce((s, i) => s + i.total, 0);
    const quotation_no = nextQuotationNo();
    const result = run(`INSERT INTO quotations (quotation_no, client_id, project_id, date, valid_until, subtotal, total_amount, currency, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      quotation_no, client_id ? Number(client_id) : null, project_id ? Number(project_id) : null,
      date || new Date().toISOString().split('T')[0], valid_until || null, subtotal, subtotal, currency || 'ر.ي', 'مسودة', notes
    ]);
    cleanItems.forEach(i => run(`INSERT INTO quotation_items (quotation_id, description, unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)`, [result.lastInsertRowid, i.description, i.unit, i.quantity, i.unit_price, i.total]));
    res.json({ success: true, message: 'تم حفظ عرض السعر بنجاح', id: result.lastInsertRowid, quotation_no });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حفظ عرض السعر', error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { client_id = null, project_id = null, date, valid_until = null, currency = 'ر.ي', notes = '', items = [] } = req.body;
    const cleanItems = Array.isArray(items) ? items.map(i => ({
      description: String(i.description || '').trim(),
      unit: String(i.unit || 'وحدة').trim(),
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0
    })).filter(i => i.description && i.quantity > 0).map(i => ({ ...i, total: i.quantity * i.unit_price })) : [];
    if (!cleanItems.length) return res.status(400).json({ success: false, message: 'أضف بنداً واحداً على الأقل مع الكمية والسعر' });

    const subtotal = cleanItems.reduce((s, i) => s + i.total, 0);
    const result = run(`UPDATE quotations SET client_id = ?, project_id = ?, date = ?, valid_until = ?, subtotal = ?, total_amount = ?, currency = ?, notes = ? WHERE id = ?`, [
      client_id ? Number(client_id) : null, project_id ? Number(project_id) : null,
      date || new Date().toISOString().split('T')[0], valid_until || null, subtotal, subtotal, currency || 'ر.ي', notes || '', req.params.id
    ]);
    if (!result.changes) return res.status(404).json({ success: false, message: 'عرض السعر غير موجود' });

    run('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
    cleanItems.forEach(i => run(`INSERT INTO quotation_items (quotation_id, description, unit, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)`, [req.params.id, i.description, i.unit, i.quantity, i.unit_price, i.total]));

    res.json({ success: true, message: 'تم تحديث عرض السعر بنجاح', id: req.params.id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث عرض السعر', error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id]);
    const result = run('DELETE FROM quotations WHERE id = ?', [req.params.id]);
    if (!result.changes) return res.status(404).json({ success: false, message: 'عرض السعر غير موجود' });
    res.json({ success: true, message: 'تم حذف عرض السعر' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'تعذر حذف عرض السعر', error: err.message });
  }
});

module.exports = router;
