const pool = require('../../config/db');
const { computeTopage, computePlayerScore } = require('../../utils/fft');

async function getRanking(tournamentId) {
  const conn = await pool.getConnection();

  try {
    // récupérer scores
    const scores = await conn.query(`
      SELECT player_id, round_id, score, codif, role
      FROM scores
      WHERE tournament_id = ?
    `, [tournamentId]);

    // group by round
    const rounds = {};
    scores.forEach(s => {
      if (!rounds[s.round_id]) rounds[s.round_id] = [];
      rounds[s.round_id].push(s);
    });

    // calcul topage par round
    const playerNotes = {};

    Object.values(rounds).forEach(round => {
      const result = computeTopage(round);

      result.forEach(r => {
        if (!playerNotes[r.player_id]) playerNotes[r.player_id] = [];
        playerNotes[r.player_id].push(r.note);
      });
    });

    // pénalités
    const penalties = await conn.query(`
      SELECT player_id, SUM(points) as total
      FROM penalties
      WHERE tournament_id = ?
      GROUP BY player_id
    `, [tournamentId]);

    const penaltyMap = {};
    penalties.forEach(p => penaltyMap[p.player_id] = p.total);

    // calcul final
    const ranking = Object.keys(playerNotes).map(playerId => {
      const notes = playerNotes[playerId];

      const result = computePlayerScore(
        notes,
        penaltyMap[playerId] || 0,
        1,
        0
      );

      return {
        player_id: playerId,
        ...result
      };
    });

    // tri final
    ranking.sort((a, b) => b.general - a.general);

    // assignation rang
    let rank = 1;
    ranking.forEach((r, i) => {
      if (i > 0 && r.general < ranking[i - 1].general) {
        rank = i + 1;
      }
      r.rank = rank;
    });

    return ranking;

  } finally {
    conn.release();
  }
}

module.exports = { getRanking };