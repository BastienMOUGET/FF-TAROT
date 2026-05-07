const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');

// Aggregate everything needed to print a route sheet for a sub-tournament.
// Output is shaped for direct rendering by the front (or a PDF generator):
//
//   {
//     tournament: { id, code, name, date },
//     sub_tournament: { id, label, color },
//     rounds: [
//       { round_number, coef,
//         tables: [
//           { table_number, seats: [{seat, player_id, name, firstname, licence, team_number}, ...] },
//           ...
//         ]
//       },
//       ...
//     ]
//   }
async function getForSubTournament(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT st.id, st.label, st.color, st.color_name,
              t.id AS tournament_id, t.code AS tournament_code,
              t.name AS tournament_name, t.date AS tournament_date
       FROM sub_tournaments st
       JOIN tournaments t ON t.id = st.tournament_id
       WHERE st.id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    const rounds = await conn.query(
      `SELECT id, round_number, coef
       FROM rounds
       WHERE sub_tournament_id = ?
       ORDER BY round_number ASC`,
      [subTournamentId]
    );

    if (rounds.length === 0) {
      return shapePayload(subt[0], []);
    }

    const roundIds = rounds.map((r) => r.id);
    const placeholders = roundIds.map(() => '?').join(',');

    const seats = await conn.query(
      `SELECT s.round_id, s.table_number, s.seat,
              s.player_id, s.team_id,
              p.licence, p.name, p.firstname,
              t.team_number
       FROM seats s
       JOIN players p ON p.id = s.player_id
       LEFT JOIN teams t ON t.id = s.team_id
       WHERE s.round_id IN (${placeholders})
       ORDER BY s.round_id, s.table_number, FIELD(s.seat, 'N','S','E','O')`,
      roundIds
    );

    // Group by round -> table
    const byRound = new Map();
    for (const s of seats) {
      let byTable = byRound.get(s.round_id);
      if (!byTable) {
        byTable = new Map();
        byRound.set(s.round_id, byTable);
      }
      let list = byTable.get(s.table_number);
      if (!list) {
        list = [];
        byTable.set(s.table_number, list);
      }
      list.push({
        seat: s.seat,
        player_id: s.player_id,
        team_id: s.team_id,
        team_number: s.team_number,
        licence: s.licence,
        name: s.name,
        firstname: s.firstname,
      });
    }

    const roundsOut = rounds.map((r) => {
      const byTable = byRound.get(r.id) || new Map();
      const tables = [...byTable.entries()]
        .sort(([a], [b]) => a - b)
        .map(([table_number, seats]) => ({ table_number, seats }));
      return {
        round_number: r.round_number,
        coef: r.coef,
        tables,
      };
    });

    return shapePayload(subt[0], roundsOut);
  } finally {
    conn.release();
  }
}

function shapePayload(subt, rounds) {
  return {
    tournament: {
      id: subt.tournament_id,
      code: subt.tournament_code,
      name: subt.tournament_name,
      date: subt.tournament_date,
    },
    sub_tournament: {
      id: subt.id,
      label: subt.label,
      color: subt.color,
      color_name: subt.color_name,
    },
    rounds,
  };
}

module.exports = { getForSubTournament };
