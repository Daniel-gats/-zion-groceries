const IS_FILE_MODE = window.location.protocol === 'file:';
const API = IS_FILE_MODE ? '' : '/api';
const LOCAL_PRODUCTS_KEY = 'zion-admin-products';
const LOCAL_ORDERS_KEY = 'zion-orders';
const LOCAL_USERS_KEY = 'zion-admin-users';
const CATALOG_PRODUCTS = Array.isArray(window.ZION_PRODUCTS_CATALOG) ? window.ZION_PRODUCTS_CATALOG : [];
let authToken = localStorage.getItem('token');
let currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
let products = [];
let orders = [];
let users = [];
let inventoryAlerts = { lowStock: [], outOfStock: [], summary: {} };
let salesReport = { totals: {}, topProducts: [], categoryRevenue: [], paymentBreakdown: [] };
let editingId = null;

function sortProductsByName(list) {
  return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
}

const els = {
  productForm: document.getElementById('productForm'), productId: document.getElementById('productId'), productName: document.getElementById('productName'), productPrice: document.getElementById('productPrice'), productStock: document.getElementById('productStock'), productCategory: document.getElementById('productCategory'), productUnit: document.getElementById('productUnit'), productImage: document.getElementById('productImage'), productDescription: document.getElementById('productDescription'), productActive: document.getElementById('productActive'),
  productsTableBody: document.getElementById('productsTableBody'), searchProducts: document.getElementById('searchProducts'), filterVisibility: document.getElementById('filterVisibility'), searchOrders: document.getElementById('searchOrders'), filterOrderStatus: document.getElementById('filterOrderStatus'), ordersList: document.getElementById('ordersList'), bulkJson: document.getElementById('bulkJson'), bulkImportBtn: document.getElementById('bulkImportBtn'), cancelBtn: document.getElementById('cancelBtn'), submitBtn: document.getElementById('submitBtn'), formTitle: document.getElementById('formTitle'), toast: document.getElementById('toast'), authNotice: document.getElementById('authNotice'), authNoticeTitle: document.getElementById('authNoticeTitle'), authNoticeText: document.getElementById('authNoticeText'), bootstrapAdminBtn: document.getElementById('bootstrapAdminBtn'), loginRedirectBtn: document.getElementById('loginRedirectBtn'), grantAdminForm: document.getElementById('grantAdminForm'), grantAdminEmail: document.getElementById('grantAdminEmail'), searchUsers: document.getElementById('searchUsers'), usersTableBody: document.getElementById('usersTableBody'), salesRange: document.getElementById('salesRange'), inventoryAlerts: document.getElementById('inventoryAlerts'), topProducts: document.getElementById('topProducts'), categoryRevenue: document.getElementById('categoryRevenue'), paymentBreakdown: document.getElementById('paymentBreakdown')
};

const statIds = ['totalProducts', 'totalOrders', 'pendingOrders', 'lowStock', 'outOfStock', 'revenue', 'reportOrders', 'reportAverage', 'reportDelivered'];
const stats = Object.fromEntries(statIds.map(id => [id, document.getElementById(id)]));

