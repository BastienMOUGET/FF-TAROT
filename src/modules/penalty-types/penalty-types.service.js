const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

async function list() {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT id, code, label, default_points
       FROM penalty_types
       ORDER BY label ASC`
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, code, label, default_points
       FROM penalty_types WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Type de pénalité introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create({ code, label, default_points }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO penalty_types (code, label, default_points)
       VALUES (?, ?, ?)`,
      [code, label, default_points ?? 0]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function update(id, { code, label, default_points }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE penalty_types
         SET code = ?, label = ?, default_points = ?
       WHERE id = ?`,
      [code, label, default_points ?? 0, id]
    );
    if (result.affectedRows === 0) throw notFound('Type de pénalité introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM penalty_types WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) throw notFound('Type de pénalité introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
