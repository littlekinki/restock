// ============================================================
// ADMIN-ONLY MIDDLEWARE
// ============================================================
// Must be used AFTER the `auth` middleware.
// Grants access if EITHER:
//   1. req.user.role === 'admin' (set in JWT at login)
//   2. req.user.phone matches ADMIN_PHONE env var
// ============================================================

module.exports = function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const isAdminRole = req.user.role === 'admin';
  const isAdminPhone =
    process.env.ADMIN_PHONE &&
    req.user.phone === process.env.ADMIN_PHONE;

  if (!isAdminRole && !isAdminPhone) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }

  next();
};