function showToast(message, tone = 'ok') {
  els.toast.textContent = message;
  els.toast.style.background = tone === 'error' ? '#dc2626' : '#1f6f43';
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function money(v) { return `KSh ${Number(v || 0).toLocaleString()}`; }
function crotonLocation(order) {
  const section = String(order.deliveryAddress || '').replace(/^Crotonridge Estate,\s*/i, '');
  return {
    estate: 'Crotonridge Estate',
    section: section || order.deliveryAddress || '',
    road: order.deliveryCity || '',
    lane: order.deliveryRoom || ''
  };
}
function crotonLocationText(order) {
  const location = crotonLocation(order);
  return `${location.estate}${location.section ? ` • ${location.section}` : ''}${location.road ? ` • ${location.road}` : ''}${location.lane ? ` • ${location.lane}` : ''}`;
}
function badgeClass(stock, active) { if (!active) return 'pill bad'; if (stock <= 0) return 'pill bad'; if (stock <= 10) return 'pill warn'; return 'pill ok'; }
function badgeLabel(stock, active) { if (!active) return 'Hidden'; if (stock <= 0) return 'Out'; if (stock <= 10) return 'Low'; return 'In Stock'; }
function rolePill(user) { return user.isAdmin ? '<span class="pill ok">Admin</span>' : '<span class="pill warn">Customer</span>'; }
function accountPill(user) { return user.isActive === false ? '<span class="pill bad">Inactive</span>' : '<span class="pill ok">Active</span>'; }

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeProduct(product, index = 0) {
  return {
    id: Number(product.id) || Date.now() + index,
    name: product.name || 'Unnamed product',
    price: Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    category: product.category || 'Other',
    unit: product.unit || 'item',
    image: product.image || '',
    description: product.description || '',
    isActive: product.isActive !== false
  };
}

function getLocalProducts() {
  const saved = readJson(LOCAL_PRODUCTS_KEY, null);
  if (Array.isArray(saved) && saved.length) return sortProductsByName(saved.map(normalizeProduct));
  const seeded = sortProductsByName(CATALOG_PRODUCTS.map(normalizeProduct));
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveLocalProducts(nextProducts) {
  products = sortProductsByName(nextProducts.map(normalizeProduct));
  localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
}

function getLocalOrders() {
  const saved = readJson(LOCAL_ORDERS_KEY, readJson('g-man-orders', []));
  return Array.isArray(saved) ? saved.map((order, index) => ({
    id: Number(order.id) || index + 1,
    orderNumber: order.orderNumber || order.id || `LOCAL-${index + 1}`,
    userName: order.userName || order.customerName || order.name || 'Local customer',
    customerPhone: order.customerPhone || order.phone || '',
    deliveryAddress: order.deliveryAddress || order.hostel || '',
    deliveryRoom: order.deliveryRoom || order.room || '',
    items: order.items || [],
    totalAmount: Number(order.totalAmount || order.total) || 0,
    deliveryFee: Number(order.deliveryFee) || 0,
    estimatedDeliveryMinutes: Number(order.estimatedDeliveryMinutes) || 30,
    deliveryDistanceKm: Number(order.deliveryDistanceKm) || 0,
    customerLatitude: order.customerLatitude ?? null,
    customerLongitude: order.customerLongitude ?? null,
    deliveryMapUrl: order.deliveryMapUrl || '',
    notes: order.notes || '',
    status: order.status || 'pending',
    paymentMethod: order.paymentMethod || order.payment || 'cash',
    paymentStatus: order.paymentStatus || 'pending',
    paymentReference: order.paymentReference || '',
    adminNote: order.adminNote || '',
    createdAt: order.createdAt || new Date().toISOString()
  })) : [];
}

function saveLocalOrders(nextOrders) {
  orders = nextOrders;
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
}

function getLocalUsers() {
  const fallbackUser = { id: 1, fullName: 'Local Admin', email: 'admin@local.shop', phone: '', isAdmin: true, isActive: true, createdAt: new Date().toISOString() };
  const saved = readJson(LOCAL_USERS_KEY, null);
  return Array.isArray(saved) && saved.length ? saved : [fallbackUser];
}

function buildOverview(localProducts, localOrders) {
  const pendingStatuses = new Set(['pending', 'sourcing', 'quoted', 'confirmed', 'preparing', 'delivery']);
  return {
    totalProducts: localProducts.length,
    totalOrders: localOrders.length,
    pendingOrders: localOrders.filter(order => pendingStatuses.has(String(order.status))).length,
    lowStock: localProducts.filter(product => product.stock > 0 && product.stock <= 10).length,
    outOfStock: localProducts.filter(product => product.stock <= 0).length,
    revenue: localOrders.filter(order => order.status === 'delivered').reduce((sum, order) => sum + Number(order.totalAmount || 0), 0)
  };
}

function buildInventoryAlerts(localProducts) {
  const lowStock = localProducts.filter(product => product.stock > 0 && product.stock <= 10).map(product => ({ ...product, alert: 'low_stock', suggestedRestock: Math.max(20 - product.stock, 10) }));
  const outOfStock = localProducts.filter(product => product.stock <= 0).map(product => ({ ...product, alert: 'out_of_stock', suggestedRestock: 20 }));
  return { lowStock, outOfStock, summary: { lowStock: lowStock.length, outOfStock: outOfStock.length } };
}

function buildSalesReport(localOrders) {
  const delivered = localOrders.filter(order => order.status === 'delivered');
  const revenue = delivered.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  return {
    totals: {
      orders: localOrders.length,
      deliveredOrders: delivered.length,
      averageOrderValue: delivered.length ? revenue / delivered.length : 0
    },
    topProducts: [],
    categoryRevenue: [],
    paymentBreakdown: []
  };
}

function loadLocalDashboard() {
  products = getLocalProducts();
  orders = getLocalOrders();
  users = getLocalUsers();
  const overview = buildOverview(products, orders);
  inventoryAlerts = buildInventoryAlerts(products);
  salesReport = buildSalesReport(orders);
  stats.totalProducts.textContent = overview.totalProducts;
  stats.totalOrders.textContent = overview.totalOrders;
  stats.pendingOrders.textContent = overview.pendingOrders;
  stats.lowStock.textContent = overview.lowStock;
  stats.outOfStock.textContent = overview.outOfStock;
  stats.revenue.textContent = money(overview.revenue);
  stats.reportOrders.textContent = salesReport.totals.orders;
  stats.reportAverage.textContent = money(salesReport.totals.averageOrderValue);
  stats.reportDelivered.textContent = salesReport.totals.deliveredOrders;
  renderProducts();
  renderOrders();
  renderUsers();
  renderInventoryAlerts();
  renderSalesReport();
}

async function fetchJson(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showAdminNotice(title, text, mode = 'login') {
  if (els.authNotice) els.authNotice.style.display = 'block';
  if (els.authNoticeTitle) els.authNoticeTitle.textContent = title;
  if (els.authNoticeText) els.authNoticeText.textContent = text;
  if (els.bootstrapAdminBtn) els.bootstrapAdminBtn.style.display = mode === 'bootstrap' ? 'inline-flex' : 'none';
  if (els.loginRedirectBtn) els.loginRedirectBtn.style.display = mode === 'login' ? 'inline-flex' : 'none';
}

function printOrderSlip(order) {
  const win = window.open('', '_blank', 'width=860,height=900');
  if (!win) {
    showToast('Allow popups to print the order slip', 'error');
    return;
  }
  const lines = (order.items || []).map(item => `
    <tr>
      <td>${item.productName || item.name}</td>
      <td>${item.quantity || item.qty}</td>
      <td>${money(item.productPrice || item.price)}</td>
      <td>${money((item.productPrice || item.price || 0) * (item.quantity || item.qty || 1))}</td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${order.orderNumber}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#173126}h1,h2{margin:0 0 10px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #dce6d9;padding:10px;text-align:left}th{background:#f3f7f3}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.box{border:1px solid #dce6d9;border-radius:12px;padding:12px}.total{margin-top:16px;font-size:18px;font-weight:700}.muted{color:#6a7a71}</style></head><body><h1>Zion Groceries</h1><div class="muted">Printable order slip</div><div class="meta"><div class="box"><strong>Order</strong><div>${order.orderNumber}</div><div>${new Date(order.createdAt).toLocaleString()}</div></div><div class="box"><strong>Customer</strong><div>${order.userName || 'Customer'}</div><div>${order.customerPhone || ''}</div><div>${crotonLocationText(order)}</div></div><div class="box"><strong>Payment</strong><div>${String(order.paymentMethod || 'cash').toUpperCase()} • ${String(order.paymentStatus || 'pending').replace(/_/g, ' ')}</div><div>Reference: ${order.paymentReference || 'Not added'}</div></div><div class="box"><strong>Operations</strong><div>Status: ${order.status}</div><div>Delivery fee: ${money(order.deliveryFee)}</div><div>ETA: ${order.estimatedDeliveryMinutes || 0} min</div></div></div><h2>Items</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Line Total</th></tr></thead><tbody>${lines}</tbody></table><div class="total">Total: ${money(order.totalAmount)}</div>${order.notes ? `<div class="box" style="margin-top:14px"><strong>Customer Note</strong><div>${order.notes}</div></div>` : ''}${order.adminNote ? `<div class="box" style="margin-top:14px"><strong>Admin Note</strong><div>${order.adminNote}</div></div>` : ''}</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

async function bootstrapCurrentAdmin() {
  if (IS_FILE_MODE) {
    showToast('Local admin mode is already enabled');
    return;
  }
  try {
    const result = await fetchJson(API + '/auth/admin/bootstrap', { method: 'POST' });
    authToken = result.token;
    currentUser = result.user;
    localStorage.setItem('token', result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    showToast('Admin access enabled for this account');
    window.location.reload();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function requireAdminAccess() {
  if (IS_FILE_MODE) {
    if (els.authNotice) els.authNotice.style.display = 'none';
    return true;
  }
  if (!authToken) {
    showAdminNotice('Admin login required', 'Log in with an admin account to manage products and orders.', 'login');
    return false;
  }
  try {
    const profile = await fetchJson(API + '/auth/profile');
    currentUser = profile.user || currentUser;
    if (currentUser) localStorage.setItem('user', JSON.stringify(currentUser));
    if (profile.user?.isAdmin) return true;
    const bootstrap = await fetchJson(API + '/auth/bootstrap-status');
    if (!bootstrap.adminExists) {
      showAdminNotice('No admin exists yet', 'This account can bootstrap the first admin for the shop.', 'bootstrap');
      return false;
    }
    showAdminNotice('Admin access required', 'This account is not an admin. Ask an existing admin to grant access.', 'login');
    return false;
  } catch (error) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = null;
    showAdminNotice('Session expired', 'Log in again to continue.', 'login');
    return false;
  }
}
function resetForm() {
  editingId = null; els.productForm.reset(); els.productId.value = ''; els.productActive.checked = true; els.formTitle.textContent = 'Add Product'; els.submitBtn.textContent = 'Save Product'; els.cancelBtn.style.display = 'none';
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const payload = { name: els.productName.value.trim(), price: Number(els.productPrice.value), stock: Number(els.productStock.value), category: els.productCategory.value, unit: els.productUnit.value, image: els.productImage.value.trim(), description: els.productDescription.value.trim(), isActive: els.productActive.checked };
  if (IS_FILE_MODE) {
    const nextProducts = clone(products);
    if (editingId) {
      const index = nextProducts.findIndex(product => Number(product.id) === Number(editingId));
      if (index >= 0) nextProducts[index] = normalizeProduct({ ...nextProducts[index], ...payload, id: editingId });
    } else {
      const nextId = nextProducts.reduce((max, product) => Math.max(max, Number(product.id) || 0), 0) + 1;
      nextProducts.unshift(normalizeProduct({ ...payload, id: nextId }));
    }
    saveLocalProducts(nextProducts);
    showToast(editingId ? 'Local product updated' : 'Local product added');
    resetForm();
    loadLocalDashboard();
    return;
  }
  try {
    if (editingId) await fetchJson(`${API}/products/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    else await fetchJson(`${API}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    showToast(editingId ? 'Product updated' : 'Product added');
    resetForm();
    await loadDashboard();
  } catch (error) { showToast(error.message, 'error'); }
}

async function handleBulkImport() {
  try {
    const importedProducts = JSON.parse(els.bulkJson.value || '[]');
    if (!Array.isArray(importedProducts) || !importedProducts.length) throw new Error('Paste a JSON array of products first');
    if (IS_FILE_MODE) {
      const existing = new Map(products.map(product => [Number(product.id), product]));
      importedProducts.map(normalizeProduct).forEach(product => existing.set(Number(product.id), product));
      saveLocalProducts([...existing.values()]);
      els.bulkJson.value = '';
      showToast('Local bulk import complete');
      loadLocalDashboard();
      return;
    }
    await fetchJson(`${API}/products/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: importedProducts }) });
    els.bulkJson.value = '';
    showToast('Bulk import complete');
    await loadDashboard();
  } catch (error) { showToast(error.message, 'error'); }
}

