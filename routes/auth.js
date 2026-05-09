const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateToken, JWT_SECRET } = require('../middleware/auth');
const { getUserByEmail, getUserById, getUsers, createUser, updateUser } = require('../lib/storage');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, address, city } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ error: 'Email, password, and full name are required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    if (await getUserByEmail(email)) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await createUser({ email, passwordHash, fullName, phone, address, city, isAdmin: false, isActive: true });
    const token = generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    res.status(201).json({ message: 'Registration successful', user: safeUser, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });
    const updated = await updateUser(user.id, { lastLogin: new Date().toISOString() });
    const token = generateToken(updated);
    const { passwordHash: _, ...safeUser } = updated;
    res.json({ message: 'Login successful', user: safeUser, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

async function requireUserFromToken(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return null;
    }
    return user;
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
    return null;
  }
}

async function requireAdminFromToken(req, res) {
  const user = await requireUserFromToken(req, res);
  if (!user) return null;
  if (!user.isAdmin) {
    res.status(403).json({ error: 'Admin privileges required' });
    return null;
  }
  return user;
}

router.get('/bootstrap-status', async (req, res) => {
  try {
    const users = await getUsers();
    const adminCount = users.filter(user => user.isAdmin).length;
    res.json({ adminExists: adminCount > 0, adminCount });
  } catch (error) {
    console.error('Bootstrap status error:', error);
    res.status(500).json({ error: 'Failed to fetch bootstrap status' });
  }
});

router.post('/admin/bootstrap', async (req, res) => {
  try {
    const user = await requireUserFromToken(req, res);
    if (!user) return;
    const users = await getUsers();
    const hasAdmin = users.some(entry => entry.isAdmin);
    if (hasAdmin && !user.isAdmin) {
      return res.status(403).json({ error: 'An admin already exists. Ask an admin to grant access.' });
    }
    const updated = await updateUser(user.id, { isAdmin: true });
    const token = generateToken(updated);
    const { passwordHash: _, ...safeUser } = updated;
    res.json({ message: hasAdmin ? 'Admin access refreshed' : 'Admin account bootstrapped successfully', user: safeUser, token });
  } catch (error) {
    console.error('Admin bootstrap error:', error);
    res.status(500).json({ error: 'Failed to bootstrap admin account' });
  }
});

router.post('/admin/grant', async (req, res) => {
  try {
    const requester = await requireAdminFromToken(req, res);
    if (!requester) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Target email is required' });
    }
    const targetUser = await getUserByEmail(email);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found for that email' });
    }
    const updated = await updateUser(targetUser.id, { isAdmin: true });
    const { passwordHash: _, ...safeUser } = updated;
    res.json({ message: 'Admin access granted successfully', user: safeUser });
  } catch (error) {
    console.error('Admin grant error:', error);
    res.status(500).json({ error: 'Failed to grant admin access' });
  }
});

router.get('/admin/users', async (req, res) => {
  try {
    const requester = await requireAdminFromToken(req, res);
    if (!requester) return;
    const users = await getUsers();
    const safeUsers = users
      .map(({ passwordHash, ...user }) => user)
      .sort((a, b) => {
        if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
        return String(a.fullName || '').localeCompare(String(b.fullName || ''));
      });
    res.json({ users: safeUsers });
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/admin/users/:id', async (req, res) => {
  try {
    const requester = await requireAdminFromToken(req, res);
    if (!requester) return;

    const targetUser = await getUserById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    if (req.body.isAdmin !== undefined) updates.isAdmin = !!req.body.isAdmin;
    if (req.body.isActive !== undefined) updates.isActive = !!req.body.isActive;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No access updates provided' });
    }

    const users = await getUsers();
    const adminCount = users.filter(user => user.isAdmin).length;
    const removingAdmin = targetUser.isAdmin && updates.isAdmin === false;
    if (removingAdmin && adminCount <= 1) {
      return res.status(400).json({ error: 'The last admin account cannot be removed' });
    }
    if (Number(targetUser.id) === Number(requester.id) && updates.isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const updated = await updateUser(targetUser.id, updates);
    const { passwordHash: _, ...safeUser } = updated;
    res.json({ message: 'User access updated successfully', user: safeUser });
  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({ error: 'Failed to update user access' });
  }
});

router.get('/profile', async (req, res) => {
  const user = await requireUserFromToken(req, res);
  if (!user) return;
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

router.put('/profile', async (req, res) => {
  try {
    const user = await requireUserFromToken(req, res);
    if (!user) return;
    const updated = await updateUser(user.id, {
      fullName: req.body.fullName,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city
    });
    const { passwordHash: _, ...safeUser } = updated;
    res.json({ message: 'Profile updated successfully', user: safeUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

router.put('/change-password', async (req, res) => {
  try {
    const user = await requireUserFromToken(req, res);
    if (!user) return;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await updateUser(user.id, { passwordHash });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;
