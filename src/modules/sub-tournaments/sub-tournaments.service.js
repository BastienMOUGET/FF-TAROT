const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SELECT_BASE = `
  SELECT st.id, st.tournament_id, st.label, st.color, st.color_name,
         st.indice_pcn, st.championnat,
         t.code AS tournament_code, t.name AS tournament_name
  FROM sub_tournaments st
  JOIN tournaments t ON t.id = st.tournament_id
`;

async function listByTournament(tournamentId) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `${SELECT_BASE} WHERE st.tournament_id = ? ORDER BY st.label ASC`,
      [tournamentId]
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`${SELECT_BASE} WHERE st.id = ?`, [id]);
    if (rows.length === 0) throw notFound('Sous-tournoi introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function create(tournamentId, data) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `INSERT INTO sub_tournaments
         (tournament_id, label, color, color_name, indice_pcn, championnat)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tournamentId,
        data.label,
        data.color || null,
        data.color_name || null,
        data.indice_pcn ?? 0,
        data.championnat ? 1 : 0,
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
      `UPDATE sub_tournaments
         SET label = ?, color = ?, color_name = ?,
             indice_pcn = ?, championnat = ?
       WHERE id = ?`,
      [
        data.label,
        data.color || null,
        data.color_name || null,
        data.indice_pcn ?? 0,
        data.championnat ? 1 : 0,
        id,
      ]
    );
    if (result.affectedRows === 0) throw notFound('Sous-tournoi introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM sub_tournaments WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) throw notFound('Sous-tournoi introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { listByTournament, getById, create, update, remove };