async function handleGrantAdmin(event) {
  event.preventDefault();
  const email = els.grantAdminEmail.value.trim().toLowerCase();
  if (!email) return showToast('Enter an email address first', 'error');
  if (IS_FILE_MODE) {
    const nextUsers = getLocalUsers();
    const existing = nextUsers.find(user => user.email === email);
    if (existing) existing.isAdmin = true;
    else nextUsers.push({ id: Date.now(), fullName: email.split('@')[0], email, phone: '', isAdmin: true, isActive: true, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(nextUsers));
    els.grantAdminEmail.value = '';
    showToast('Local admin access granted');
    loadLocalDashboard();
    return;
  }
  try {
    await fetchJson(`${API}/auth/admin/grant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    els.grantAdminEmail.value = '';
    showToast('Admin access granted');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

window.editProduct = (id) => {
  const product = products.find(item => Number(item.id) === Number(id));
  if (!product) return;
  editingId = id; els.productId.value = id; els.productName.value = product.name; els.productPrice.value = product.price; els.productStock.value = product.stock; els.productCategory.value = product.category; els.productUnit.value = product.unit; els.productImage.value = product.image || ''; els.productDescription.value = product.description || ''; els.productActive.checked = product.isActive !== false; els.formTitle.textContent = 'Edit Product'; els.submitBtn.textContent = 'Update Product'; els.cancelBtn.style.display = 'inline-flex'; window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleVisibility = async (id) => {
  const product = products.find(item => Number(item.id) === Number(id)); if (!product) return;
  if (IS_FILE_MODE) {
    saveLocalProducts(products.map(item => Number(item.id) === Number(id) ? { ...item, isActive: item.isActive === false } : item));
    showToast(product.isActive === false ? 'Product shown locally' : 'Product hidden locally');
    loadLocalDashboard();
    return;
  }
  try { await fetchJson(`${API}/products/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: product.isActive === false }) }); showToast(product.isActive === false ? 'Product shown' : 'Product hidden'); await loadDashboard(); } catch (error) { showToast(error.message, 'error'); }
};

