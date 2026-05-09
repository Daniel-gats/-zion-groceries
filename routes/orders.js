const express = require('express');
const { authenticateToken, optionalAuth, isAdmin } = require('../middleware/auth');
const { getProductById, createOrder, getOrders, getOrderById, updateOrderStatus } = require('../lib/storage');

const router = express.Router();
const validStatuses = ['pending', 'sourcing', 'quoted', 'confirmed', 'preparing', 'delivery', 'delivered', 'cancelled'];
const paymentStatuses = ['pending', 'paid', 'cash_on_delivery', 'failed', 'refunded'];
const sameId = (a, b) => String(a) === String(b);

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { items, deliveryAddress, deliveryCity, deliveryRoom, notes, paymentMethod, customerName, customerPhone, customerLatitude, customerLongitude, deliveryLatitude, deliveryLongitude } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain at least one item' });

    let subtotalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await getProductById(item.productId);
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
      const quantity = Number.parseInt(item.quantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: `Invalid quantity for product ${item.productId}` });
      if (product.stock < quantity) return res.status(400).json({ error: `${product.name} has only ${product.stock} left in stock` });
      const subtotal = product.price * quantity;
      subtotalAmount += subtotal;
      orderItems.push({ productId: product.id, productName: product.name, productPrice: product.price, quantity, subtotal, image: product.image, unit: product.unit });
    }

    const normalizedPaymentMethod = paymentMethod === 'cod' ? 'cash' : (paymentMethod || 'cash');
    const status = normalizedPaymentMethod === 'mpesa' ? 'pending' : 'confirmed';
    const paymentStatus = normalizedPaymentMethod === 'mpesa' ? 'pending' : 'cash_on_delivery';

    const order = await createOrder({
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userName: req.user?.fullName || customerName || 'Guest Customer',
      customerPhone: customerPhone || '',
      deliveryAddress: deliveryAddress || '',
      deliveryCity: deliveryCity || deliveryAddress || '',
      deliveryRoom: deliveryRoom || '',
      notes: notes || '',
      customerLatitude: customerLatitude ?? deliveryLatitude,
      customerLongitude: customerLongitude ?? deliveryLongitude,
      paymentMethod: normalizedPaymentMethod,
      paymentStatus,
      status,
      isGuestOrder: !req.user,
      items: orderItems,
      subtotalAmount
    });

    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const orders = await getOrders({ userId: req.user.id, isAdmin: false });
    res.json({ orders });
  } catch (error) {
    console.error('Fetch my orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!sameId(order.userId, req.user.id) && !req.user.isAdmin) return res.status(403).json({ error: 'Access denied' });
    res.json({ order });
  } catch (error) {
    console.error('Fetch order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const orders = await getOrders({ isAdmin: true, status: req.query.status, search: req.query.search });
    res.json({ orders });
  } catch (error) {
    console.error('Fetch all orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { status, paymentStatus, adminNote, paymentReference } = req.body;
    if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    if (paymentStatus && !paymentStatuses.includes(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status' });
    const order = await updateOrderStatus(req.params.id, { status, paymentStatus, adminNote, paymentReference });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order status updated successfully', order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!sameId(order.userId, req.user.id) && !req.user.isAdmin) return res.status(403).json({ error: 'Access denied' });
    if (!['pending', 'confirmed'].includes(order.status) && !req.user.isAdmin) return res.status(400).json({ error: 'Only pending or confirmed orders can be cancelled' });
    const cancelled = await updateOrderStatus(req.params.id, { status: 'cancelled' });
    res.json({ message: 'Order cancelled successfully', order: cancelled });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
