const jwt = require('jsonwebtoken');
const { getUserById } = require('../lib/storage');

const JWT_SECRET = process.env.JWT_SECRET || 'zion_groceries_secret_key_2026';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { req.user = null; }
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  next();
};

const generateToken = (user) => jwt.sign({ id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin || false }, JWT_SECRET, { expiresIn: '7d' });
const validateUser = (userId) => getUserById(userId);

module.exports = { authenticateToken, optionalAuth, isAdmin, generateToken, validateUser, JWT_SECRET };
