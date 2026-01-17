const API = '/api';

// DOM Elements
const receiptList = document.getElementById('receiptList');
const receiptModal = document.getElementById('receiptModal');
const itemsModal = document.getElementById('itemsModal');
const deleteModal = document.getElementById('deleteModal');
const previewModal = document.getElementById('previewModal');
const receiptForm = document.getElementById('receiptForm');
const itemForm = document.getElementById('itemForm');

let receipts = [];
let allItems = [];
let deleteTarget = null;
let searchQuery = '';
let itemsSearchQuery = '';
let sortColumn = 'purchase_date';
let sortDirection = 'desc';
let currentRotation = 0;
let selectedFile = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
    renderReceipts();
  });

  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearch.hidden = true;
    renderReceipts();
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

  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

// API Functions
async function loadReceipts() {
  try {
    const res = await fetch(`${API}/receipts`);
    receipts = await res.json();
    renderReceipts();
    updateDataLists();
  } catch (err) {
    console.error('Failed to load receipts:', err);
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
  const jobNames = [...new Set(receipts.map(r => r.job_name).filter(Boolean))];
  const storeLocations = [...new Set(receipts.map(r => r.store_location).filter(Boolean))];

  document.getElementById('jobNameList').innerHTML =
    jobNames.map(name => `<option value="${escapeHtml(name)}">`).join('');

  document.getElementById('storeLocationList').innerHTML =
    storeLocations.map(loc => `<option value="${escapeHtml(loc)}">`).join('');
}

function getFilteredReceipts() {
  if (!searchQuery) return receipts;

  return receipts.filter(receipt => {
    const jobMatch = receipt.job_name?.toLowerCase().includes(searchQuery);
    const storeMatch = receipt.store_location?.toLowerCase().includes(searchQuery);
    return jobMatch || storeMatch;
  });
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
function renderReceipts() {
  const filtered = getFilteredReceipts();

  if (receipts.length === 0) {
    receiptList.innerHTML = '<div class="empty-state"><p>No receipts yet. Click "+ New Receipt" to add one.</p></div>';
    return;
  }

  if (filtered.length === 0) {
    receiptList.innerHTML = '<div class="empty-state"><p>No receipts match your search.</p></div>';
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
            <h3>${escapeHtml(receipt.job_name)}</h3>
            <div class="receipt-meta">
              <span>${formatDate(receipt.receipt_date)}</span>
              ${receipt.store_location ? `<span>${escapeHtml(receipt.store_location)}</span>` : ''}
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
        <td>${escapeHtml(item.item_name)}</td>
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
    return '<div class="receipt-thumbnail"></div>';
  }

  if (receipt.file_type === 'application/pdf') {
    return `<div class="receipt-thumbnail pdf" onclick="openPreview('${receipt.file_path}', 'pdf')">PDF</div>`;
  }

  return `<img class="receipt-thumbnail" src="/uploads/${receipt.file_path}" alt="Receipt" onclick="openPreview('${receipt.file_path}', 'image')">`;
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
        <td>${escapeHtml(item.item_name)}</td>
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
    document.getElementById('jobName').value = receipt.job_name;
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
  }

  openModal(modal);
  document.getElementById('jobName').focus();
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

// File Preview and Rotation
function handleFileSelect(e) {
  const file = e.target.files[0];
  selectedFile = file;
  currentRotation = 0;

  const previewPanel = document.getElementById('filePreviewPanel');
  const previewImage = document.getElementById('previewImage');

  if (!file) {
    previewPanel.hidden = true;
    return;
  }

  if (file.type.startsWith('image/')) {
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
  }
}

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
  const formData = new FormData();

  formData.append('job_name', document.getElementById('jobName').value);
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
    loadReceipts();
    resetFilePreview();
  } catch (err) {
    alert('Failed to save receipt');
  }
}

function resetFilePreview() {
  currentRotation = 0;
  selectedFile = null;
  document.getElementById('filePreviewPanel').hidden = true;
  document.getElementById('previewImage').src = '';
  updateRotationLabel();
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
    if (deleteTarget.type === 'receipt') {
      await deleteReceipt(deleteTarget.id);
      closeModal(deleteModal);
      loadReceipts();
    } else {
      await deleteItem(deleteTarget.id);
      await loadReceipts();

      const receiptId = document.getElementById('itemReceiptId').value;
      const receipt = receipts.find(r => r.id === parseInt(receiptId));
      if (receipt) renderItems(receipt);

      closeModal(deleteModal);
    }
  } catch (err) {
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
  switchTab('receipts');
  openItemsModal(receiptId);
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
