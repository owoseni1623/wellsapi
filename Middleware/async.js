// middleware/async.js

/**
 * Async handler to wrap async route handlers
 * This eliminates the need for try/catch blocks in controllers
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = fn => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  
  module.exports = asyncHandler;