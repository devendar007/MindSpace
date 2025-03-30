// middleware/auth.js
const jwt = require('jsonwebtoken');

console.log('Auth middleware loaded'); // Confirm at startup

module.exports = function (req, res, next) {
  console.log('Auth middleware - Entering'); // Confirm entry
  const token = req.header('x-auth-token');
  console.log('Auth middleware - Token received:', token);
  if (!token) {
    console.log('Auth middleware - No token provided');
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    console.log('Auth middleware - JWT_SECRET:', process.env.JWT_SECRET); // Debug secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware - Decoded token:', decoded);
    req.user = decoded.user;
    console.log('Auth middleware - req.user set:', req.user);
    if (!req.user || !req.user.id) {
      throw new Error('Invalid token structure - no user ID');
    }
    next();
  } catch (err) {
    console.error('Auth middleware - Token verification failed:', err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};