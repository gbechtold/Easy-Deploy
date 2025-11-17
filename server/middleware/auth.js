/**
 * Authentication middleware
 */

/**
 * Ensure user is authenticated
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required'
  });
}

/**
 * Optional authentication (doesn't block if not authenticated)
 */
function optionalAuth(req, res, next) {
  // Just pass through, user info will be available if authenticated
  next();
}

module.exports = {
  ensureAuthenticated,
  optionalAuth
};
