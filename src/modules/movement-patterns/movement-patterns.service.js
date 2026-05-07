const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

async function list() {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT id, table_count, offset_n, offset_s, offset_e, offset_o, label
       FROM movement_patterns
       ORDER BY table_count ASC`
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, table_count, offset_n, offset_s, offset_e, offset_o, label
       FROM movement_patterns WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Patron de mouvement introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

// Resolve the offset table to apply for a given table_count.
// Pattern with table_count = X wins; otherwise we fall back to default (0).
async function getForTableCount(tableCount) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, table_count, offset_n, offset_s, offset_e, offset_o, label
       FROM movement_patterns
       WHERE table_count IN (?, 0)
       ORDER BY table_count = ? DESC
       LIMIT 1`,
      [tableCount, tableCount]
    );
    if (rows.length === 0) {
      // Should not happen if seed is in place, but be safe:
      return { table_count: 0, offset_n: 0, offset_s: 1, offset_e: 2, offset_o: -1 };
    }
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create(data) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO movement_patterns
         (table_count, offset_n, offset_s, offset_e, offset_o, label)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.table_count,
        data.offset_n ?? 0,
        data.offset_s ?? 1,
        data.offset_e ?? 2,
        data.offset_o ?? -1,
        data.label || null,
      ]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function update(id, data) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE movement_patterns
         SET table_count = ?, offset_n = ?, offset_s = ?, offset_e = ?,
             offset_o = ?, label = ?
       WHERE id = ?`,
      [
        data.table_count,
        data.offset_n ?? 0,
        data.offset_s ?? 1,
        data.offset_e ?? 2,
        data.offset_o ?? -1,
        data.label || null,
        id,
      ]
    );
    if (result.affectedRows === 0) throw notFound('Patron introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM movement_patterns WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) throw notFound('Patron introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, getForTableCount, create, update, remove };
