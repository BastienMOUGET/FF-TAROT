const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SELECT_BASE = `
  SELECT t.id, t.code, t.name, t.date, t.type, t.status,
         t.current_round, t.coef_default,
         t.club_id, t.comite_id, t.created_at,
         cl.code AS club_code, cl.name AS club_name,
         co.code AS comite_code, co.name AS comite_name
  FROM tournaments t
  LEFT JOIN clubs cl   ON cl.id = t.club_id
  LEFT JOIN comites co ON co.id = t.comite_id
`;

async function list({ status, type, club_id, comite_id } = {}) {
  const conn = await pool.getConnection();
  try {
    const where = [];
    const params = [];
    if (status)    { where.push('t.status = ?');    params.push(status);    }
    if (type)      { where.push('t.type = ?');      params.push(type);      }
    if (club_id)   { where.push('t.club_id = ?');   params.push(Number(club_id)); }
    if (comite_id) { where.push('t.comite_id = ?'); params.push(Number(comite_id)); }

    const sql =
      SELECT_BASE +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY t.date DESC, t.id DESC';
    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`${SELECT_BASE} WHERE t.id = ?`, [id]);
    if (rows.length === 0) throw notFound('Tournoi introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create(data) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO tournaments
         (code, name, date, type, status, current_round,
          coef_default, club_id, comite_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.code,
        data.name,
        data.date || null,
        data.type || 'libre',
        data.status || 'draft',
        data.current_round ?? 0,
        data.coef_default ?? 1.0,
        data.club_id ?? null,
        data.comite_id ?? null,
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
      `UPDATE tournaments
         SET code = ?, name = ?, date = ?, type = ?, status = ?,
             current_round = ?, coef_default = ?,
             club_id = ?, comite_id = ?
       WHERE id = ?`,
      [
        data.code,
        data.name,
        data.date || null,
        data.type || 'libre',
        data.status || 'draft',
        data.current_round ?? 0,
        data.coef_default ?? 1.0,
        data.club_id ?? null,
        data.comite_id ?? null,
        id,
      ]
    );
    if (result.affectedRows === 0) throw notFound('Tournoi introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM tournaments WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) throw notFound('Tournoi introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
