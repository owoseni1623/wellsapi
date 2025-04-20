const jwt = require('jsonwebtoken');
const User = require('../Model/UserModel');

// Protect routes middleware
exports.protect = async (req, res, next) => {
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  console.log('Headers received:', req.headers);
  
  let token;

  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Get token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token found in authorization header');
  } 
  // Check for token in cookies (if needed)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    console.log('Token found in cookies');
  }

  // If no token found
  if (!token) {
    console.log('No token found, returning 401');
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified, user ID:', decoded.id);

    // Get user from the token
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      console.log('No user found with ID:', decoded.id);
      return res.status(401).json({
        success: false,
        error: 'User not found. Please log in again.'
      });
    }

    console.log('User authenticated:', req.user.email || req.user.username);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this resource'
    });
  }
};

exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Admin role required'
    });
  }
  next();
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this resource`
      });
    }
    next();
  };
};