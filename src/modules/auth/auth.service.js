const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { notFound, badRequest, HttpError } = require('../../utils/httpError');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

const ROLES = ['admin', 'arbitre', 'viewer'];

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    full_name: row.full_name,
    email: row.email,
    created_at: row.created_at,
  };
}

async function findByUsername(conn, username) {
  const rows = await conn.query(
    `SELECT id, username, password_hash, role, full_name, email, created_at
     FROM users WHERE username = ?`,
    [username]
  );
  return rows[0] || null;
}

async function login(username, password) {
  const conn = await pool.getConnection();
  try {
    const user = await findByUsername(conn, username);
    if (!user) throw new HttpError(401, 'Identifiants invalides');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Identifiants invalides');

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    return { token, user: publicUser(user) };
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, username, role, full_name, email, created_at
       FROM users WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Utilisateur introuvable');
    return publicUser(rows[0]);
  } finally {
    conn.release();
  }
}

async function list() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, username, role, full_name, email, created_at
       FROM users ORDER BY username ASC`
    );
    return rows.map(publicUser);
  } finally {
    conn.release();
  }
}

async function create({ username, password, role, full_name, email }) {
  if (!ROLES.includes(role)) {
    throw badRequest(`role doit être l'un de ${ROLES.join(', ')}`);
  }
  if (!password || password.length < 6) {
    throw badRequest('password doit faire au moins 6 caractères');
  }
  const password_hash = await bcrypt.hash(password, 10);
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO users (username, password_hash, role, full_name, email)
       VALUES (?, ?, ?, ?, ?)`,
      [username, password_hash, role, full_name || null, email || null]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function changePassword(userId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw badRequest('password doit faire au moins 6 caractères');
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [password_hash, userId]
    );
    if (result.affectedRows === 0) throw notFound('Utilisateur introuvable');
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM users WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Utilisateur introuvable');
  } finally {
    conn.release();
  }
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
}

module.exports = {
  ROLES,
  login,
  getById,
  list,
  create,
  changePassword,
  remove,
  verifyToken,
};
