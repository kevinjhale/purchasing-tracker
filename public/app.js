const API = '/api';

// DOM Elements
const receiptList = document.getElementById('receiptList');
const jobsList = document.getElementById('jobsList');
const jobsListView = document.getElementById('jobsListView');
const jobDetailView = document.getElementById('jobDetailView');
const receiptModal = document.getElementById('receiptModal');
const itemsModal = document.getElementById('itemsModal');
const deleteModal = document.getElementById('deleteModal');
const previewModal = document.getElementById('previewModal');
const jobEditModal = document.getElementById('jobEditModal');
const receiptForm = document.getElementById('receiptForm');
const itemForm = document.getElementById('itemForm');
const jobEditForm = document.getElementById('jobEditForm');

let jobs = [];
let receipts = [];
let allItems = [];
let deleteTarget = null;
let searchQuery = '';
let itemsSearchQuery = '';
let sortColumn = 'purchase_date';
let sortDirection = 'desc';
let currentRotation = 0;
let selectedFile = null;
let modalCsvData = null;
let modalCsvHeaders = [];
let modalCsvRawLines = [];
let modalCsvFile = null;
let currentJobId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadJobs();
  loadReceipts();
  setupEventListeners();
});

function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('searchInput');
  const clearSearch = document.getElementById('clearSearch');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    clearSearch.hidden = !searchQuery;
    if (currentJobId) {
      renderReceipts();
    } else {
      renderJobs();
    }
  });

  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearch.hidden = true;
    if (currentJobId) {
      renderReceipts();
    } else {
      renderJobs();
    }
  });

  // Items search
  const itemsSearchInput = document.getElementById('itemsSearchInput');
  const clearItemsSearch = document.getElementById('clearItemsSearch');

  itemsSearchInput.addEventListener('input', (e) => {
    itemsSearchQuery = e.target.value.toLowerCase();
    clearItemsSearch.hidden = !itemsSearchQuery;
    renderAllItems();
  });

  clearItemsSearch.addEventListener('click', () => {
    itemsSearchInput.value = '';
    itemsSearchQuery = '';
    clearItemsSearch.hidden = true;
    renderAllItems();
  });

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Sortable columns
  document.querySelectorAll('.all-items-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }
      renderAllItems();
    });
  });

  // New receipt button
  document.getElementById('newReceiptBtn').addEventListener('click', () => openReceiptModal());

  // Receipt form
  receiptForm.addEventListener('submit', handleReceiptSubmit);
  document.getElementById('cancelBtn').addEventListener('click', () => closeModal(receiptModal));

  // File preview and rotation
  document.getElementById('receiptFile').addEventListener('change', handleFileSelect);
  document.getElementById('rotateLeftBtn').addEventListener('click', () => rotateImage(-90));
  document.getElementById('rotateRightBtn').addEventListener('click', () => rotateImage(90));

  // Item form
  itemForm.addEventListener('submit', handleItemSubmit);

  // Delete modal
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal(deleteModal));
  document.getElementById('confirmDeleteBtn').addEventListener('click', handleDelete);

  // Close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal')));
  });

  // Back to jobs button
  document.getElementById('backToJobsBtn').addEventListener('click', showJobsList);

  // Job edit form
  jobEditForm.addEventListener('submit', handleJobEditSubmit);
  document.getElementById('cancelJobEditBtn').addEventListener('click', () => closeModal(jobEditModal));

  // New job buttons
  document.getElementById('newJobBtn').addEventListener('click', () => openJobEdit(null));
  document.getElementById('newJobListBtn').addEventListener('click', () => openJobEdit(null));

  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