window.removeProduct = async (id) => {
  if (!confirm('Delete this product?')) return;
  if (IS_FILE_MODE) {
    saveLocalProducts(products.filter(item => Number(item.id) !== Number(id)));
    showToast('Product deleted locally');
    loadLocalDashboard();
    return;
  }
  try { await fetchJson(`${API}/products/${id}`, { method: 'DELETE' }); showToast('Product deleted'); await loadDashboard(); } catch (error) { showToast(error.message, 'error'); }
};

window.saveOrderMeta = async (id) => {
  const status = document.getElementById(`order-status-${id}`)?.value;
  const paymentStatus = document.getElementById(`payment-status-${id}`)?.value;
  const paymentReference = document.getElementById(`payment-reference-${id}`)?.value || '';
  const adminNote = document.getElementById(`admin-note-${id}`)?.value || '';
  if (IS_FILE_MODE) {
    saveLocalOrders(orders.map(order => Number(order.id) === Number(id) ? { ...order, status, paymentStatus, paymentReference, adminNote } : order));
    showToast('Local order details saved');
    loadLocalDashboard();
    return;
  }
  try {
    await fetchJson(`${API}/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, paymentStatus, paymentReference, adminNote }) });
    showToast('Order details saved');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.printSlip = (id) => {
  const order = orders.find(entry => Number(entry.id) === Number(id));
  if (!order) return;
  printOrderSlip(order);
};

window.toggleUserAdmin = async (id) => {
  const user = users.find(entry => Number(entry.id) === Number(id));
  if (!user) return;
  const nextValue = !user.isAdmin;
  const message = nextValue ? `Grant admin access to ${user.email}?` : `Remove admin access from ${user.email}?`;
  if (!confirm(message)) return;
  if (IS_FILE_MODE) {
    users = users.map(entry => Number(entry.id) === Number(id) ? { ...entry, isAdmin: nextValue } : entry);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    showToast(nextValue ? 'Local admin access granted' : 'Local admin access removed');
    renderUsers();
    return;
  }
  try {
    await fetchJson(`${API}/auth/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin: nextValue }) });
    showToast(nextValue ? 'Admin access granted' : 'Admin access removed');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

