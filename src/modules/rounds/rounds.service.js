const pool = require('../../config/db');
const { notFound, badRequest } = require('../../utils/httpError');
const placement = require('../../utils/placement');
const movementService = require('../movement-patterns/movement-patterns.service');

async function listBySubTournament(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT id, sub_tournament_id, round_number, coef,
              started_at, closed_at
       FROM rounds
       WHERE sub_tournament_id = ?
       ORDER BY round_number ASC`,
      [subTournamentId]
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rounds = await conn.query(
      `SELECT id, sub_tournament_id, round_number, coef,
              started_at, closed_at
       FROM rounds WHERE id = ?`,
      [id]
    );
    if (rounds.length === 0) throw notFound('Round introuvable');

    const seats = await conn.query(
      `SELECT s.table_number, s.seat, s.player_id, s.team_id,
              p.licence, p.name, p.firstname,
              t.team_number
       FROM seats s
       JOIN players p ON p.id = s.player_id
       LEFT JOIN teams t ON t.id = s.team_id
       WHERE s.round_id = ?
       ORDER BY s.table_number ASC, FIELD(s.seat, 'N','S','E','O')`,
      [id]
    );

    // Group by table for nicer payload
    const byTable = new Map();
    for (const row of seats) {
      const list = byTable.get(row.table_number) || [];
      list.push(row);
      byTable.set(row.table_number, list);
    }
    const tables = [...byTable.entries()]
      .sort(([a], [b]) => a - b)
      .map(([table_number, seats]) => ({ table_number, seats }));

    return { ...rounds[0], tables };
  } finally {
    conn.release();
  }
}

async function create(subTournamentId, { coef } = {}) {
  const conn = await pool.getConnection();
  try {
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    const numRow = await conn.query(
      `SELECT COALESCE(MAX(round_number), 0) + 1 AS next_num
       FROM rounds WHERE sub_tournament_id = ?`,
      [subTournamentId]
    );
    const roundNumber = Number(numRow[0].next_num);

    const result = await conn.query(
      `INSERT INTO rounds (sub_tournament_id, round_number, coef)
       VALUES (?, ?, ?)`,
      [subTournamentId, roundNumber, coef ?? 1.0]
    );
    return getById(Number(result.insertId));
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM rounds WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Round introuvable');
  } finally {
    conn.release();
  }
}

// Generate (or regenerate) the placement for a round.
// - Round 1: random table assignment + N/S/E/O within team
// - Round N+1: apply movement_patterns offsets on round N seats
async function generatePlacement(roundId) {
  const conn = await pool.getConnection();
  try {
    const rounds = await conn.query(
      `SELECT id, sub_tournament_id, round_number FROM rounds WHERE id = ?`,
      [roundId]
    );
    if (rounds.length === 0) throw notFound('Round introuvable');
    const round = rounds[0];

    let seats;

    if (round.round_number === 1) {
      // Pull all teams + their 4 players for this sub-tournament
      const teams = await conn.query(
        `SELECT id FROM teams WHERE sub_tournament_id = ?
         ORDER BY team_number ASC`,
        [round.sub_tournament_id]
      );
      if (teams.length === 0) {
        throw badRequest('Aucune équipe inscrite dans ce sous-tournoi');
      }

      const ids = teams.map((t) => t.id);
      const placeholders = ids.map(() => '?').join(',');
      const players = await conn.query(
        `SELECT team_id, player_id, player_number
         FROM team_players
         WHERE team_id IN (${placeholders})
         ORDER BY team_id, player_number`,
        ids
      );

      const playersByTeam = new Map();
      for (const p of players) {
        const list = playersByTeam.get(p.team_id) || [];
        list.push(p);
        playersByTeam.set(p.team_id, list);
      }
      const teamsWithPlayers = teams.map((t) => ({
        id: t.id,
        players: playersByTeam.get(t.id) || [],
      }));

      const incomplete = teamsWithPlayers.filter((t) => t.players.length !== 4);
      if (incomplete.length > 0) {
        throw badRequest(
          `Équipe(s) incomplète(s) : ${incomplete.map((t) => t.id).join(', ')}`
        );
      }

      seats = placement.generateInitialSeats(teamsWithPlayers);
    } else {
      // Find previous round's seats
      const prevRound = await conn.query(
        `SELECT id FROM rounds
         WHERE sub_tournament_id = ? AND round_number = ?`,
        [round.sub_tournament_id, round.round_number - 1]
      );
      if (prevRound.length === 0) {
        throw badRequest('Round précédent introuvable');
      }
      const prevSeats = await conn.query(
        `SELECT table_number, seat, player_id, team_id
         FROM seats WHERE round_id = ?`,
        [prevRound[0].id]
      );
      if (prevSeats.length === 0) {
        throw badRequest(
          'Le round précédent ne contient pas de mise en place'
        );
      }

      const nbTables = Math.max(...prevSeats.map((s) => s.table_number));
      const pattern = await movementService.getForTableCount(nbTables);
      seats = placement.generateNextSeats(prevSeats, pattern);
    }

    // Persist seats in transaction
    await conn.beginTransaction();
    try {
      await conn.query(`DELETE FROM seats WHERE round_id = ?`, [roundId]);
      for (const s of seats) {
        await conn.query(
          `INSERT INTO seats
             (round_id, table_number, seat, player_id, team_id)
           VALUES (?, ?, ?, ?, ?)`,
          [roundId, s.table_number, s.seat, s.player_id, s.team_id]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    return getById(roundId);
  } finally {
    conn.release();
  }
}

module.exports = {
  listBySubTournament,
  getById,
  create,
  remove,
  generatePlacement,
};
