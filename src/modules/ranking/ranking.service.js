const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

const SEAT_COL = { N: 'score_n', S: 'score_s', E: 'score_e', O: 'score_o' };

/* -----------------------------------------------------------
 * Compute the ranking for a sub-tournament from the raw scores
 * stored in table_results (Libre par 4 model: direct sum, no topage).
 * Idempotent: deletes & re-inserts the rankings rows.
 * ----------------------------------------------------------- */
async function compute(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT st.id, st.tournament_id, t.coef_default
       FROM sub_tournaments st
       JOIN tournaments t ON t.id = st.tournament_id
       WHERE st.id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');
    const tournamentId = subt[0].tournament_id;
    const coef = Number(subt[0].coef_default) || 1;

    // 1. All players inscribed in this sub-tournament (via teams)
    const players = await conn.query(
      `SELECT DISTINCT tp.player_id, p.name, p.firstname
       FROM team_players tp
       JOIN teams t ON t.id = tp.team_id
       JOIN players p ON p.id = tp.player_id
       WHERE t.sub_tournament_id = ?`,
      [subTournamentId]
    );

    // 2. All rounds for this sub-tournament
    const rounds = await conn.query(
      `SELECT id, round_number, coef
       FROM rounds
       WHERE sub_tournament_id = ?
       ORDER BY round_number ASC`,
      [subTournamentId]
    );

    // 3. All seats and table_results for these rounds (only validated ones)
    let scoreByPlayer = new Map();
    let roundsPlayedByPlayer = new Map();

    if (rounds.length > 0) {
      const roundIds = rounds.map((r) => r.id);
      const placeholders = roundIds.map(() => '?').join(',');

      // Join seats with table_results to find each player's score per round
      const rows = await conn.query(
        `SELECT s.player_id, s.seat, s.round_id, s.table_number,
                tr.score_n, tr.score_s, tr.score_e, tr.score_o,
                tr.validated, r.coef AS round_coef
         FROM seats s
         JOIN rounds r ON r.id = s.round_id
         LEFT JOIN table_results tr
           ON tr.round_id = s.round_id AND tr.table_number = s.table_number
         WHERE s.round_id IN (${placeholders})`,
        roundIds
      );

      for (const row of rows) {
        const seatScore = row[SEAT_COL[row.seat]];
        if (seatScore === null || seatScore === undefined) continue;
        if (!row.validated) continue;

        const score = Number(seatScore) * Number(row.round_coef || 1);
        const cur = scoreByPlayer.get(row.player_id) || 0;
        scoreByPlayer.set(row.player_id, cur + score);

        const played = roundsPlayedByPlayer.get(row.player_id) || 0;
        roundsPlayedByPlayer.set(row.player_id, played + 1);
      }
    }

    // 4. Penalties for the parent tournament (Libre par 4 V1: tournament-scoped)
    const penaltyRows = await conn.query(
      `SELECT player_id, COALESCE(SUM(points), 0) AS total_pts
       FROM penalties
       WHERE tournament_id = ?
       GROUP BY player_id`,
      [tournamentId]
    );
    const penaltyByPlayer = new Map(
      penaltyRows.map((r) => [r.player_id, Number(r.total_pts)])
    );

    // 5. Build ranking objects
    const ranking = players.map((p) => {
      const sumScores = scoreByPlayer.get(p.player_id) || 0;
      const total = sumScores * coef;
      const penalty = penaltyByPlayer.get(p.player_id) || 0;
      const total_general = total + penalty * coef;
      return {
        player_id: p.player_id,
        name: p.name,
        firstname: p.firstname,
        rounds_played: roundsPlayedByPlayer.get(p.player_id) || 0,
        total,
        total_general,
      };
    });

    // 6. Sort by total_general DESC, assign places (ties share the same place)
    ranking.sort((a, b) => b.total_general - a.total_general);
    let place = 1;
    for (let i = 0; i < ranking.length; i++) {
      if (i > 0 && ranking[i].total_general < ranking[i - 1].total_general) {
        place = i + 1;
      }
      ranking[i].place = place;
    }

    // 7. Persist (idempotent: replace all rows for this sub_tournament)
    await conn.beginTransaction();
    try {
      await conn.query(
        `DELETE FROM rankings WHERE sub_tournament_id = ?`,
        [subTournamentId]
      );
      for (const r of ranking) {
        await conn.query(
          `INSERT INTO rankings
             (sub_tournament_id, player_id, rounds_played,
              total, total_general, place, eliminated)
           VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
          [
            subTournamentId,
            r.player_id,
            r.rounds_played,
            r.total,
            r.total_general,
            r.place,
          ]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    return ranking;
  } finally {
    conn.release();
  }
}

async function getRanking(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    return await conn.query(
      `SELECT r.player_id, p.licence, p.name, p.firstname,
              r.rounds_played, r.total, r.total_general, r.place,
              r.eliminated, r.updated_at
       FROM rankings r
       JOIN players p ON p.id = r.player_id
       WHERE r.sub_tournament_id = ?
       ORDER BY r.place ASC, p.name ASC`,
      [subTournamentId]
    );
  } finally {
    conn.release();
  }
}

// Recompute + broadcast via socket if available. Never throws (silently
// ignores errors so the caller's main op succeeds even if ranking fails).
async function refreshAndBroadcast(subTournamentId) {
  try {
    const ranking = await compute(subTournamentId);
    try {
      const { getIO } = require('../../socket');
      getIO().emit('ranking:update', {
        sub_tournament_id: Number(subTournamentId),
        ranking,
      });
    } catch (_) {
      // socket not initialised (e.g. tests) — skip silently
    }
    return ranking;
  } catch (err) {
    console.error('[ranking refresh failed]', err.message);
    return null;
  }
}

module.exports = { compute, getRanking, refreshAndBroadcast };
