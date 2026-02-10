import jwt from 'jsonwebtoken';
import db from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, is_admin, user_type FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const hasAdminFlag = req.user.is_admin === 1;
  const hasAdminType = req.user.user_type === 'admin' || req.user.user_type === 'master';

  if (!hasAdminFlag && !hasAdminType) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

export function masterMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.user_type !== 'master') {
    return res.status(403).json({ error: 'Master access required' });
  }

  next();
}

export function generateToken(userId, userType) {
  const payload = { userId };
  
  if (userType) {
    payload.userType = userType;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
