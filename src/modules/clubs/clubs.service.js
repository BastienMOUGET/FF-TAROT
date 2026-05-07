const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SELECT_BASE = `
  SELECT c.id, c.code, c.name, c.comite_id, c.created_at,
         co.code AS comite_code, co.name AS comite_name,
         co.ligue_id
  FROM clubs c
  LEFT JOIN comites co ON co.id = c.comite_id
`;

async function list({ comite_id } = {}) {
  const conn = await pool.getConnection();
  try {
    if (comite_id) {
      return await conn.query(
        `${SELECT_BASE} WHERE c.comite_id = ? ORDER BY c.name ASC`,
        [comite_id]
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
    if (rows.length === 0) throw notFound('Club introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create({ code, name, comite_id }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO clubs (code, name, comite_id) VALUES (?, ?, ?)`,
      [code, name, comite_id ?? null]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function update(id, { code, name, comite_id }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE clubs SET code = ?, name = ?, comite_id = ? WHERE id = ?`,
      [code, name, comite_id ?? null, id]
    );
    if (result.affectedRows === 0) throw notFound('Club introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM clubs WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Club introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
