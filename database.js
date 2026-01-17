const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'receipts.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      store_location TEXT,
      receipt_date DATE NOT NULL,
      notes TEXT,
      file_path TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      purchase_date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );
  `);
}

// Receipt CRUD
function getAllReceipts() {
  const receipts = db.prepare(`
    SELECT * FROM receipts ORDER BY receipt_date DESC
  `).all();

  const itemsStmt = db.prepare(`
    SELECT * FROM line_items WHERE receipt_id = ?
  `);

  return receipts.map(receipt => ({
    ...receipt,
    items: itemsStmt.all(receipt.id)
  }));
}

function getReceiptById(id) {
  const receipt = db.prepare(`
    SELECT * FROM receipts WHERE id = ?
  `).get(id);

  if (!receipt) return null;

  const items = db.prepare(`
    SELECT * FROM line_items WHERE receipt_id = ?
  `).all(id);

  return { ...receipt, items };
}

function createReceipt({ job_name, store_location, receipt_date, notes, file_path, file_type }) {
  const result = db.prepare(`
    INSERT INTO receipts (job_name, store_location, receipt_date, notes, file_path, file_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(job_name, store_location, receipt_date, notes, file_path, file_type);

  return getReceiptById(result.lastInsertRowid);
}

function updateReceipt(id, { job_name, store_location, receipt_date, notes, file_path, file_type }) {
  const existing = getReceiptById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE receipts
    SET job_name = ?, store_location = ?, receipt_date = ?, notes = ?,
        file_path = COALESCE(?, file_path), file_type = COALESCE(?, file_type),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(job_name, store_location, receipt_date, notes, file_path, file_type, id);

  return getReceiptById(id);
}

function deleteReceipt(id) {
  const receipt = getReceiptById(id);
  if (!receipt) return null;

  db.prepare('DELETE FROM receipts WHERE id = ?').run(id);
  return receipt;
}

// Line Item CRUD
function addLineItem(receipt_id, { item_name, purchase_date, amount }) {
  const result = db.prepare(`
    INSERT INTO line_items (receipt_id, item_name, purchase_date, amount)
    VALUES (?, ?, ?, ?)
  `).run(receipt_id, item_name, purchase_date, amount);

  return db.prepare('SELECT * FROM line_items WHERE id = ?').get(result.lastInsertRowid);
}

function updateLineItem(id, { item_name, purchase_date, amount }) {
  db.prepare(`
    UPDATE line_items SET item_name = ?, purchase_date = ?, amount = ?
    WHERE id = ?
  `).run(item_name, purchase_date, amount, id);

  return db.prepare('SELECT * FROM line_items WHERE id = ?').get(id);
}

function deleteLineItem(id) {
  const item = db.prepare('SELECT * FROM line_items WHERE id = ?').get(id);
  if (!item) return null;

  db.prepare('DELETE FROM line_items WHERE id = ?').run(id);
  return item;
}

module.exports = {
  init,
  getAllReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  deleteReceipt,
  addLineItem,
  updateLineItem,
  deleteLineItem
};
