const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SELECT_BASE = `
  SELECT c.id, c.code, c.name, c.ligue_id, c.created_at,
         l.code AS ligue_code, l.name AS ligue_name
  FROM comites c
  LEFT JOIN ligues l ON l.id = c.ligue_id
`;

async function list({ ligue_id } = {}) {
  const conn = await pool.getConnection();
  try {
    if (ligue_id) {
      return await conn.query(
        `${SELECT_BASE} WHERE c.ligue_id = ? ORDER BY c.name ASC`,
        [ligue_id]
      );
    }
    return await conn.query(`${SELECT_BASE} ORDER BY c.name ASC`);
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`${SELECT_BASE} WHERE c.id = ?`, [id]);
    if (rows.length === 0) throw notFound('Comité introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create({ code, name, ligue_id }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO comites (code, name, ligue_id) VALUES (?, ?, ?)`,
      [code, name, ligue_id ?? null]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function update(id, { code, name, ligue_id }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE comites SET code = ?, name = ?, ligue_id = ? WHERE id = ?`,
      [code, name, ligue_id ?? null, id]
    );
    if (result.affectedRows === 0) throw notFound('Comité introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM comites WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Comité introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
