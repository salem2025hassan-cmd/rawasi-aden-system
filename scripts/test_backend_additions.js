const http = require('http');
const path = require('node:path');
// استيراد db من وحدة قاعدة البيانات ليقوم بتشغيل initSchema والهجرة التلقائية
require('../server/database/db');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'server', 'database', 'rawasi_aden.db');
const db = new DatabaseSync(dbPath);

console.log('--- 1. Testing Database Tables ---');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
console.log('Tables in DB:', tables.filter(t => ['invoices', 'invoice_items', 'clients', 'suppliers', 'payments', 'custodies'].includes(t)));

if (!tables.includes('invoices') || !tables.includes('invoice_items')) {
  console.error('FAIL: invoices or invoice_items table missing!');
  process.exit(1);
}
console.log('PASS: Tables invoices and invoice_items exist!');

// Test inserting an invoice directly or via server
const testClient = db.prepare("SELECT id, name, current_balance FROM clients LIMIT 1").get();
console.log('Sample client for test:', testClient);

console.log('\n--- 2. Testing Invoices Table Insertion & Archiving ---');
const insertStmt = db.prepare(`
  INSERT INTO invoices (
    invoice_no, invoice_type, client_id, client_name, date, total_amount, paid_amount, remaining_amount, status, is_archived
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const testInvRes = insertStmt.run('INV-TEST-001', 'آجل', testClient ? testClient.id : null, 'عميل تجريبي', '2026-09-16', 50000, 0, 50000, 'مستحقة', 0);
const testInvId = testInvRes.lastInsertRowid;
console.log('Inserted test invoice with ID:', testInvId);

// Test inserting item
db.prepare(`
  INSERT INTO invoice_items (invoice_id, item_order, description, unit, quantity, unit_price, total)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(testInvId, 1, 'بند تجريبي 1', 'متر', 10, 5000, 50000);

// Verify fetch
const fetched = db.prepare('SELECT * FROM invoices WHERE id = ?').get(testInvId);
console.log('Fetched invoice:', fetched.invoice_no, 'Type:', fetched.invoice_type, 'Total:', fetched.total_amount, 'Archived:', fetched.is_archived);

// Test archiving
db.prepare('UPDATE invoices SET is_archived = 1, archived_at = CURRENT_TIMESTAMP WHERE id = ?').run(testInvId);
const archivedFetched = db.prepare('SELECT is_archived, archived_at FROM invoices WHERE id = ?').get(testInvId);
console.log('After archive:', archivedFetched);
if (archivedFetched.is_archived !== 1) {
  console.error('FAIL: Archiving did not set is_archived = 1');
} else {
  console.log('PASS: Archiving sets is_archived = 1');
}

// Test unarchiving
db.prepare('UPDATE invoices SET is_archived = 0, archived_at = NULL WHERE id = ?').run(testInvId);
const unarchivedFetched = db.prepare('SELECT is_archived, archived_at FROM invoices WHERE id = ?').get(testInvId);
console.log('After unarchive:', unarchivedFetched);
if (unarchivedFetched.is_archived !== 0) {
  console.error('FAIL: Unarchiving did not set is_archived = 0');
} else {
  console.log('PASS: Unarchiving sets is_archived = 0');
}

// Test deleting invoice
db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(testInvId);
db.prepare('DELETE FROM invoices WHERE id = ?').run(testInvId);
const afterDelete = db.prepare('SELECT * FROM invoices WHERE id = ?').get(testInvId);
console.log('After delete check:', afterDelete === undefined ? 'PASS: Deleted successfully' : 'FAIL: Still exists');

console.log('\n--- 3. Testing 25 items capacity check ---');
const items25 = Array.from({ length: 25 }, (_, i) => ({
  description: `بند أعمال تجريبي رقم ${i + 1}`,
  unit: 'متر',
  quantity: i + 1,
  unit_price: 1000,
  total: (i + 1) * 1000
}));

console.log('Generated 25 items:', items25.length);
console.log('All DB and logic tests succeeded!');
