const pool = require('../../config/db');
const { notFound, badRequest } = require('../../utils/httpError');
const ranking = require('../ranking/ranking.service');

async function get(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    return await conn.query(
      `SELECT place, pp FROM pp_grids
       WHERE sub_tournament_id = ?
       ORDER BY place ASC`,
      [subTournamentId]
    );
  } finally {
    conn.release();
  }
}

// Bulk replace: takes [{place, pp}, ...] and replaces the entire grid for
// the given sub-tournament.
async function replace(subTournamentId, entries) {
  if (!Array.isArray(entries)) {
    throw badRequest('entries doit être un tableau');
  }

  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    await conn.beginTransaction();
    try {
      await conn.query(
        `DELETE FROM pp_grids WHERE sub_tournament_id = ?`,
        [subTournamentId]
      );
      for (const e of entries) {
        if (!Number.isInteger(e.place) || e.place < 1) {
          throw badRequest('Chaque entrée doit avoir un place >= 1');
        }
        if (typeof e.pp !== 'number' && typeof e.pp !== 'string') {
          throw badRequest('Chaque entrée doit avoir un pp numérique');
        }
        await conn.query(
          `INSERT INTO pp_grids (sub_tournament_id, place, pp)
           VALUES (?, ?, ?)`,
          [subTournamentId, e.place, e.pp]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    setImmediate(() => ranking.refreshAndBroadcast(subTournamentId));

    return get(subTournamentId);
  } finally {
    conn.release();
  }
}

async function clear(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');
    await conn.query(
      `DELETE FROM pp_grids WHERE sub_tournament_id = ?`,
      [subTournamentId]
    );
  } finally {
    conn.release();
  }
  setImmediate(() => ranking.refreshAndBroadcast(subTournamentId));
}

module.exports = { get, replace, clear };
