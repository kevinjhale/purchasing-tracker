const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];
  // Also allow by extension for CSV files
  const isCSV = file.originalname.toLowerCase().endsWith('.csv');
  cb(null, allowed.includes(file.mimetype) || isCSV);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

// Initialize database
db.init();

// API Routes

// Get all receipts
app.get('/api/receipts', (req, res) => {
  try {
    const receipts = db.getAllReceipts();
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single receipt
app.get('/api/receipts/:id', (req, res) => {
  try {
    const receipt = db.getReceiptById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create receipt
app.post('/api/receipts', upload.single('file'), (req, res) => {
  try {
    const { job_name, store_location, receipt_date, notes, imported_file_path, imported_file_type } = req.body;
    if (!job_name || !receipt_date) {
      return res.status(400).json({ error: 'Job name and date are required' });
    }

    // Use uploaded file, or imported file reference
    const file_path = req.file ? req.file.filename : (imported_file_path || null);
    const file_type = req.file ? req.file.mimetype : (imported_file_type || null);

    const receipt = db.createReceipt({
      job_name, store_location, receipt_date, notes, file_path, file_type
    });
    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update receipt
app.put('/api/receipts/:id', upload.single('file'), (req, res) => {
  try {
    const { job_name, store_location, receipt_date, notes } = req.body;
    if (!job_name || !receipt_date) {
      return res.status(400).json({ error: 'Job name and date are required' });
    }

    const file_path = req.file ? req.file.filename : null;
    const file_type = req.file ? req.file.mimetype : null;

    const receipt = db.updateReceipt(req.params.id, {
      job_name, store_location, receipt_date, notes, file_path, file_type
    });
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete receipt
app.delete('/api/receipts/:id', (req, res) => {
  try {
    const receipt = db.deleteReceipt(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    // Delete associated file
    if (receipt.file_path) {
      const filePath = path.join(uploadsDir, receipt.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Receipt deleted', receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add line item
app.post('/api/receipts/:id/items', (req, res) => {
  try {
    const { item_name, purchase_date, amount, quantity } = req.body;
    if (!item_name || !purchase_date || amount === undefined) {
      return res.status(400).json({ error: 'Item name, date, and amount are required' });
    }

    const receipt = db.getReceiptById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    const item = db.addLineItem(req.params.id, { item_name, purchase_date, amount, quantity: quantity || 1 });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update line item
app.put('/api/items/:id', (req, res) => {
  try {
    const { item_name, purchase_date, amount, quantity } = req.body;
    if (!item_name || !purchase_date || amount === undefined) {
      return res.status(400).json({ error: 'Item name, date, and amount are required' });
    }

    const item = db.updateLineItem(req.params.id, { item_name, purchase_date, amount, quantity: quantity || 1 });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete line item
app.delete('/api/items/:id', (req, res) => {
  try {
    const item = db.deleteLineItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted', item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all items with receipt details
app.get('/api/items', (req, res) => {
  try {
    const items = db.getAllItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload CSV file (for import)
app.post('/api/upload-csv', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({
      file_path: req.file.filename,
      file_type: req.file.mimetype
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename job (updates all receipts with that job name)
app.put('/api/jobs/:name', (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { new_name } = req.body;

    if (!new_name || !new_name.trim()) {
      return res.status(400).json({ error: 'New job name is required' });
    }

    const changes = db.renameJob(oldName, new_name.trim());
    if (changes === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ message: 'Job renamed', old_name: oldName, new_name: new_name.trim(), receipts_updated: changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete job (deletes all receipts and their files)
app.delete('/api/jobs/:name', (req, res) => {
  try {
    const jobName = decodeURIComponent(req.params.name);
    const receipts = db.deleteJob(jobName);

    if (receipts.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Delete associated files
    for (const receipt of receipts) {
      if (receipt.file_path) {
        const filePath = path.join(uploadsDir, receipt.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    res.json({ message: 'Job deleted', job_name: jobName, receipts_deleted: receipts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