// API Functions
async function loadJobs() {
  try {
    const res = await fetch(`${API}/jobs`);
    jobs = await res.json();
    updateJobSelect();
    if (!currentJobId) {
      renderJobs();
    }
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadReceipts() {
  try {
    const res = await fetch(`${API}/receipts`);
    receipts = await res.json();
    if (currentJobId) {
      renderReceipts();
    }
    updateDataLists();
  } catch (err) {
    console.error('Failed to load receipts:', err);
  }
}

function updateJobSelect() {
  const select = document.getElementById('jobSelect');
  const currentValue = select.value;

  select.innerHTML = '<option value="">Select a job...</option>' +
    jobs.map(job => `<option value="${job.id}">${escapeHtml(job.name)}</option>`).join('');

  // Restore selection if still valid
  if (currentValue && jobs.find(j => j.id === parseInt(currentValue))) {
    select.value = currentValue;
  }
}

async function loadAllItems() {
  try {
    const res = await fetch(`${API}/items`);
    allItems = await res.json();
    renderAllItems();
  } catch (err) {
    console.error('Failed to load items:', err);
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.hidden = true);

  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'receipts') {
    document.getElementById('receiptsTab').hidden = false;
  } else {
    document.getElementById('itemsTab').hidden = false;
    loadAllItems();
  }
}

function updateDataLists() {
  const storeLocations = [...new Set(receipts.map(r => r.store_location).filter(Boolean))];

  document.getElementById('storeLocationList').innerHTML =
    storeLocations.map(loc => `<option value="${escapeHtml(loc)}">`).join('');
}

function getFilteredReceipts() {
  // Filter by current job first
  let filtered = currentJobId
    ? receipts.filter(r => r.job_id === currentJobId)
    : receipts;

  // Then filter by search query
  if (searchQuery) {
    filtered = filtered.filter(receipt => {
      const storeMatch = receipt.store_location?.toLowerCase().includes(searchQuery);
      const dateMatch = receipt.receipt_date?.includes(searchQuery);
      const idMatch = String(receipt.id).includes(searchQuery);
      return storeMatch || dateMatch || idMatch;
    });
  }

  return filtered;
}

function getFilteredJobs() {
  if (!searchQuery) return jobs;

  return jobs.filter(job =>
    job.name.toLowerCase().includes(searchQuery)
  );
}

function getFilteredAndSortedItems() {
  let items = [...allItems];

  // Filter
  if (itemsSearchQuery) {
    items = items.filter(item => {
      const nameMatch = item.item_name?.toLowerCase().includes(itemsSearchQuery);
      const storeMatch = item.store_location?.toLowerCase().includes(itemsSearchQuery);
      const jobMatch = item.job_name?.toLowerCase().includes(itemsSearchQuery);
      return nameMatch || storeMatch || jobMatch;
    });
  }

  // Sort
  items.sort((a, b) => {
    let aVal, bVal;

    if (sortColumn === 'unit_price') {
      aVal = parseFloat(a.amount) / (a.quantity || 1);
      bVal = parseFloat(b.amount) / (b.quantity || 1);
    } else if (sortColumn === 'amount' || sortColumn === 'quantity') {
      aVal = parseFloat(a[sortColumn]) || 0;
      bVal = parseFloat(b[sortColumn]) || 0;
    } else if (sortColumn === 'purchase_date') {
      aVal = new Date(a[sortColumn]);
      bVal = new Date(b[sortColumn]);
    } else {
      aVal = (a[sortColumn] || '').toLowerCase();
      bVal = (b[sortColumn] || '').toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return items;
}

async function saveReceipt(formData, id) {
  const url = id ? `${API}/receipts/${id}` : `${API}/receipts`;
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, { method, body: formData });
  if (!res.ok) throw new Error('Failed to save receipt');
  return res.json();
}

async function deleteReceipt(id) {
  const res = await fetch(`${API}/receipts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete receipt');
}

async function saveItem(receiptId, data, itemId) {
  const url = itemId ? `${API}/items/${itemId}` : `${API}/receipts/${receiptId}/items`;
  const method = itemId ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save item');
  return res.json();
}

async function deleteItem(id) {
  const res = await fetch(`${API}/items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete item');
}

// Render Functions
function renderJobs() {
  const filtered = getFilteredJobs();

  if (jobs.length === 0) {
    jobsList.innerHTML = '<div class="empty-state"><p>No jobs yet. Click "+ New Receipt" to add one.</p></div>';
    return;
  }

  if (filtered.length === 0) {
    jobsList.innerHTML = '<div class="empty-state"><p>No jobs match your search.</p></div>';
    return;
  }

  jobsList.innerHTML = filtered.map(job => {
    const total = parseFloat(job.total_amount) || 0;

    return `
      <div class="job-card">
        <div class="job-card-main" onclick="openJobDetail(${job.id})">
          <div class="job-card-info">
            <h3>${escapeHtml(job.name)}</h3>
            <div class="job-card-meta">
              <span>${job.receipt_count} receipt${job.receipt_count !== 1 ? 's' : ''}</span>
              <span class="receipt-id">#${job.id}</span>
            </div>
          </div>
          <div class="job-card-stats">
            <div class="stat">
              <span class="stat-value">$${total.toFixed(2)}</span>
              <span class="stat-label">Total</span>
            </div>
            <svg class="job-card-arrow" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 4l6 6-6 6"/>
            </svg>
          </div>
        </div>
        <div class="job-card-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); openJobEdit(${job.id})" title="Edit Job">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 0 3L12 12l-4 1 1-4 6.5-6.5a2.121 2.121 0 0 1 3 0z"/>
            </svg>
          </button>
          <button class="btn-icon" onclick="event.stopPropagation(); confirmDeleteJob(${job.id})" title="Delete Job">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openJobDetail(jobId) {
  currentJobId = jobId;
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').hidden = true;
  document.getElementById('searchInput').placeholder = 'Search receipts...';

  const job = jobs.find(j => j.id === jobId);
  document.getElementById('jobDetailTitle').textContent = job ? job.name : 'Unknown Job';

  // Calculate job stats
  const jobReceipts = receipts.filter(r => r.job_id === jobId);
  const totalSpent = jobReceipts.reduce((sum, r) =>
    sum + r.items.reduce((s, i) => s + parseFloat(i.amount), 0), 0);
  const totalItems = jobReceipts.reduce((sum, r) => sum + r.items.length, 0);
  const stores = new Set(jobReceipts.map(r => r.store_location).filter(Boolean));

  document.getElementById('jobStats').innerHTML = `
    <div class="stat">
      <span class="stat-label">Job ID</span>
      <span class="stat-value">#${jobId}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Receipts</span>
      <span class="stat-value">${jobReceipts.length}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Items</span>
      <span class="stat-value">${totalItems}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Stores</span>
      <span class="stat-value">${stores.size}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Total Spent</span>
      <span class="stat-value">$${totalSpent.toFixed(2)}</span>
    </div>
  `;

  jobsListView.hidden = true;
  jobDetailView.hidden = false;
  renderReceipts();
}

function showJobsList() {
  currentJobId = null;
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('clearSearch').hidden = true;
  document.getElementById('searchInput').placeholder = 'Search jobs...';

  jobsListView.hidden = false;
  jobDetailView.hidden = true;
  renderJobs();
}

function renderReceipts() {
  const filtered = getFilteredReceipts();

  if (filtered.length === 0 && currentJobId) {
    receiptList.innerHTML = '<div class="empty-state"><p>No receipts match your search.</p></div>';
    return;
  }

  if (filtered.length === 0) {
    receiptList.innerHTML = '<div class="empty-state"><p>No receipts found.</p></div>';
    return;
  }

  receiptList.innerHTML = filtered.map(receipt => {
    const total = receipt.items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    const thumbnail = getThumbnail(receipt);

    return `
      <div class="receipt-card" data-id="${receipt.id}">
        <div class="receipt-card-header">
          ${thumbnail}
          <div class="receipt-info">
            <h3>
              <span class="receipt-id">#${receipt.id}</span>
              ${receipt.store_location ? escapeHtml(receipt.store_location) : 'Receipt'}
            </h3>
            <div class="receipt-meta">
              <span>${formatDate(receipt.receipt_date)}</span>
              ${receipt.notes ? `<span>${escapeHtml(receipt.notes.substring(0, 30))}${receipt.notes.length > 30 ? '...' : ''}</span>` : ''}
            </div>
          </div>
          <div class="receipt-actions">
            <button class="btn-icon" onclick="openReceiptModal(${receipt.id})" title="Edit">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 0 3L12 12l-4 1 1-4 6.5-6.5a2.121 2.121 0 0 1 3 0z"/>
              </svg>
            </button>
            <button class="btn-icon" onclick="confirmDelete(${receipt.id}, 'receipt')" title="Delete">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="receipt-card-footer">
          <span class="receipt-total">$${total.toFixed(2)}</span>
          <button class="btn btn-sm btn-secondary" onclick="openItemsModal(${receipt.id})">
            ${receipt.items.length} item${receipt.items.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAllItems() {
  const tbody = document.getElementById('allItemsBody');
  const statsEl = document.getElementById('itemsStats');
  const items = getFilteredAndSortedItems();

  // Update sort indicators
  document.querySelectorAll('.all-items-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortColumn) {
      th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--gray-600); padding: 2rem;">No items found</td></tr>';
    statsEl.innerHTML = '';
    return;
  }

  tbody.innerHTML = items.map(item => {
    const qty = item.quantity || 1;
    const unitPrice = parseFloat(item.amount) / qty;
    return `
      <tr>
        <td><span class="item-name-link" onclick="showPriceHistory('${escapeHtml(item.item_name).replace(/'/g, "\\'")}')">${escapeHtml(item.item_name)}</span></td>
        <td>${qty}</td>
        <td>${formatDate(item.purchase_date)}</td>
        <td>$${parseFloat(item.amount).toFixed(2)}</td>
        <td>$${unitPrice.toFixed(2)}</td>
        <td>${escapeHtml(item.store_location || '-')}</td>
        <td>${escapeHtml(item.job_name)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="goToReceipt(${item.receipt_id})">View</button>
        </td>
      </tr>
    `;
  }).join('');

  // Stats
  const total = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const uniqueItems = new Set(items.map(i => i.item_name.toLowerCase())).size;
  const uniqueStores = new Set(items.map(i => i.store_location).filter(Boolean)).size;

  statsEl.innerHTML = `
    <div class="stat">
      <span class="stat-label">Total Items</span>
      <span class="stat-value">${items.length}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Unique Items</span>
      <span class="stat-value">${uniqueItems}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Stores</span>
      <span class="stat-value">${uniqueStores}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Total Spent</span>
      <span class="stat-value">$${total.toFixed(2)}</span>
    </div>
  `;
}

function getThumbnail(receipt) {
  if (!receipt.file_path) {
    return `<div class="receipt-thumbnail imported">
      <svg class="imported-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span class="imported-label">Imported</span>
    </div>`;
  }

  if (receipt.file_type === 'application/pdf') {
    return `<div class="receipt-thumbnail pdf" onclick="openPreview('${receipt.file_path}', 'pdf')">PDF</div>`;
  }

  // Check for CSV - browsers send various MIME types
  const csvTypes = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];
  const isCSV = csvTypes.includes(receipt.file_type) || receipt.file_path.toLowerCase().endsWith('.csv');
  if (isCSV) {
    return `<div class="receipt-thumbnail csv" onclick="downloadFile('${receipt.file_path}')">
      <svg class="csv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
      </svg>
      <span class="csv-label">CSV</span>
    </div>`;
  }

  return `<img class="receipt-thumbnail" src="/uploads/${receipt.file_path}" alt="Receipt" onclick="openPreview('${receipt.file_path}', 'image')">`;
}

function downloadFile(filePath) {
  const link = document.createElement('a');
  link.href = `/uploads/${filePath}`;
  link.download = filePath;
  link.click();
}

function renderItems(receipt) {
  const tbody = document.getElementById('itemsTableBody');
  const totalEl = document.getElementById('itemsTotal');

  if (receipt.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--gray-600)">No items yet</td></tr>';
    totalEl.innerHTML = '<strong>$0.00</strong>';
    return;
  }

  tbody.innerHTML = receipt.items.map(item => {
    const qty = item.quantity || 1;
    const unitPrice = parseFloat(item.amount) / qty;
    return `
      <tr data-id="${item.id}">
        <td><span class="item-name-link" onclick="showPriceHistory('${escapeHtml(item.item_name).replace(/'/g, "\\'")}')">${escapeHtml(item.item_name)}</span></td>
        <td>${qty}</td>
        <td>${formatDate(item.purchase_date)}</td>
        <td>$${parseFloat(item.amount).toFixed(2)}</td>
        <td>$${unitPrice.toFixed(2)}</td>
        <td>
          <button class="btn-icon" onclick="editItem(${item.id})" title="Edit">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 0 3L12 12l-4 1 1-4 6.5-6.5a2.121 2.121 0 0 1 3 0z"/>
            </svg>
          </button>
          <button class="btn-icon" onclick="confirmDelete(${item.id}, 'item')" title="Delete">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const total = receipt.items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  totalEl.innerHTML = `<strong>$${total.toFixed(2)}</strong>`;
}

// Modal Functions
function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

function openReceiptModal(id) {
  const modal = receiptModal;
  const form = receiptForm;

  // Reset file preview state
  resetFilePreview();

  if (id) {
    const receipt = receipts.find(r => r.id === id);
    if (!receipt) return;

    document.getElementById('modalTitle').textContent = 'Edit Receipt';
    document.getElementById('receiptId').value = id;
    document.getElementById('jobSelect').value = receipt.job_id || '';
    document.getElementById('storeLocation').value = receipt.store_location || '';
    document.getElementById('receiptDate').value = receipt.receipt_date;
    document.getElementById('notes').value = receipt.notes || '';
    document.getElementById('currentFile').textContent = receipt.file_path ? `Current file: ${receipt.file_path}` : '';

    // Show existing image in preview if it's an image
    if (receipt.file_path && receipt.file_type?.startsWith('image/')) {
      const previewPanel = document.getElementById('filePreviewPanel');
      const previewImage = document.getElementById('previewImage');
      previewImage.src = `/uploads/${receipt.file_path}`;
      previewImage.style.transform = 'rotate(0deg)';
      previewPanel.hidden = false;
    }
  } else {
    document.getElementById('modalTitle').textContent = 'New Receipt';
    form.reset();
    document.getElementById('receiptId').value = '';
    document.getElementById('receiptDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('currentFile').textContent = '';
    // Pre-select current job if viewing a job
    if (currentJobId) {
      document.getElementById('jobSelect').value = currentJobId;
    }
  }

  openModal(modal);
  document.getElementById('jobSelect').focus();
}

function openItemsModal(receiptId) {
  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) return;

  document.getElementById('itemReceiptId').value = receiptId;
  document.getElementById('itemId').value = '';
  document.getElementById('addItemBtn').textContent = 'Add';
  itemForm.reset();
  document.getElementById('itemDate').value = receipt.receipt_date;
  document.getElementById('itemQty').value = 1;

  renderItems(receipt);
  openModal(itemsModal);
  document.getElementById('itemName').focus();
}

function openPreview(filePath, type) {
  const content = document.getElementById('previewContent');

  if (type === 'pdf') {
    content.innerHTML = `<iframe src="/uploads/${filePath}"></iframe>`;
  } else {
    content.innerHTML = `<img src="/uploads/${filePath}" alt="Receipt">`;
  }

  openModal(previewModal);
}

function confirmDelete(id, type) {
  deleteTarget = { id, type };
  document.getElementById('deleteMessage').textContent =
    type === 'receipt'
      ? 'Are you sure you want to delete this receipt and all its items?'
      : 'Are you sure you want to delete this item?';
  openModal(deleteModal);
}

function openJobEdit(jobId) {
  const isNew = jobId === null;
  document.getElementById('jobEditTitle').textContent = isNew ? 'New Job' : 'Edit Job';
  document.getElementById('jobEditId').value = jobId || '';

  if (isNew) {
    document.getElementById('jobEditName').value = '';
  } else {
    const job = jobs.find(j => j.id === jobId);
    document.getElementById('jobEditName').value = job ? job.name : '';
  }

  openModal(jobEditModal);
  document.getElementById('jobEditName').focus();
  if (!isNew) {
    document.getElementById('jobEditName').select();
  }
}

async function handleJobEditSubmit(e) {
  e.preventDefault();

  const jobId = document.getElementById('jobEditId').value;
  const name = document.getElementById('jobEditName').value.trim();
  const isNew = !jobId;

  if (!name) {
    alert('Job name is required');
    return;
  }

  try {
    let res;
    if (isNew) {
      res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    } else {
      res = await fetch(`${API}/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save job');
    }

    const savedJob = await res.json();
    closeModal(jobEditModal);

    await loadJobs();

    // If we were viewing this job, update the title
    if (currentJobId === parseInt(jobId)) {
      document.getElementById('jobDetailTitle').textContent = name;
    }

    // If creating new job from receipt modal, select it
    if (isNew && !receiptModal.hidden) {
      document.getElementById('jobSelect').value = savedJob.id;
    }

    await loadReceipts();
  } catch (err) {
    alert(err.message);
  }
}

function confirmDeleteJob(jobId) {
  const job = jobs.find(j => j.id === jobId);
  deleteTarget = { id: jobId, type: 'job' };
  document.getElementById('deleteMessage').textContent =
    `Are you sure you want to delete the job "${job ? job.name : 'Unknown'}" and all its receipts?`;
  openModal(deleteModal);
}

// File Preview and Rotation
function handleFileSelect(e) {
  const file = e.target.files[0];
  selectedFile = file;
  currentRotation = 0;

  const previewPanel = document.getElementById('filePreviewPanel');
  const previewImage = document.getElementById('previewImage');
  const csvImportOptions = document.getElementById('csvImportOptions');
  const saveBtn = document.getElementById('saveReceiptBtn');

  if (!file) {
    previewPanel.hidden = true;
    csvImportOptions.hidden = true;
    saveBtn.textContent = 'Save Receipt';
    modalCsvFile = null;
    modalCsvData = null;
    return;
  }

  // Check if CSV file
  const isCSV = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' ||
                file.name.toLowerCase().endsWith('.csv');

  if (isCSV) {
    previewPanel.hidden = true;
    modalCsvFile = file;
    saveBtn.textContent = 'Import CSV';

    // Parse CSV and show options
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      modalCsvRawLines = text.split(/\r?\n/).filter(line => line.trim());

      if (modalCsvRawLines.length < 2) {
        alert('CSV must have at least 2 rows');
        csvImportOptions.hidden = true;
        return;
      }

      renderModalRawPreview();
      parseModalCSV();
      showModalMappingOptions();
      csvImportOptions.hidden = false;
    };
    reader.readAsText(file);
  } else if (file.type.startsWith('image/')) {
    csvImportOptions.hidden = true;
    modalCsvFile = null;
    modalCsvData = null;
    saveBtn.textContent = 'Save Receipt';

    const reader = new FileReader();
    reader.onload = (event) => {
      previewImage.src = event.target.result;
      previewImage.style.transform = 'rotate(0deg)';
      previewPanel.hidden = false;
      updateRotationLabel();
    };
    reader.readAsDataURL(file);
  } else {
    previewPanel.hidden = true;
    csvImportOptions.hidden = true;
    modalCsvFile = null;
    modalCsvData = null;
    saveBtn.textContent = 'Save Receipt';
  }
}

function renderModalRawPreview() {
  const headerRow = parseInt(document.getElementById('modalHeaderRowSelect').value);
  const previewLines = modalCsvRawLines.slice(0, 10);

  const html = `<div class="raw-preview-content"><table>${previewLines.map((line, i) => {
    const rowNum = i + 1;
    const cells = parseCSVLine(line);
    const rowClass = rowNum === headerRow ? 'header-row' : (rowNum < headerRow ? 'skip-row' : '');
    return `<tr class="${rowClass}">
      <td style="color: var(--gray-600); font-weight: 500;">${rowNum}</td>
      ${cells.slice(0, 6).map(cell => `<td>${escapeHtml(cell.substring(0, 25))}</td>`).join('')}
      ${cells.length > 6 ? '<td>...</td>' : ''}
    </tr>`;
  }).join('')}</table></div>`;

  document.getElementById('modalRawPreviewContent').innerHTML = html;
  document.getElementById('modalRawPreview').hidden = false;
}

function parseModalCSV() {
  const headerRow = parseInt(document.getElementById('modalHeaderRowSelect').value);

  if (modalCsvRawLines.length < headerRow + 1) {
    alert('Not enough rows for selected header row');
    return;
  }

  modalCsvHeaders = parseCSVLine(modalCsvRawLines[headerRow - 1]);
  modalCsvData = modalCsvRawLines.slice(headerRow).map(line => parseCSVLine(line));
}

function showModalMappingOptions() {
  const targetFields = ['item_name', 'quantity', 'purchase_date', 'amount'];

  const container = document.getElementById('modalMappingContainer');
  container.innerHTML = targetFields.map(field => {
    const options = modalCsvHeaders.map((h, i) => {
      const selected = autoMatchField(h, field) ? 'selected' : '';
      return `<option value="${i}" ${selected}>${escapeHtml(h)}</option>`;
    }).join('');

    return `
      <div class="mapping-row">
        <label>${formatFieldName(field)}</label>
        <select data-field="${field}">
          <option value="">-- Skip --</option>
          ${options}
        </select>
      </div>
    `;
  }).join('');

  // Show unit price options
  const unitPriceOptions = document.getElementById('modalUnitPriceOptions');
  unitPriceOptions.hidden = false;

  const unitPriceSelect = document.getElementById('modalUnitPriceSelect');
  unitPriceSelect.innerHTML = `<option value="">-- Select column --</option>` +
    modalCsvHeaders.map((h, i) => {
      const selected = autoMatchField(h, 'unit_price') ? 'selected' : '';
      return `<option value="${i}" ${selected}>${escapeHtml(h)}</option>`;
    }).join('');

  updateModalUnitPriceVisibility();
}

function updateModalUnitPriceVisibility() {
  const calcUnitPrice = document.getElementById('modalCalcUnitPrice').checked;
  document.getElementById('modalUnitPriceMapping').hidden = calcUnitPrice;
}

// Event listeners for modal CSV options
document.getElementById('modalHeaderRowSelect').addEventListener('change', () => {
  if (modalCsvRawLines.length > 0) {
    renderModalRawPreview();
    parseModalCSV();
    showModalMappingOptions();
  }
});

document.getElementById('modalCalcUnitPrice').addEventListener('change', updateModalUnitPriceVisibility);

function rotateImage(degrees) {
  currentRotation = (currentRotation + degrees + 360) % 360;
  const previewImage = document.getElementById('previewImage');
  previewImage.style.transform = `rotate(${currentRotation}deg)`;
  updateRotationLabel();
}

function updateRotationLabel() {
  document.getElementById('rotationLabel').textContent = `${currentRotation}°`;
}

function rotateImageFile(file, rotation) {
  return new Promise((resolve) => {
    if (rotation === 0 || !file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Swap dimensions for 90/270 degree rotations
      if (rotation === 90 || rotation === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      canvas.toBlob((blob) => {
        const rotatedFile = new File([blob], file.name, { type: file.type });
        resolve(rotatedFile);
      }, file.type, 0.95);
    };

    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.readAsDataURL(file);
  });
}

// Event Handlers
async function handleReceiptSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('receiptId').value;

  // Check if this is a CSV import
  if (modalCsvFile && modalCsvData && modalCsvData.length > 0) {
    await handleModalCSVImport();
    return;
  }

  const formData = new FormData();

  formData.append('job_id', document.getElementById('jobSelect').value);
  formData.append('store_location', document.getElementById('storeLocation').value);
  formData.append('receipt_date', document.getElementById('receiptDate').value);
  formData.append('notes', document.getElementById('notes').value);

  const file = document.getElementById('receiptFile').files[0];
  if (file) {
    const processedFile = await rotateImageFile(file, currentRotation);
    formData.append('file', processedFile);
  }

  try {
    await saveReceipt(formData, id || null);
    closeModal(receiptModal);
    await loadJobs();
    await loadReceipts();
    resetFilePreview();
  } catch (err) {
    alert('Failed to save receipt');
  }
}

async function handleModalCSVImport() {
  // Get form values as defaults
  const defaultJobId = document.getElementById('jobSelect').value;
  const defaultStoreLocation = document.getElementById('storeLocation').value || '';
  const defaultDate = document.getElementById('receiptDate').value || new Date().toISOString().split('T')[0];
  const defaultNotes = document.getElementById('notes').value || '';

  if (!defaultJobId) {
    alert('Please select a job');
    return;
  }

  // Get mapping from modal
  const mappingSelects = document.querySelectorAll('#modalMappingContainer select');
  const mapping = {};
  mappingSelects.forEach(select => {
    if (select.value !== '') {
      mapping[select.dataset.field] = parseInt(select.value);
    }
  });

  // Get unit price settings
  const useCalcUnitPrice = document.getElementById('modalCalcUnitPrice').checked;
  const unitPriceColIdx = document.getElementById('modalUnitPriceSelect').value;
  const useUnitPriceCol = !useCalcUnitPrice && unitPriceColIdx !== '';

  // Validate required fields
  const requiredFields = useUnitPriceCol ? ['item_name'] : ['item_name', 'amount'];
  const missing = requiredFields.filter(f => mapping[f] === undefined);
  if (missing.length) {
    alert(`Please map required fields: ${missing.map(formatFieldName).join(', ')}`);
    return;
  }

  if (!useCalcUnitPrice && unitPriceColIdx === '') {
    alert('Please select a Unit Price column or check "Calculate unit price"');
    return;
  }

  const saveBtn = document.getElementById('saveReceiptBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Importing...';

  try {
    // Upload CSV file first
    let uploadedFile = null;
    const uploadFormData = new FormData();
    uploadFormData.append('file', modalCsvFile);
    const uploadRes = await fetch(`${API}/upload-csv`, {
      method: 'POST',
      body: uploadFormData
    });
    if (uploadRes.ok) {
      uploadedFile = await uploadRes.json();
    }

    // Create single receipt with all items (use form values, not CSV grouping)
    const receiptFormData = new FormData();
    receiptFormData.append('job_id', defaultJobId);
    receiptFormData.append('store_location', defaultStoreLocation);
    receiptFormData.append('receipt_date', defaultDate);
    receiptFormData.append('notes', defaultNotes);

    if (uploadedFile) {
      receiptFormData.append('imported_file_path', uploadedFile.file_path);
      receiptFormData.append('imported_file_type', uploadedFile.file_type);
    }

    const newReceipt = await saveReceipt(receiptFormData, null);

    // Collect all items and merge duplicates
    const itemsMap = new Map();

    for (const row of modalCsvData) {
      const itemName = (row[mapping.item_name] || 'Unknown Item').trim();
      const quantity = parseInt(row[mapping.quantity]) || 1;
      let amount;

      if (useUnitPriceCol) {
        const unitPrice = parseCurrency(row[unitPriceColIdx]);
        amount = unitPrice * quantity;
      } else {
        amount = parseCurrency(row[mapping.amount]);
      }

      // Use date from CSV if mapped, otherwise use form date
      const itemDate = mapping.purchase_date !== undefined
        ? (row[mapping.purchase_date] || defaultDate)
        : defaultDate;

      // Key for deduplication (case-insensitive item name)
      const key = itemName.toLowerCase();

      if (itemsMap.has(key)) {
        // Merge with existing item
        const existing = itemsMap.get(key);
        existing.quantity += quantity;
        existing.amount += amount;
      } else {
        // New item
        itemsMap.set(key, {
          item_name: itemName,
          quantity,
          purchase_date: itemDate,
          amount
        });
      }
    }

    // Save merged items
    let success = 0;
    let failed = 0;
    const mergedCount = modalCsvData.length - itemsMap.size;

    for (const [, itemData] of itemsMap) {
      try {
        await saveItem(newReceipt.id, itemData, null);
        success++;
      } catch (err) {
        failed++;
        console.error('Failed to add item:', err);
      }
    }

    closeModal(receiptModal);
    await loadReceipts();
    resetFilePreview();
    resetModalCSV();

    // Show summary
    let message = `Imported ${success} items.`;
    if (mergedCount > 0) {
      message += ` ${mergedCount} duplicate rows were merged.`;
    }
    if (failed > 0) {
      message += ` ${failed} items failed.`;
    }
    if (mergedCount > 0 || failed > 0) {
      alert(message);
    }
  } catch (err) {
    console.error('CSV import error:', err);
    alert('Failed to import CSV');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Receipt';
  }
}

function resetModalCSV() {
  modalCsvData = null;
  modalCsvHeaders = [];
  modalCsvRawLines = [];
  modalCsvFile = null;
  document.getElementById('csvImportOptions').hidden = true;
  document.getElementById('modalRawPreview').hidden = true;
  document.getElementById('modalHeaderRowSelect').value = '1';
  document.getElementById('modalCalcUnitPrice').checked = true;
}

function resetFilePreview() {
  currentRotation = 0;
  selectedFile = null;
  document.getElementById('filePreviewPanel').hidden = true;
  document.getElementById('previewImage').src = '';
  updateRotationLabel();
  resetModalCSV();
  document.getElementById('saveReceiptBtn').textContent = 'Save Receipt';
}

async function handleItemSubmit(e) {
  e.preventDefault();

  const receiptId = document.getElementById('itemReceiptId').value;
  const itemId = document.getElementById('itemId').value;

  const data = {
    item_name: document.getElementById('itemName').value,
    purchase_date: document.getElementById('itemDate').value,
    amount: parseFloat(document.getElementById('itemAmount').value),
    quantity: parseInt(document.getElementById('itemQty').value) || 1
  };

  try {
    await saveItem(receiptId, data, itemId || null);
    await loadReceipts();

    const receipt = receipts.find(r => r.id === parseInt(receiptId));
    renderItems(receipt);

    // Reset form
    document.getElementById('itemId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemAmount').value = '';
    document.getElementById('itemQty').value = 1;
    document.getElementById('addItemBtn').textContent = 'Add';
    document.getElementById('itemName').focus();
  } catch (err) {
    alert('Failed to save item');
  }
}

async function handleDelete() {
  if (!deleteTarget) return;

  try {
    if (deleteTarget.type === 'job') {
      const res = await fetch(`${API}/jobs/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete job');
      }
      closeModal(deleteModal);
      // If we were viewing this job, go back to jobs list
      if (currentJobId === deleteTarget.id) {
        showJobsList();
      }
      await loadJobs();
      await loadReceipts();
      // Also refresh items tab if it was open
      if (allItems.length > 0) {
        await loadAllItems();
      }
    } else if (deleteTarget.type === 'receipt') {
      await deleteReceipt(deleteTarget.id);
      closeModal(deleteModal);
      await loadJobs();
      await loadReceipts();
      // Also refresh items tab if it was open
      if (allItems.length > 0) {
        await loadAllItems();
      }
    } else {
      await deleteItem(deleteTarget.id);
      await loadJobs();
      await loadReceipts();

      const receiptId = document.getElementById('itemReceiptId').value;
      const receipt = receipts.find(r => r.id === parseInt(receiptId));
      if (receipt) renderItems(receipt);

      closeModal(deleteModal);
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete');
  }

  deleteTarget = null;
}

function editItem(itemId) {
  const receiptId = parseInt(document.getElementById('itemReceiptId').value);
  const receipt = receipts.find(r => r.id === receiptId);
  if (!receipt) return;

  const item = receipt.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('itemId').value = item.id;
  document.getElementById('itemName').value = item.item_name;
  document.getElementById('itemQty').value = item.quantity || 1;
  document.getElementById('itemDate').value = item.purchase_date;
  document.getElementById('itemAmount').value = item.amount;
  document.getElementById('addItemBtn').textContent = 'Update';
  document.getElementById('itemName').focus();
}

function goToReceipt(receiptId) {
  const receipt = receipts.find(r => r.id === receiptId);
  if (receipt) {
    switchTab('receipts');
    openJobDetail(receipt.job_id);
    openItemsModal(receiptId);
  }
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function parseCurrency(value) {
  if (!value) return 0;
  // Remove currency symbols, commas, spaces, and other non-numeric chars except . and -
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned) || 0;
}

// ============================================
// CSV Export/Import
// ============================================

let csvData = null;
let csvHeaders = [];
let csvRawLines = [];
let csvFile = null;
let headerMapping = {};
let useCalculatedUnitPrice = true;

// Export dropdown toggle
document.getElementById('exportBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = document.getElementById('exportMenu');
  menu.hidden = !menu.hidden;
});

document.addEventListener('click', () => {
  document.getElementById('exportMenu').hidden = true;
});

document.getElementById('exportReceipts').addEventListener('click', exportReceipts);
document.getElementById('exportItems').addEventListener('click', exportItems);

// Import button
document.getElementById('importBtn').addEventListener('click', openImportModal);

function exportReceipts() {
  const headers = ['id', 'job_name', 'store_location', 'receipt_date', 'notes', 'total', 'item_count'];
  const rows = receipts.map(r => {
    const total = r.items.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    return [
      r.id,
      r.job_name,
      r.store_location || '',
      r.receipt_date,
      r.notes || '',
      total.toFixed(2),
      r.items.length
    ];
  });

  downloadCSV(headers, rows, 'receipts.csv');
}

function exportItems() {
  const headers = ['id', 'item_name', 'quantity', 'purchase_date', 'amount', 'unit_price', 'store_location', 'job_name', 'receipt_id'];
  const rows = allItems.length ? allItems : [];

  // Load items if not already loaded
  if (!rows.length) {
    fetch(`${API}/items`)
      .then(res => res.json())
      .then(items => {
        const data = items.map(i => {
          const unitPrice = parseFloat(i.amount) / (i.quantity || 1);
          return [
            i.id,
            i.item_name,
            i.quantity || 1,
            i.purchase_date,
            parseFloat(i.amount).toFixed(2),
            unitPrice.toFixed(2),
            i.store_location || '',
            i.job_name,
            i.receipt_id
          ];
        });
        downloadCSV(headers, data, 'items.csv');
      });
    return;
  }

  const data = rows.map(i => {
    const unitPrice = parseFloat(i.amount) / (i.quantity || 1);
    return [
      i.id,
      i.item_name,
      i.quantity || 1,
      i.purchase_date,
      parseFloat(i.amount).toFixed(2),
      unitPrice.toFixed(2),
      i.store_location || '',
      i.job_name,
      i.receipt_id
    ];
  });

  downloadCSV(headers, data, 'items.csv');
}

function downloadCSV(headers, rows, filename) {
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Import Modal
const importModal = document.getElementById('importModal');

function openImportModal() {
  csvData = null;
  csvHeaders = [];
  csvRawLines = [];
  csvFile = null;
  headerMapping = {};
  useCalculatedUnitPrice = true;

  document.getElementById('importStep1').hidden = false;
  document.getElementById('importStep2').hidden = true;
  document.getElementById('importStep3').hidden = true;

  document.getElementById('importNextBtn').hidden = true;
  document.getElementById('importBackBtn').hidden = true;
  document.getElementById('importRunBtn').hidden = true;
  document.getElementById('importDoneBtn').hidden = true;
  document.getElementById('importCancelBtn').hidden = false;

  document.getElementById('headerRowSelect').value = '1';
  document.getElementById('rawPreview').hidden = true;
  document.getElementById('calcUnitPrice').checked = true;

  // Reset drop zone - keep the input element, just reset its value and update text
  const dropZone = document.getElementById('csvDropZone');
  const fileInput = dropZone.querySelector('input[type="file"]');
  if (fileInput) {
    fileInput.value = '';
  }
  const dropZoneText = dropZone.querySelector('p');
  if (dropZoneText) {
    dropZoneText.textContent = 'Drag & drop a CSV file here, or click to select';
  }

  openModal(importModal);
}

// File drop zone
const csvDropZone = document.getElementById('csvDropZone');
const csvFileInput = document.getElementById('csvFileInput');

csvDropZone.addEventListener('click', () => csvFileInput.click());

csvDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  csvDropZone.classList.add('drag-over');
});

csvDropZone.addEventListener('dragleave', () => {
  csvDropZone.classList.remove('drag-over');
});

csvDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  csvDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    handleCSVFile(file);
  }
});

csvFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleCSVFile(file);
});

function handleCSVFile(file) {
  csvFile = file; // Store the file for later upload

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    csvRawLines = text.split(/\r?\n/).filter(line => line.trim());

    if (csvRawLines.length < 2) {
      alert('CSV must have at least 2 rows');
      return;
    }

    // Show raw preview
    renderRawPreview();
    document.getElementById('rawPreview').hidden = false;

    // Parse with current header row setting
    parseCSVWithHeaderRow();

    if (csvData && csvData.length > 0) {
      const dropZoneText = document.getElementById('csvDropZone').querySelector('p');
      if (dropZoneText) {
        dropZoneText.textContent = `Loaded: ${file.name} (${csvRawLines.length} rows)`;
      }
      document.getElementById('importNextBtn').hidden = false;
    }
  };
  reader.readAsText(file);
}

function renderRawPreview() {
  const headerRow = parseInt(document.getElementById('headerRowSelect').value);
  const previewLines = csvRawLines.slice(0, 10);

  const html = `<div class="raw-preview-content"><table>${previewLines.map((line, i) => {
    const rowNum = i + 1;
    const cells = parseCSVLine(line);
    const rowClass = rowNum === headerRow ? 'header-row' : (rowNum < headerRow ? 'skip-row' : '');
    return `<tr class="${rowClass}">
      <td style="color: var(--gray-600); font-weight: 500;">${rowNum}</td>
      ${cells.slice(0, 8).map(cell => `<td>${escapeHtml(cell.substring(0, 30))}</td>`).join('')}
      ${cells.length > 8 ? '<td>...</td>' : ''}
    </tr>`;
  }).join('')}</table></div>`;

  document.getElementById('rawPreviewContent').innerHTML = html;
}

function parseCSVWithHeaderRow() {
  const headerRow = parseInt(document.getElementById('headerRowSelect').value);

  if (csvRawLines.length < headerRow + 1) {
    alert('Not enough rows in CSV for selected header row');
    return;
  }

  csvHeaders = parseCSVLine(csvRawLines[headerRow - 1]);
  csvData = csvRawLines.slice(headerRow).map(line => parseCSVLine(line));
}

// Update preview when header row changes
document.getElementById('headerRowSelect').addEventListener('change', () => {
  if (csvRawLines.length > 0) {
    renderRawPreview();
    parseCSVWithHeaderRow();
  }
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// Import navigation buttons
document.getElementById('importNextBtn').addEventListener('click', showMappingStep);
document.getElementById('importBackBtn').addEventListener('click', showUploadStep);
document.getElementById('importRunBtn').addEventListener('click', runImport);
document.getElementById('importDoneBtn').addEventListener('click', () => closeModal(importModal));
document.getElementById('importCancelBtn').addEventListener('click', () => closeModal(importModal));

function showUploadStep() {
  document.getElementById('importStep1').hidden = false;
  document.getElementById('importStep2').hidden = true;
  document.getElementById('importStep3').hidden = true;

  document.getElementById('importNextBtn').hidden = false;
  document.getElementById('importBackBtn').hidden = true;
  document.getElementById('importRunBtn').hidden = true;
}

function showMappingStep() {
  const importType = document.getElementById('importType').value;
  const targetFields = importType === 'receipts'
    ? ['job_name', 'store_location', 'receipt_date', 'notes']
    : ['item_name', 'quantity', 'purchase_date', 'amount', 'job_name', 'store_location'];

  const container = document.getElementById('mappingContainer');
  container.innerHTML = targetFields.map(field => {
    const options = csvHeaders.map((h, i) => {
      const selected = autoMatchField(h, field) ? 'selected' : '';
      return `<option value="${i}" ${selected}>${escapeHtml(h)}</option>`;
    }).join('');

    return `
      <div class="mapping-row">
        <label>${formatFieldName(field)}</label>
        <select data-field="${field}">
          <option value="">-- Skip --</option>
          ${options}
        </select>
      </div>
    `;
  }).join('');

  // Show unit price options for items import
  const unitPriceOptions = document.getElementById('unitPriceOptions');
  if (importType === 'items') {
    unitPriceOptions.hidden = false;

    // Populate unit price column select
    const unitPriceSelect = document.getElementById('unitPriceSelect');
    unitPriceSelect.innerHTML = `<option value="">-- Select column --</option>` +
      csvHeaders.map((h, i) => {
        const selected = autoMatchField(h, 'unit_price') ? 'selected' : '';
        return `<option value="${i}" ${selected}>${escapeHtml(h)}</option>`;
      }).join('');

    updateUnitPriceVisibility();
  } else {
    unitPriceOptions.hidden = true;
  }

  // Show preview
  renderImportPreview();

  document.getElementById('importStep1').hidden = true;
  document.getElementById('importStep2').hidden = false;

  document.getElementById('importNextBtn').hidden = true;
  document.getElementById('importBackBtn').hidden = false;
  document.getElementById('importRunBtn').hidden = false;
}

function autoMatchField(header, field) {
  const h = header.toLowerCase().replace(/[_\s-]/g, '');
  const f = field.toLowerCase().replace(/[_\s-]/g, '');

  // Direct match
  if (h === f) return true;

  // Common aliases
  const aliases = {
    'item_name': ['item', 'itemname', 'description', 'product', 'productname', 'name', 'desc'],
    'quantity': ['qty', 'quantity', 'count', 'units'],
    'purchase_date': ['date', 'purchasedate', 'orderdate', 'transactiondate'],
    'amount': ['total', 'amount', 'price', 'extendedprice', 'extendedretail', 'linetotal', 'subtotal'],
    'job_name': ['job', 'jobname', 'project', 'projectname'],
    'store_location': ['store', 'storelocation', 'location', 'vendor'],
    'unit_price': ['unitprice', 'unit', 'eachprice', 'priceperunit', 'retail', 'discountedprice']
  };

  return aliases[field]?.includes(h) || false;
}

function updateUnitPriceVisibility() {
  const calcUnitPrice = document.getElementById('calcUnitPrice').checked;
  document.getElementById('unitPriceMapping').hidden = calcUnitPrice;
  useCalculatedUnitPrice = calcUnitPrice;
}

document.getElementById('calcUnitPrice').addEventListener('change', updateUnitPriceVisibility);

function formatFieldName(field) {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderImportPreview() {
  const previewRows = csvData.slice(0, 3);
  const table = document.getElementById('importPreviewTable');

  table.innerHTML = `
    <table>
      <thead>
        <tr>${csvHeaders.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${previewRows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

async function runImport() {
  const importType = document.getElementById('importType').value;
  const mappingSelects = document.querySelectorAll('#mappingContainer select');

  headerMapping = {};
  mappingSelects.forEach(select => {
    if (select.value !== '') {
      headerMapping[select.dataset.field] = parseInt(select.value);
    }
  });

  // Get unit price column if selected
  const unitPriceColIdx = document.getElementById('unitPriceSelect').value;
  const useUnitPriceCol = importType === 'items' && !useCalculatedUnitPrice && unitPriceColIdx !== '';

  // Validate required fields
  let requiredFields;
  if (importType === 'receipts') {
    requiredFields = ['job_name', 'receipt_date'];
  } else if (useUnitPriceCol) {
    // If using unit price column, amount is not required (we'll calculate it)
    requiredFields = ['item_name', 'purchase_date'];
  } else {
    requiredFields = ['item_name', 'purchase_date', 'amount'];
  }

  const missing = requiredFields.filter(f => headerMapping[f] === undefined);
  if (missing.length) {
    alert(`Please map required fields: ${missing.map(formatFieldName).join(', ')}`);
    return;
  }

  // If using unit price column, validate it's selected
  if (importType === 'items' && !useCalculatedUnitPrice && unitPriceColIdx === '') {
    alert('Please select a Unit Price column or check "Calculate unit price from Total ÷ Quantity"');
    return;
  }

  document.getElementById('importRunBtn').disabled = true;
  document.getElementById('importRunBtn').textContent = 'Importing...';

  let success = 0;
  let failed = 0;
  const errors = [];

  // Upload CSV file first to get file_path
  let uploadedFile = null;
  if (csvFile) {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', csvFile);
      const uploadRes = await fetch(`${API}/upload-csv`, {
        method: 'POST',
        body: uploadFormData
      });
      if (uploadRes.ok) {
        uploadedFile = await uploadRes.json();
      }
    } catch (err) {
      console.error('Failed to upload CSV:', err);
    }
  }

  if (importType === 'receipts') {
    for (const row of csvData) {
      try {
        const formData = new FormData();
        formData.append('job_name', row[headerMapping.job_name] || '');
        formData.append('store_location', row[headerMapping.store_location] ?? '');
        formData.append('receipt_date', row[headerMapping.receipt_date] || '');
        formData.append('notes', row[headerMapping.notes] ?? '');

        // Include CSV file reference for first receipt only (to avoid duplicates)
        if (uploadedFile && success === 0) {
          formData.append('imported_file_path', uploadedFile.file_path);
          formData.append('imported_file_type', uploadedFile.file_type);
        }

        await saveReceipt(formData, null);
        success++;
      } catch (err) {
        failed++;
        errors.push(`Row ${success + failed}: ${err.message}`);
      }
    }
  } else {
    // Items import - group by job_name + store_location + date to create receipts
    const receiptMap = new Map();

    for (const row of csvData) {
      const jobName = row[headerMapping.job_name] || 'Imported';
      const storeLocation = row[headerMapping.store_location] ?? '';
      const date = row[headerMapping.purchase_date] || new Date().toISOString().split('T')[0];
      const key = `${jobName}|${storeLocation}|${date}`;

      if (!receiptMap.has(key)) {
        receiptMap.set(key, { jobName, storeLocation, date, items: [] });
      }

      const quantity = parseInt(row[headerMapping.quantity]) || 1;
      let amount;

      if (useUnitPriceCol) {
        // Calculate amount from unit price * quantity
        const unitPrice = parseCurrency(row[unitPriceColIdx]);
        amount = unitPrice * quantity;
      } else {
        amount = parseCurrency(row[headerMapping.amount]);
      }

      receiptMap.get(key).items.push({
        item_name: row[headerMapping.item_name] || '',
        quantity,
        purchase_date: date,
        amount
      });
    }

    for (const [, receipt] of receiptMap) {
      try {
        const formData = new FormData();
        formData.append('job_name', receipt.jobName);
        formData.append('store_location', receipt.storeLocation);
        formData.append('receipt_date', receipt.date);
        formData.append('notes', '');

        // Include CSV file reference for all receipts from this import
        if (uploadedFile) {
          formData.append('imported_file_path', uploadedFile.file_path);
          formData.append('imported_file_type', uploadedFile.file_type);
        }

        const newReceipt = await saveReceipt(formData, null);

        for (const item of receipt.items) {
          try {
            await saveItem(newReceipt.id, item, null);
            success++;
          } catch (err) {
            failed++;
            errors.push(`Item "${item.item_name}": ${err.message}`);
          }
        }
      } catch (err) {
        failed += receipt.items.length;
        errors.push(`Receipt "${receipt.jobName}": ${err.message}`);
      }
    }
  }

  // Show results
  document.getElementById('importStep2').hidden = true;
  document.getElementById('importStep3').hidden = false;

  document.getElementById('importBackBtn').hidden = true;
  document.getElementById('importRunBtn').hidden = true;
  document.getElementById('importDoneBtn').hidden = false;
  document.getElementById('importCancelBtn').hidden = true;

  document.getElementById('importResults').innerHTML = `
    <div class="import-success">Successfully imported: ${success}</div>
    ${failed ? `<div class="import-failed">Failed: ${failed}</div>` : ''}
    ${errors.length ? `<div class="import-errors"><strong>Errors:</strong><ul>${errors.slice(0, 10).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>${errors.length > 10 ? `<p>...and ${errors.length - 10} more</p>` : ''}</div>` : ''}
  `;

  document.getElementById('importRunBtn').disabled = false;
  document.getElementById('importRunBtn').textContent = 'Import';

  // Reload data
  loadReceipts();
}

// ============================================
// Price History
// ============================================

const priceHistoryModal = document.getElementById('priceHistoryModal');

async function showPriceHistory(itemName) {
  // Get all items with this name (case-insensitive)
  let items = allItems;

  // If allItems is empty, fetch them
  if (!items.length) {
    try {
      const res = await fetch(`${API}/items`);
      items = await res.json();
    } catch (err) {
      console.error('Failed to load items:', err);
      return;
    }
  }

  // Filter items matching this name
  const matchingItems = items.filter(i =>
    i.item_name.toLowerCase() === itemName.toLowerCase()
  );

  if (matchingItems.length === 0) {
    alert('No price history found for this item');
    return;
  }

  // Sort by date
  matchingItems.sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));

  // Update modal title
  document.getElementById('priceHistoryTitle').textContent = `Price History: ${itemName}`;

  // Render stats
  renderPriceStats(matchingItems);

  // Render table
  renderPriceHistoryTable(matchingItems);

  // Open modal first, then draw chart after it's visible
  openModal(priceHistoryModal);

  // Wait for modal to be visible before drawing chart
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawPriceChart(matchingItems);
    });
  });
}

function renderPriceStats(items) {
  const unitPrices = items.map(i => parseFloat(i.amount) / (i.quantity || 1));
  const avgPrice = unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;
  const minPrice = Math.min(...unitPrices);
  const maxPrice = Math.max(...unitPrices);
  const firstPrice = unitPrices[0];
  const lastPrice = unitPrices[unitPrices.length - 1];
  const priceChange = lastPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? ((priceChange / firstPrice) * 100) : 0;

  const changeClass = priceChange > 0 ? 'price-up' : (priceChange < 0 ? 'price-down' : '');
  const changeSign = priceChange > 0 ? '+' : '';

  document.getElementById('priceHistoryStats').innerHTML = `
    <div class="stat">
      <span class="stat-label">Purchases</span>
      <span class="stat-value">${items.length}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Avg Unit Price</span>
      <span class="stat-value">$${avgPrice.toFixed(2)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Low</span>
      <span class="stat-value">$${minPrice.toFixed(2)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">High</span>
      <span class="stat-value">$${maxPrice.toFixed(2)}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Price Change</span>
      <span class="stat-value ${changeClass}">${changeSign}$${priceChange.toFixed(2)} (${changeSign}${priceChangePercent.toFixed(1)}%)</span>
    </div>
  `;
}

function renderPriceHistoryTable(items) {
  const tbody = document.getElementById('priceHistoryBody');

  tbody.innerHTML = items.map(item => {
    const qty = item.quantity || 1;
    const unitPrice = parseFloat(item.amount) / qty;
    return `
      <tr>
        <td>${formatDate(item.purchase_date)}</td>
        <td>${escapeHtml(item.store_location || '-')}</td>
        <td>${escapeHtml(item.job_name)}</td>
        <td>${qty}</td>
        <td>$${parseFloat(item.amount).toFixed(2)}</td>
        <td>$${unitPrice.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

function drawPriceChart(items) {
  const canvas = document.getElementById('priceChart');
  const ctx = canvas.getContext('2d');

  // Set canvas size for sharp rendering
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = container.clientWidth * dpr;
  canvas.height = container.clientHeight * dpr;
  canvas.style.width = container.clientWidth + 'px';
  canvas.style.height = container.clientHeight + 'px';
  ctx.scale(dpr, dpr);

  const width = container.clientWidth;
  const height = container.clientHeight;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Get data points
  const dataPoints = items.map(item => ({
    date: new Date(item.purchase_date + 'T00:00:00'),
    price: parseFloat(item.amount) / (item.quantity || 1),
    store: item.store_location || ''
  }));

  if (dataPoints.length === 0) return;

  // Calculate scales
  const minDate = dataPoints[0].date;
  const maxDate = dataPoints[dataPoints.length - 1].date;
  const dateRange = maxDate - minDate || 1;

  const prices = dataPoints.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.9;
  const maxPrice = Math.max(...prices) * 1.1;
  const priceRange = maxPrice - minPrice || 1;

  // Helper functions
  const xScale = (date) => padding.left + ((date - minDate) / dateRange) * chartWidth;
  const yScale = (price) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

  // Draw grid lines
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;

  // Horizontal grid lines (5 lines)
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    const price = maxPrice - (priceRange / 4) * i;
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('$' + price.toFixed(2), padding.left - 8, y + 4);
  }

  // Draw axes
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Draw line
  if (dataPoints.length > 1) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((point, i) => {
      const x = xScale(point.date);
      const y = yScale(point.price);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  // Draw points
  dataPoints.forEach((point, i) => {
    const x = xScale(point.date);
    const y = yScale(point.price);

    // Point
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    // White center
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // X-axis labels (dates)
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';

  // Show first, middle, and last dates
  const labelIndices = dataPoints.length <= 3
    ? dataPoints.map((_, i) => i)
    : [0, Math.floor(dataPoints.length / 2), dataPoints.length - 1];

  labelIndices.forEach(i => {
    const point = dataPoints[i];
    const x = xScale(point.date);
    const dateStr = point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    ctx.fillText(dateStr, x, height - padding.bottom + 20);
  });
}
