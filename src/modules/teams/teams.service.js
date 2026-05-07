const pool = require('../../config/db');
const { notFound, badRequest } = require('../../utils/httpError');

async function listBySubTournament(subTournamentId) {
  const conn = await pool.getConnection();
  try {
    const teams = await conn.query(
      `SELECT id, sub_tournament_id, team_number
       FROM teams
       WHERE sub_tournament_id = ?
       ORDER BY team_number ASC`,
      [subTournamentId]
    );

    if (teams.length === 0) return teams;

    const ids = teams.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');

    const players = await conn.query(
      `SELECT tp.team_id, tp.player_id, tp.pair, tp.player_number,
              p.licence, p.name, p.firstname, p.club_id, p.category
       FROM team_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.team_id IN (${placeholders})
       ORDER BY tp.team_id, tp.player_number`,
      ids
    );

    const byTeam = new Map();
    for (const row of players) {
      const list = byTeam.get(row.team_id) || [];
      list.push(row);
      byTeam.set(row.team_id, list);
    }

    return teams.map((t) => ({
      ...t,
      players: byTeam.get(t.id) || [],
    }));
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const teams = await conn.query(
      `SELECT id, sub_tournament_id, team_number FROM teams WHERE id = ?`,
      [id]
    );
    if (teams.length === 0) throw notFound('Équipe introuvable');

    const players = await conn.query(
      `SELECT tp.player_id, tp.pair, tp.player_number,
              p.licence, p.name, p.firstname, p.club_id, p.category
       FROM team_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.team_id = ?
       ORDER BY tp.player_number`,
      [id]
    );

    return { ...teams[0], players };
  } finally {
    conn.release();
  }
}

function validatePairs(players) {
  if (!Array.isArray(players) || players.length !== 4) {
    throw badRequest('Une équipe Libre par 4 doit contenir 4 joueurs');
  }

  const ns = players.filter((p) => p.pair === 'NS').length;
  const eo = players.filter((p) => p.pair === 'EO').length;

  if (ns !== 2 || eo !== 2) {
    throw badRequest("L'équipe doit avoir exactement 2 joueurs NS et 2 joueurs EO");
  }

  const ids = players.map((p) => p.player_id);
  if (new Set(ids).size !== ids.length) {
    throw badRequest("Doublon de joueur dans l'équipe");
  }
}

async function create(subTournamentId, { players }) {
  validatePairs(players);

  const conn = await pool.getConnection();
  try {
    // sanity check : sub-tournament exists
    const subt = await conn.query(
      `SELECT id FROM sub_tournaments WHERE id = ?`,
      [subTournamentId]
    );
    if (subt.length === 0) throw notFound('Sous-tournoi introuvable');

    await conn.beginTransaction();
    try {
      const numRow = await conn.query(
        `SELECT COALESCE(MAX(team_number), 0) + 1 AS next_num
         FROM teams WHERE sub_tournament_id = ?`,
        [subTournamentId]
      );
      const teamNumber = Number(numRow[0].next_num);

      const ins = await conn.query(
        `INSERT INTO teams (sub_tournament_id, team_number)
         VALUES (?, ?)`,
        [subTournamentId, teamNumber]
      );
      const teamId = Number(ins.insertId);

      // Insert players in order (player_number 1..4 = 2 NS then 2 EO)
      const ordered = [
        ...players.filter((p) => p.pair === 'NS'),
        ...players.filter((p) => p.pair === 'EO'),
      ];

      for (let i = 0; i < ordered.length; i++) {
        const p = ordered[i];
        await conn.query(
          `INSERT INTO team_players
             (team_id, player_id, pair, player_number)
           VALUES (?, ?, ?, ?)`,
          [teamId, p.player_id, p.pair, i + 1]
        );
      }

      await conn.commit();
      return getByIdInternal(conn, teamId);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
  }
}

async function getByIdInternal(conn, id) {
  const teams = await conn.query(
    `SELECT id, sub_tournament_id, team_number FROM teams WHERE id = ?`,
    [id]
  );
  if (teams.length === 0) throw notFound('Équipe introuvable');

  const players = await conn.query(
    `SELECT tp.player_id, tp.pair, tp.player_number,
            p.licence, p.name, p.firstname, p.club_id, p.category
     FROM team_players tp
     JOIN players p ON p.id = tp.player_id
     WHERE tp.team_id = ?
     ORDER BY tp.player_number`,
    [id]
  );

  return { ...teams[0], players };
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(`DELETE FROM teams WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw notFound('Équipe introuvable');
  } finally {
    conn.release();
  }
}

module.exports = { listBySubTournament, getById, create, remove };
