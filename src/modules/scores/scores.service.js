const pool = require('../../config/db');

async function createScores(scores) {
  const conn = await pool.getConnection();

  try {

    for (const s of scores) {

      await conn.query(`
        INSERT INTO scores (
          tournament_id,
          round_id,
          player_id,
          score,
          codif,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        s.tournament_id,
        s.round_id,
        s.player_id,
        s.score,
        s.codif || null,
        s.role
      ]);

    }

    return {
      success: true
    };

  } finally {
    conn.release();
  }
}

async function getScores(tournamentId) {
  const conn = await pool.getConnection();

  try {

    return await conn.query(`
      SELECT *
      FROM scores
      WHERE tournament_id = ?
      ORDER BY round_id ASC
    `, [tournamentId]);

  } finally {
    conn.release();
  }
}

module.exports = {
  createScores,
  getScores
};