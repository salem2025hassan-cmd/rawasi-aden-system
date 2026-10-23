const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

/**
 * توليد رقم تسلسلي تلقائي لجدول الكميات
 */
function nextBoqNo() {
  const count = get('SELECT COUNT(*) as cnt FROM boq_projects');
  const year = new Date().getFullYear();
  return `BOQ-${year}-${String((count?.cnt || 0) + 1).padStart(4, '0')}`;
}

/**
 * جلب جميع جداول الكميات مع بيانات المشاريع والعملاء
 */
router.get('/', (req, res) => {
  try {
    const { project_id, client_id, status } = req.query;
    let sql = `
      SELECT b.*, 
             p.name AS project_name, p.code AS project_code,
             c.name AS client_name, c.phone AS client_phone,
             (SELECT COUNT(*) FROM boq_items WHERE boq_id = b.id) AS items_count
      FROM boq_projects b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND b.project_id = ?';
      params.push(project_id);
    }
    if (client_id) {
      sql += ' AND b.client_id = ?';
      params.push(client_id);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY b.date DESC, b.id DESC';

    const rows = query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching BOQ list:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب جداول الكميات', error: err.message });
  }
});

/**
 * جلب جدول كميات محدد بالتفصيل مع كافة بنوده
 */
router.get('/:id', (req, res) => {
  try {
    const boq = get(`
      SELECT b.*, 
             p.name AS project_name, p.code AS project_code, p.contract_value AS project_contract_value,
             c.name AS client_name, c.phone AS client_phone, c.address AS client_address
      FROM boq_projects b
      LEFT JOIN projects p ON b.project_id = p.id
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!boq) {
      return res.status(404).json({ success: false, message: 'جدول الكميات غير موجود' });
    }

    const items = query(`
      SELECT * FROM boq_items 
      WHERE boq_id = ? 
      ORDER BY item_order ASC, id ASC
    `, [req.params.id]);

    res.json({ success: true, data: { ...boq, items } });
  } catch (err) {
    console.error('Error fetching BOQ details:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب تفاصيل جدول الكميات', error: err.message });
  }
});

/**
 * حفظ جدول كميات جديد مع بنوده
 */
router.post('/', (req, res) => {
  try {
    const {
      project_id = null,
      client_id = null,
      title,
      date,
      currency = 'ر.ي',
      status = 'نشط',
      notes = '',
      items = []
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان أو وصف جدول الكميات' });
    }

    const cleanItems = Array.isArray(items) ? items.map((i, idx) => ({
      item_order: Number(i.item_order) || (idx + 1),
      category: String(i.category || 'عام').trim(),
      description: String(i.description || '').trim(),
      unit: String(i.unit || 'وحدة').trim(),
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      executed_qty: Number(i.executed_qty) || 0,
      notes: String(i.notes || '').trim()
    })).filter(i => i.description && i.quantity > 0).map(i => ({
      ...i,
      total: i.quantity * i.unit_price
    })) : [];

    if (!cleanItems.length) {
      return res.status(400).json({ success: false, message: 'يرجى إضافة بند واحد على الأقل مع الكمية' });
    }

    const total_amount = cleanItems.reduce((sum, it) => sum + it.total, 0);
    const executed_amount = cleanItems.reduce((sum, it) => sum + (it.executed_qty * it.unit_price), 0);
    const boq_no = nextBoqNo();

    const result = run(`
      INSERT INTO boq_projects (
        boq_no, project_id, client_id, title, date, currency, total_amount, executed_amount, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      boq_no,
      project_id ? Number(project_id) : null,
      client_id ? Number(client_id) : null,
      title.trim(),
      date || new Date().toISOString().split('T')[0],
      currency || 'ر.ي',
      total_amount,
      executed_amount,
      status || 'نشط',
      notes || ''
    ]);

    const boqId = result.lastInsertRowid;

    for (const it of cleanItems) {
      run(`
        INSERT INTO boq_items (
          boq_id, item_order, category, description, unit, quantity, unit_price, total, executed_qty, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        boqId,
        it.item_order,
        it.category,
        it.description,
        it.unit,
        it.quantity,
        it.unit_price,
        it.total,
        it.executed_qty,
        it.notes
      ]);
    }

    res.json({
      success: true,
      message: 'تم حفظ جدول الكميات بنجاح',
      id: boqId,
      boq_no
    });
  } catch (err) {
    console.error('Error saving BOQ:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ جدول الكميات', error: err.message });
  }
});

