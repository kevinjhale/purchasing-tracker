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
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER,
      job_name TEXT,
      store_location TEXT,
      receipt_date DATE NOT NULL,
      notes TEXT,
      file_path TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      purchase_date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );
  `);

  // Migration: add quantity column if it doesn't exist
  const lineItemColumns = db.prepare("PRAGMA table_info(line_items)").all();
  if (!lineItemColumns.find(c => c.name === 'quantity')) {
    db.exec("ALTER TABLE line_items ADD COLUMN quantity INTEGER DEFAULT 1");
  }

  // Migration: add job_id column if it doesn't exist
  const receiptColumns = db.prepare("PRAGMA table_info(receipts)").all();
  if (!receiptColumns.find(c => c.name === 'job_id')) {
    db.exec("ALTER TABLE receipts ADD COLUMN job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL");
  }

  // Migration: create jobs from existing job_names and link receipts
  const unmigrated = db.prepare("SELECT DISTINCT job_name FROM receipts WHERE job_id IS NULL AND job_name IS NOT NULL").all();
  if (unmigrated.length > 0) {
    const insertJob = db.prepare("INSERT OR IGNORE INTO jobs (name) VALUES (?)");
    const getJobId = db.prepare("SELECT id FROM jobs WHERE name = ?");
    const updateReceipts = db.prepare("UPDATE receipts SET job_id = ? WHERE job_name = ? AND job_id IS NULL");

    for (const { job_name } of unmigrated) {
      insertJob.run(job_name);
      const job = getJobId.get(job_name);
      if (job) {
        updateReceipts.run(job.id, job_name);
      }
    }
  }
}

// Jobs CRUD
function getAllJobs() {
  return db.prepare(`
    SELECT j.*,
      COUNT(r.id) as receipt_count,
      COALESCE(SUM((SELECT COALESCE(SUM(li.amount), 0) FROM line_items li WHERE li.receipt_id = r.id)), 0) as total_amount
    FROM jobs j
    LEFT JOIN receipts r ON r.job_id = j.id
    GROUP BY j.id
    ORDER BY j.updated_at DESC
  `).all();
}

function getJobById(id) {
  return db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id);
}

function createJob(name) {
  const result = db.prepare(`
    INSERT INTO jobs (name) VALUES (?)
  `).run(name);
  return getJobById(result.lastInsertRowid);
}

function updateJob(id, name) {
  const existing = getJobById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE jobs SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(name, id);

  return getJobById(id);
}

function deleteJob(id) {
  const job = getJobById(id);
  if (!job) return null;

  // Get receipts to return file paths for cleanup
  const receipts = db.prepare(`SELECT id, file_path FROM receipts WHERE job_id = ?`).all(id);

  // Delete receipts (cascade will handle line items)
  db.prepare('DELETE FROM receipts WHERE job_id = ?').run(id);

  // Delete job
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);

  return { job, receipts };
}

// Receipt CRUD
function getAllReceipts() {
  const receipts = db.prepare(`
    SELECT r.*, j.name as job_name
    FROM receipts r
    LEFT JOIN jobs j ON r.job_id = j.id
    ORDER BY r.receipt_date DESC
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
    SELECT r.*, j.name as job_name
    FROM receipts r
    LEFT JOIN jobs j ON r.job_id = j.id
    WHERE r.id = ?
  `).get(id);

  if (!receipt) return null;

  const items = db.prepare(`
    SELECT * FROM line_items WHERE receipt_id = ?
  `).all(id);

  return { ...receipt, items };
}

function getReceiptsByJobId(jobId) {
  const receipts = db.prepare(`
    SELECT r.*, j.name as job_name
    FROM receipts r
    LEFT JOIN jobs j ON r.job_id = j.id
    WHERE r.job_id = ?
    ORDER BY r.receipt_date DESC
  `).all(jobId);

  const itemsStmt = db.prepare(`
    SELECT * FROM line_items WHERE receipt_id = ?
  `);

  return receipts.map(receipt => ({
    ...receipt,
    items: itemsStmt.all(receipt.id)
  }));
}

function createReceipt({ job_id, store_location, receipt_date, notes, file_path, file_type }) {
  const result = db.prepare(`
    INSERT INTO receipts (job_id, store_location, receipt_date, notes, file_path, file_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(job_id, store_location, receipt_date, notes, file_path, file_type);

  return getReceiptById(result.lastInsertRowid);
}

function updateReceipt(id, { job_id, store_location, receipt_date, notes, file_path, file_type }) {
  const existing = getReceiptById(id);
  if (!existing) return null;

  db.prepare(`
    UPDATE receipts
    SET job_id = ?, store_location = ?, receipt_date = ?, notes = ?,
        file_path = COALESCE(?, file_path), file_type = COALESCE(?, file_type),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(job_id, store_location, receipt_date, notes, file_path, file_type, id);

  return getReceiptById(id);
}

function deleteReceipt(id) {
  const receipt = getReceiptById(id);
  if (!receipt) return null;

  db.prepare('DELETE FROM receipts WHERE id = ?').run(id);
  return receipt;
}

// Line Item CRUD
function addLineItem(receipt_id, { item_name, purchase_date, amount, quantity = 1 }) {
  const result = db.prepare(`
    INSERT INTO line_items (receipt_id, item_name, purchase_date, amount, quantity)
    VALUES (?, ?, ?, ?, ?)
  `).run(receipt_id, item_name, purchase_date, amount, quantity);

  return db.prepare('SELECT * FROM line_items WHERE id = ?').get(result.lastInsertRowid);
}

function updateLineItem(id, { item_name, purchase_date, amount, quantity = 1 }) {
  db.prepare(`
    UPDATE line_items SET item_name = ?, purchase_date = ?, amount = ?, quantity = ?
    WHERE id = ?
  `).run(item_name, purchase_date, amount, quantity, id);

  return db.prepare('SELECT * FROM line_items WHERE id = ?').get(id);
}

function deleteLineItem(id) {
  const item = db.prepare('SELECT * FROM line_items WHERE id = ?').get(id);
  if (!item) return null;

  db.prepare('DELETE FROM line_items WHERE id = ?').run(id);
  return item;
}

function getAllItems() {
  return db.prepare(`
    SELECT
      li.id,
      li.item_name,
      li.purchase_date,
      li.amount,
      li.quantity,
      li.receipt_id,
      j.name as job_name,
      r.store_location
    FROM line_items li
    JOIN receipts r ON li.receipt_id = r.id
    LEFT JOIN jobs j ON r.job_id = j.id
    ORDER BY li.purchase_date DESC
  `).all();
}

module.exports = {
  init,
  // Jobs
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  // Receipts
  getAllReceipts,
  getReceiptById,
  getReceiptsByJobId,
  createReceipt,
  updateReceipt,
  deleteReceipt,
  // Line Items
  addLineItem,
  updateLineItem,
  deleteLineItem,
  getAllItems
};
