const { verifyToken } = require('../modules/auth/auth.service');
const { HttpError } = require('../utils/httpError');

// Reads `Authorization: Bearer <jwt>` and attaches req.user if valid.
// On invalid token : HTTP 401. On no token : silent (req.user stays null).
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    req.user = null;
    return next();
  }
  const payload = verifyToken(match[1]);
  if (!payload) {
    return next(new HttpError(401, 'Token invalide ou expiré'));
  }
  req.user = {
    id: payload.sub,
    username: payload.username,
    role: payload.role,
  };
  next();
}

// Forces an authenticated user (any role).
function requireAuth(req, res, next) {
  if (!req.user) return next(new HttpError(401, 'Authentification requise'));
  next();
}

// Forces a specific role (or list of roles).
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentification requise'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Accès refusé : rôle insuffisant'));
    }
    next();
  };
}

module.exports = { authenticate, requireAuth, requireRole };
