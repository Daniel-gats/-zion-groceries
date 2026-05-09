const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const { authenticateToken, isAdmin, JWT_SECRET } = require('./middleware/auth');
const {
  initStorage,
  getStorageMode,
  getProducts,
  getProductById,
  getProductStats,
  createProduct,
  updateProduct,
  bulkUpsertProducts,
  deleteProduct,
  getOrderStats,
  getOrders,
  getInventoryAlerts,
  getSalesReport
} = require('./lib/storage');

dotenv.config();

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const mpesaRoutes = require('./routes/mpesa');

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicPath));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/mpesa', mpesaRoutes);

function requireAdminRequest(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Admin authentication required' });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) {
      res.status(403).json({ error: 'Admin privileges required' });
      return null;
    }
    return decoded;
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired admin token' });
    return null;
  }
}

app.get('/api/products', async (req, res) => {
  try {
    const adminMode = req.query.admin === '1' || req.query.includeInactive === '1' || req.query.includeOutOfStock === '1';
    if (adminMode && !requireAdminRequest(req, res)) {
      return;
    }
    const products = await getProducts({
      admin: adminMode,
      includeInactive: adminMode && req.query.includeInactive === '1',
      includeOutOfStock: adminMode && req.query.includeOutOfStock === '1',
      category: req.query.category,
      search: req.query.search
    });
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/stats/overview', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [productStats, orderStats] = await Promise.all([getProductStats(), getOrderStats()]);
    res.json({ ...productStats, ...orderStats });
  } catch (error) {
    console.error('Overview stats error:', error);
    res.status(500).json({ error: 'Failed to fetch overview stats' });
  }
});

app.get('/api/admin/inventory-alerts', authenticateToken, isAdmin, async (req, res) => {
  try {
    res.json(await getInventoryAlerts());
  } catch (error) {
    console.error('Inventory alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory alerts' });
  }
});

app.get('/api/admin/reports/sales', authenticateToken, isAdmin, async (req, res) => {
  try {
    res.json(await getSalesReport(req.query.range || '30d'));
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Failed to fetch sales report' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProductById(req.params.id, { includeInactive: req.query.includeInactive === '1' });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Fetch product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.post('/api/products', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price === undefined || !category) return res.status(400).json({ error: 'Name, price, and category are required' });
    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

app.post('/api/products/bulk', authenticateToken, isAdmin, async (req, res) => {
  try {
    const items = Array.isArray(req.body.products) ? req.body.products : [];
    if (!items.length) return res.status(400).json({ error: 'No products provided' });
    const products = await bulkUpsertProducts(items);
    res.json({ message: 'Bulk import complete', products, count: products.length });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to bulk import products' });
  }
});

app.put('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const product = await deleteProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted', product });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

app.get('/api/admin/orders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orders = await getOrders({ isAdmin: true, status: req.query.status, search: req.query.search });
    res.json({ orders });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(publicPath, 'admin.html')));

app.get('/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), storage: await getStorageMode() });
});

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), storage: await getStorageMode() });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
app.use((req, res) => res.status(404).sendFile(path.join(publicPath, 'index.html')));

if (require.main === module) {
  initStorage().finally(() => {
    app.listen(PORT, () => {
      console.log(`Zion Groceries server running on http://localhost:${PORT}`);
      console.log(`Admin panel available at http://localhost:${PORT}/admin`);
      console.log(`Health check at http://localhost:${PORT}/health`);
    });
  });
}

module.exports = app;
