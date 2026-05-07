const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SELECT_BASE = `
  SELECT p.id, p.licence, p.name, p.firstname, p.club_id,
         p.category, p.gender, p.birth_year, p.created_at,
         c.code AS club_code, c.name AS club_name
  FROM players p
  LEFT JOIN clubs c ON c.id = p.club_id
`;

async function list({ search, club_id, licence } = {}) {
  const conn = await pool.getConnection();
  try {
    const where = [];
    const params = [];

    if (licence) {
      where.push('p.licence = ?');
      params.push(licence);
    }
    if (club_id) {
      where.push('p.club_id = ?');
      params.push(Number(club_id));
    }
    if (search) {
      where.push('(p.name LIKE ? OR p.firstname LIKE ? OR p.licence LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const sql =
      SELECT_BASE +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY p.name ASC, p.firstname ASC';

    return await conn.query(sql, params);
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`${SELECT_BASE} WHERE p.id = ?`, [id]);
    if (rows.length === 0) throw notFound('Joueur introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create({
  licence,
  name,
  firstname,
  club_id,
  category,
  gender,
  birth_year,
}) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO players
         (licence, name, firstname, club_id, category, gender, birth_year)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        licence || null,
        name,
        firstname,
        club_id ?? null,
        category || null,
        gender || null,
        birth_year || null,
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
      `UPDATE players
         SET licence = ?, name = ?, firstname = ?, club_id = ?,
             category = ?, gender = ?, birth_year = ?
       WHERE id = ?`,
      [
        data.licence || null,
        data.name,
        data.firstname,
        data.club_id ?? null,
        data.category || null,
        data.gender || null,
        data.birth_year || null,
        id,
      ]
    );
    if (result.affectedRows === 0) throw notFound('Joueur introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM players WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Joueur introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { list, getById, create, update, remove };
