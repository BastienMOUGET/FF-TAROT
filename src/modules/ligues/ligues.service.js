const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

async function list() {
  const conn = await pool.getConnection();
  try {
    return await conn.query(`
      SELECT id, code, name, created_at
      FROM ligues
      ORDER BY name ASC
    `);
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, code, name, created_at FROM ligues WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Ligue introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create({ code, name }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO ligues (code, name) VALUES (?, ?)`,
      [code, name]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function update(id, { code, name }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE ligues SET code = ?, name = ? WHERE id = ?`,
      [code, name, id]
    );
    if (result.affectedRows === 0) throw notFound('Ligue introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM ligues WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Ligue introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
