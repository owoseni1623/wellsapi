const errorHandler = (err, req, res, next) => {
    // Log error to console for dev
    console.error(err);
  
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: message
      });
    }
  
    // Mongoose duplicate key
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'This information already exists in our system'
      });
    }
  
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Please log in again.'
      });
    }
  
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please log in again.'
      });
    }
  
    // Default server error
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Server Error'
    });
  };
  
  module.exports = errorHandler;