/**
 * تعديل جدول كميات وبنوده
 */
router.put('/:id', (req, res) => {
  try {
    const {
      project_id = null,
      client_id = null,
      title,
      date,
      currency = 'ر.ي',
      status = 'نشط',
      notes = '',
      items = []
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان أو وصف جدول الكميات' });
    }

    const cleanItems = Array.isArray(items) ? items.map((i, idx) => ({
      item_order: Number(i.item_order) || (idx + 1),
      category: String(i.category || 'عام').trim(),
      description: String(i.description || '').trim(),
      unit: String(i.unit || 'وحدة').trim(),
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      executed_qty: Number(i.executed_qty) || 0,
      notes: String(i.notes || '').trim()
    })).filter(i => i.description && i.quantity > 0).map(i => ({
      ...i,
      total: i.quantity * i.unit_price
    })) : [];

    if (!cleanItems.length) {
      return res.status(400).json({ success: false, message: 'يرجى إضافة بند واحد على الأقل مع الكمية' });
    }

    const total_amount = cleanItems.reduce((sum, it) => sum + it.total, 0);
    const executed_amount = cleanItems.reduce((sum, it) => sum + (it.executed_qty * it.unit_price), 0);

    const result = run(`
      UPDATE boq_projects 
      SET project_id = ?, client_id = ?, title = ?, date = ?, currency = ?, 
          total_amount = ?, executed_amount = ?, status = ?, notes = ?
      WHERE id = ?
    `, [
      project_id ? Number(project_id) : null,
      client_id ? Number(client_id) : null,
      title.trim(),
      date || new Date().toISOString().split('T')[0],
      currency || 'ر.ي',
      total_amount,
      executed_amount,
      status || 'نشط',
      notes || '',
      req.params.id
    ]);

    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'جدول الكميات غير موجود' });
    }

    // استبدال البنود السابقة
    run('DELETE FROM boq_items WHERE boq_id = ?', [req.params.id]);

    for (const it of cleanItems) {
      run(`
        INSERT INTO boq_items (
          boq_id, item_order, category, description, unit, quantity, unit_price, total, executed_qty, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.params.id,
        it.item_order,
        it.category,
        it.description,
        it.unit,
        it.quantity,
        it.unit_price,
        it.total,
        it.executed_qty,
        it.notes
      ]);
    }

    res.json({
      success: true,
      message: 'تم تحديث جدول الكميات بنجاح',
      id: req.params.id
    });
  } catch (err) {
    console.error('Error updating BOQ:', err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث جدول الكميات', error: err.message });
  }
});

/**
 * تحديث نسب الإنجاز الميداني للكميات المنفذة
 */
router.put('/:id/progress', (req, res) => {
  try {
    const { items = [] } = req.body;
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it.id && it.executed_qty !== undefined) {
          run('UPDATE boq_items SET executed_qty = ? WHERE id = ? AND boq_id = ?', [
            Number(it.executed_qty) || 0,
            it.id,
            req.params.id
          ]);
        }
      }
    }

    // إعادة حساب إجمالي المنفذ
    const itemsRows = query('SELECT unit_price, executed_qty FROM boq_items WHERE boq_id = ?', [req.params.id]);
    const executed_amount = itemsRows.reduce((sum, it) => sum + ((Number(it.executed_qty) || 0) * (Number(it.unit_price) || 0)), 0);

    run('UPDATE boq_projects SET executed_amount = ? WHERE id = ?', [executed_amount, req.params.id]);

    res.json({ success: true, message: 'تم تحديث نسب الإنجاز بنجاح', executed_amount });
  } catch (err) {
    console.error('Error updating BOQ progress:', err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الإنجاز', error: err.message });
  }
});

/**
 * حذف جدول الكميات
 */
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM boq_items WHERE boq_id = ?', [req.params.id]);
    const result = run('DELETE FROM boq_projects WHERE id = ?', [req.params.id]);
    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'جدول الكميات غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف جدول الكميات بنجاح' });
  } catch (err) {
    console.error('Error deleting BOQ:', err);
    res.status(500).json({ success: false, message: 'تعذر حذف جدول الكميات', error: err.message });
  }
});

module.exports = router;
