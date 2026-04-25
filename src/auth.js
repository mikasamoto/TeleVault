import { db } from './db.js';

export async function verifyAuth(req) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');

    if (!token) return { valid: false };

    const session = db.prepare(
      `SELECT s.user_id, u.is_admin FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))`
    ).bind(token).first();

    if (!session) return { valid: false };

    const isAdmin = session.is_admin === 1 || session.is_admin === '1' || session.is_admin === true;
    return { valid: true, userId: session.user_id, isAdmin };
  } catch (err) {
    console.error('Auth verification error:', err);
    return { valid: false };
  }
}

export async function verifyAdmin(req) {
  const auth = await verifyAuth(req);
  return auth.valid && auth.isAdmin === true;
}

// Express middleware: require valid session
export function requireAuth(req, res, next) {
  verifyAuth(req).then(auth => {
    if (!auth.valid) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.auth = auth;
    next();
  }).catch(next);
}

// Express middleware: require admin session
export function requireAdmin(req, res, next) {
  verifyAdmin(req).then(isAdmin => {
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
  }).catch(next);
}
