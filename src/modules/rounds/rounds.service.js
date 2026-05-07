const pool = require('../../config/db');

async function createRound(tournamentId, roundNumber) {
  const conn = await pool.getConnection();

  try {
    const result = await conn.query(`
      INSERT INTO rounds (tournament_id, round_number)
      VALUES (?, ?)
    `, [tournamentId, roundNumber]);

    return {
      id: result.insertId,
      tournament_id: tournamentId,
      round_number: roundNumber
    };

  } finally {
    conn.release();
  }
}

async function getRounds(tournamentId) {
  const conn = await pool.getConnection();

  try {
    return await conn.query(`
      SELECT *
      FROM rounds
      WHERE tournament_id = ?
      ORDER BY round_number
    `, [tournamentId]);

  } finally {
    conn.release();
  }
}

module.exports = {
  createRound,
  getRounds
};