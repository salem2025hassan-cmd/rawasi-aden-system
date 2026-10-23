const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

/**
 * توليد رقم تسلسلي تلقائي للعقد الهندسي
 */
function nextContractNo() {
  const count = get('SELECT COUNT(*) as cnt FROM project_contracts');
  const year = new Date().getFullYear();
  return `CON-${year}-${String((count?.cnt || 0) + 1).padStart(4, '0')}`;
}

/**
 * جلب قائمة العقود مع أسماء المشاريع والعملاء
 */
router.get('/', (req, res) => {
  try {
    const { project_id, client_id, status } = req.query;
    let sql = `
      SELECT c.*, 
             p.name AS project_name, p.code AS project_code,
             cl.name AS client_name, cl.phone AS client_phone, cl.address AS client_address
      FROM project_contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      sql += ' AND c.project_id = ?';
      params.push(project_id);
    }
    if (client_id) {
      sql += ' AND c.client_id = ?';
      params.push(client_id);
    }
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.contract_date DESC, c.id DESC';

    const rows = query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching contracts list:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب عقود المشاريع', error: err.message });
  }
});

/**
 * جلب عقد محدد بالتفصيل
 */
router.get('/:id', (req, res) => {
  try {
    const contract = get(`
      SELECT c.*, 
             p.name AS project_name, p.code AS project_code,
             cl.name AS client_name, cl.phone AS client_phone, cl.address AS client_address, cl.company AS client_company
      FROM project_contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!contract) {
      return res.status(404).json({ success: false, message: 'العقد غير موجود' });
    }

    res.json({ success: true, data: contract });
  } catch (err) {
    console.error('Error fetching contract details:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب تفاصيل العقد', error: err.message });
  }
});

/**
 * حفظ عقد جديد
 */
router.post('/', (req, res) => {
  try {
    const {
      project_id = null,
      client_id = null,
      title,
      first_party = 'شركة رواسي عدن للهندسة والمقاولات',
      first_party_rep = 'المدير العام',
      second_party = '',
      second_party_rep = '',
      second_party_phone = '',
      second_party_address = '',
      project_location = '',
      contract_date,
      start_date = null,
      completion_date = null,
      duration_days = 0,
      total_amount = 0,
      currency = 'ر.ي',
      advance_payment = 0,
      retention_percent = 5,
      payment_terms = '',
      conditions = '',
      status = 'ساري',
      notes = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان العقد' });
    }
    if (!second_party || !second_party.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد الطرف الثاني (العميل / المالك)' });
    }

    const contract_no = nextContractNo();
    const cleanAmount = Number(total_amount) || 0;
    const cleanAdvance = Number(advance_payment) || 0;
    const cleanRetention = Number(retention_percent) || 0;
    const cleanDuration = Number(duration_days) || 0;

    const result = run(`
      INSERT INTO project_contracts (
        contract_no, project_id, client_id, title, first_party, first_party_rep,
        second_party, second_party_rep, second_party_phone, second_party_address,
        project_location, contract_date, start_date, completion_date, duration_days,
        total_amount, currency, advance_payment, retention_percent, payment_terms,
        conditions, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      contract_no,
      project_id ? Number(project_id) : null,
      client_id ? Number(client_id) : null,
      title.trim(),
      first_party || 'شركة رواسي عدن للهندسة والمقاولات',
      first_party_rep || 'المدير العام',
      second_party.trim(),
      second_party_rep || '',
      second_party_phone || '',
      second_party_address || '',
      project_location || '',
      contract_date || new Date().toISOString().split('T')[0],
      start_date || null,
      completion_date || null,
      cleanDuration,
      cleanAmount,
      currency || 'ر.ي',
      cleanAdvance,
      cleanRetention,
      payment_terms || '',
      conditions || '',
      status || 'ساري',
      notes || ''
    ]);

    // إذا كان العقد مرتبطاً بمشروع، نقوم بتحديث قيمة العقد في جدول المشاريع تلقائياً
    if (project_id && cleanAmount > 0) {
      try {
        run('UPDATE projects SET contract_value = ? WHERE id = ?', [cleanAmount, Number(project_id)]);
      } catch (e) {
        console.warn('Note: Could not update project contract_value:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'تم حفظ وتوثيق العقد بنجاح',
      id: result.lastInsertRowid,
      contract_no
    });
  } catch (err) {
    console.error('Error saving contract:', err);
    res.status(500).json({ success: false, message: 'خطأ في حفظ العقد', error: err.message });
  }
});

/**
 * تعديل عقد مسجل
 */
router.put('/:id', (req, res) => {
  try {
    const {
      project_id = null,
      client_id = null,
      title,
      first_party = 'شركة رواسي عدن للهندسة والمقاولات',
      first_party_rep = 'المدير العام',
      second_party = '',
      second_party_rep = '',
      second_party_phone = '',
      second_party_address = '',
      project_location = '',
      contract_date,
      start_date = null,
      completion_date = null,
      duration_days = 0,
      total_amount = 0,
      currency = 'ر.ي',
      advance_payment = 0,
      retention_percent = 5,
      payment_terms = '',
      conditions = '',
      status = 'ساري',
      notes = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان العقد' });
    }

    const cleanAmount = Number(total_amount) || 0;
    const cleanAdvance = Number(advance_payment) || 0;
    const cleanRetention = Number(retention_percent) || 0;
    const cleanDuration = Number(duration_days) || 0;

    const result = run(`
      UPDATE project_contracts SET
        project_id = ?, client_id = ?, title = ?, first_party = ?, first_party_rep = ?,
        second_party = ?, second_party_rep = ?, second_party_phone = ?, second_party_address = ?,
        project_location = ?, contract_date = ?, start_date = ?, completion_date = ?, duration_days = ?,
        total_amount = ?, currency = ?, advance_payment = ?, retention_percent = ?, payment_terms = ?,
        conditions = ?, status = ?, notes = ?
      WHERE id = ?
    `, [
      project_id ? Number(project_id) : null,
      client_id ? Number(client_id) : null,
      title.trim(),
      first_party || 'شركة رواسي عدن للهندسة والمقاولات',
      first_party_rep || 'المدير العام',
      second_party.trim(),
      second_party_rep || '',
      second_party_phone || '',
      second_party_address || '',
      project_location || '',
      contract_date || new Date().toISOString().split('T')[0],
      start_date || null,
      completion_date || null,
      cleanDuration,
      cleanAmount,
      currency || 'ر.ي',
      cleanAdvance,
      cleanRetention,
      payment_terms || '',
      conditions || '',
      status || 'ساري',
      notes || '',
      req.params.id
    ]);

    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'العقد غير موجود' });
    }

    // تحديث قيمة العقد في جدول المشاريع إذا وُجد
    if (project_id && cleanAmount > 0) {
      try {
        run('UPDATE projects SET contract_value = ? WHERE id = ?', [cleanAmount, Number(project_id)]);
      } catch (e) {
        console.warn('Note: Could not update project contract_value:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'تم تحديث العقد بنجاح',
      id: req.params.id
    });
  } catch (err) {
    console.error('Error updating contract:', err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث العقد', error: err.message });
  }
});

/**
 * حذف العقد
 */
router.delete('/:id', (req, res) => {
  try {
    const result = run('DELETE FROM project_contracts WHERE id = ?', [req.params.id]);
    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'العقد غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف العقد بنجاح' });
  } catch (err) {
    console.error('Error deleting contract:', err);
    res.status(500).json({ success: false, message: 'تعذر حذف العقد', error: err.message });
  }
});

module.exports = router;