window.toggleUserActive = async (id) => {
  const user = users.find(entry => Number(entry.id) === Number(id));
  if (!user) return;
  const nextValue = user.isActive === false;
  const message = nextValue ? `Reactivate ${user.email}?` : `Deactivate ${user.email}?`;
  if (!confirm(message)) return;
  if (IS_FILE_MODE) {
    users = users.map(entry => Number(entry.id) === Number(id) ? { ...entry, isActive: nextValue } : entry);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    showToast(nextValue ? 'Local user reactivated' : 'Local user deactivated');
    renderUsers();
    return;
  }
  try {
    await fetchJson(`${API}/auth/admin/users/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: nextValue }) });
    showToast(nextValue ? 'User reactivated' : 'User deactivated');
    await loadDashboard();
  } catch (error) {
    showToast(error.message, 'error');
  }
};

els.productForm.addEventListener('submit', handleProductSubmit);
els.searchProducts.addEventListener('input', renderProducts);
els.filterVisibility.addEventListener('change', renderProducts);
els.searchOrders.addEventListener('input', renderOrders);
els.filterOrderStatus.addEventListener('change', renderOrders);
els.bulkImportBtn.addEventListener('click', handleBulkImport);
els.cancelBtn.addEventListener('click', resetForm);
if (els.bootstrapAdminBtn) els.bootstrapAdminBtn.addEventListener('click', bootstrapCurrentAdmin);
if (els.grantAdminForm) els.grantAdminForm.addEventListener('submit', handleGrantAdmin);
if (els.searchUsers) els.searchUsers.addEventListener('input', renderUsers);
if (els.salesRange) els.salesRange.addEventListener('change', () => loadDashboard().catch(error => showToast(error.message, 'error')));

document.addEventListener('DOMContentLoaded', async () => {
  const allowed = await requireAdminAccess();
  if (!allowed) return;
  if (IS_FILE_MODE) {
    loadLocalDashboard();
    showToast('Local admin mode loaded');
    return;
  }
  loadDashboard().catch(error => showToast(error.message, 'error'));
});
async function loadDashboard() {
  const selectedRange = els.salesRange?.value || '30d';
  const [overview, productList, orderData, userData, alertsData, reportData] = await Promise.all([
    fetchJson(`${API}/products/stats/overview`),
    fetchJson(`${API}/products?admin=1&includeInactive=1&includeOutOfStock=1`),
    fetchJson(`${API}/admin/orders`),
    fetchJson(`${API}/auth/admin/users`),
    fetchJson(`${API}/admin/inventory-alerts`),
    fetchJson(`${API}/admin/reports/sales?range=${encodeURIComponent(selectedRange)}`)
  ]);
  products = sortProductsByName(productList);
  orders = orderData.orders || [];
  users = userData.users || [];
  inventoryAlerts = alertsData || inventoryAlerts;
  salesReport = reportData || salesReport;
  stats.totalProducts.textContent = overview.totalProducts || 0;
  stats.totalOrders.textContent = overview.totalOrders || 0;
  stats.pendingOrders.textContent = overview.pendingOrders || 0;
  stats.lowStock.textContent = overview.lowStock || 0;
  stats.outOfStock.textContent = overview.outOfStock || 0;
  stats.revenue.textContent = money(overview.revenue || 0);
  stats.reportOrders.textContent = salesReport.totals?.orders || 0;
  stats.reportAverage.textContent = money(salesReport.totals?.averageOrderValue || 0);
  stats.reportDelivered.textContent = salesReport.totals?.deliveredOrders || 0;
  renderProducts();
  renderOrders();
  renderUsers();
  renderInventoryAlerts();
  renderSalesReport();
}

function renderProducts() {
  const term = els.searchProducts.value.trim().toLowerCase();
  const visibility = els.filterVisibility.value;
  const filtered = sortProductsByName(products).filter(product => {
    const searchOk = !term || [product.name, product.category, product.description].join(' ').toLowerCase().includes(term);
    if (!searchOk) return false;
    if (visibility === 'active') return product.isActive !== false;
    if (visibility === 'hidden') return product.isActive === false;
    if (visibility === 'out') return Number(product.stock) <= 0;
    return true;
  });
  els.productsTableBody.innerHTML = filtered.map(product => {
    const productImage = product.image || `https://placehold.co/60x60?text=${encodeURIComponent(product.name || 'Item')}`;
    return `
    <tr>
      <td><div class="product-row"><img src="${productImage}" onerror="this.onerror=null;this.src='https://placehold.co/60x60?text=Item'"><div><div><strong>${product.name}</strong></div><div class="muted small">${product.category}</div></div></div></td>
      <td>${money(product.price)} / ${product.unit}</td>
      <td>${product.stock}</td>
      <td><span class="${badgeClass(Number(product.stock), product.isActive !== false)}">${badgeLabel(Number(product.stock), product.isActive !== false)}</span></td>
      <td><div class="stack"><button class="btn btn-outline" onclick="editProduct(${product.id})">Edit</button><button class="btn btn-outline" onclick="toggleVisibility(${product.id})">${product.isActive === false ? 'Show' : 'Hide'}</button><button class="btn btn-danger" onclick="removeProduct(${product.id})">Delete</button></div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="muted">No products found</td></tr>';
}

function renderOrders() {
  const term = els.searchOrders.value.trim().toLowerCase();
  const status = els.filterOrderStatus.value;
  const filtered = orders.filter(order => {
    const matchesStatus = status === 'all' || String(order.status).toLowerCase() === status;
    const haystack = [order.orderNumber, order.userName, order.customerPhone, ...(order.items || []).map(item => item.productName || item.name)].join(' ').toLowerCase();
    return matchesStatus && (!term || haystack.includes(term));
  });
  els.ordersList.innerHTML = filtered.map(order => `
    <div class="order-box">
      <div class="order-head">
        <div><strong>${order.orderNumber}</strong><div class="muted small">${new Date(order.createdAt).toLocaleString()}</div></div>
        <div class="stack">
          <select id="order-status-${order.id}">
            ${['pending', 'sourcing', 'quoted', 'confirmed', 'preparing', 'delivery', 'delivered', 'cancelled'].map(value => `<option value="${value}" ${order.status === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
          <select id="payment-status-${order.id}">
            ${['pending', 'paid', 'cash_on_delivery', 'failed', 'refunded'].map(value => `<option value="${value}" ${order.paymentStatus === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
          <button class="btn btn-outline" onclick="saveOrderMeta(${order.id})">Save Order</button>
          <button class="btn btn-outline" onclick="printSlip(${order.id})">Print Slip</button>
        </div>
      </div>
      <div class="order-meta">
        <div><strong>${order.userName || 'Customer'}</strong> • ${order.customerPhone || 'No phone'}</div>
        <div><strong>Location:</strong> ${crotonLocationText(order)}</div>
        <div>${(order.items || []).map(item => `${item.productName || item.name} x${item.quantity || item.qty}`).join(', ')}</div>
        <div><strong>${money(order.totalAmount)}</strong> • Delivery ${money(order.deliveryFee)} • ${order.deliveryDistanceKm ? `${order.deliveryDistanceKm} km • ` : ''}ETA ${order.estimatedDeliveryMinutes || 0} min</div>
        ${order.deliveryMapUrl ? `<div><a href="${order.deliveryMapUrl}" target="_blank">Open delivery route in Google Maps</a></div>` : ''}
        <div><strong>Customer note:</strong> ${order.notes || 'None'}</div>
        <div class="two">
          <div><label style="margin-bottom:4px">Payment Reference</label><input id="payment-reference-${order.id}" value="${(order.paymentReference || '').replace(/"/g, '&quot;')}" placeholder="M-Pesa code or cash note"></div>
          <div><label style="margin-bottom:4px">Internal Admin Note</label><textarea id="admin-note-${order.id}" style="min-height:72px">${order.adminNote || ''}</textarea></div>
        </div>
      </div>
    </div>`).join('') || '<div class="muted">No orders found</div>';
}

function renderUsers() {
  const term = (els.searchUsers?.value || '').trim().toLowerCase();
  const filtered = users.filter(user => {
    const haystack = [user.fullName, user.email, user.phone].join(' ').toLowerCase();
    return !term || haystack.includes(term);
  });
  els.usersTableBody.innerHTML = filtered.map(user => `
    <tr>
      <td>
        <div class="user-meta">
          <strong>${user.fullName || 'Unnamed User'}</strong>
          <span class="muted small">${user.email || 'No email'}</span>
          <span class="muted small">${user.phone || 'No phone'}</span>
        </div>
      </td>
      <td>${rolePill(user)}</td>
      <td>${accountPill(user)}</td>
      <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
      <td>
        <div class="stack">
          <button class="btn btn-outline" onclick="toggleUserAdmin(${user.id})">${user.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
          <button class="btn ${user.isActive === false ? 'btn-outline' : 'btn-danger'}" onclick="toggleUserActive(${user.id})">${user.isActive === false ? 'Reactivate' : 'Deactivate'}</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">No users found</td></tr>';
}

function renderInventoryAlerts() {
  const low = inventoryAlerts.lowStock || [];
  const out = inventoryAlerts.outOfStock || [];
  const combined = [...out, ...low].slice(0, 10);
  els.inventoryAlerts.innerHTML = combined.length ? combined.map(product => `
    <div class="alert-item">
      <div><strong>${product.name}</strong><span class="muted small">${product.category} • ${product.stock} left</span></div>
      <div><span class="pill ${product.alert === 'out_of_stock' ? 'bad' : 'warn'}">${product.alert === 'out_of_stock' ? 'Out' : 'Low'}</span><span class="muted small">Restock +${product.suggestedRestock}</span></div>
    </div>`).join('') : '<div class="muted">No inventory alerts right now.</div>';
}

function renderSalesReport() {
  const top = salesReport.topProducts || [];
  const categories = salesReport.categoryRevenue || [];
  const payments = salesReport.paymentBreakdown || [];
  els.topProducts.innerHTML = top.length ? top.map(item => `
    <div class="report-item"><div><strong>${item.name}</strong><span class="muted small">${item.qty} units sold</span></div><div><strong>${money(item.revenue)}</strong></div></div>`).join('') : '<div class="muted">No product sales in this range.</div>';
  els.categoryRevenue.innerHTML = categories.length ? categories.map(item => `
    <div class="report-item"><div><strong>${item.category}</strong><span class="muted small">Category revenue</span></div><div><strong>${money(item.revenue)}</strong></div></div>`).join('') : '<div class="muted">No category revenue yet.</div>';
  els.paymentBreakdown.innerHTML = payments.length ? payments.map(item => `
    <div class="report-item"><div><strong>${String(item.method).toUpperCase()}</strong><span class="muted small">Payment method mix</span></div><div><strong>${money(item.revenue)}</strong></div></div>`).join('') : '<div class="muted">No payment data in this range.</div>';
}
