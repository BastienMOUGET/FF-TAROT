const pool = require('../../config/db');
const { notFound } = require('../../utils/httpError');
const ranking = require('../ranking/ranking.service');

const SELECT_BASE = `
  SELECT pe.id, pe.tournament_id, pe.player_id, pe.type_id,
         pe.points, pe.reason, pe.applied_round_id, pe.created_at,
         pl.name AS player_name, pl.firstname AS player_firstname,
         pt.code AS type_code, pt.label AS type_label
  FROM penalties pe
  JOIN players pl ON pl.id = pe.player_id
  LEFT JOIN penalty_types pt ON pt.id = pe.type_id
`;

// Refresh ranking for every sub-tournament of the parent tournament,
// since a penalty applies at tournament level.
async function refreshTournamentRankings(tournamentId) {
  const conn = await pool.getConnection();
  let subIds = [];
  try {
    const rows = await conn.query(
      `SELECT id FROM sub_tournaments WHERE tournament_id = ?`,
      [tournamentId]
    );
    subIds = rows.map((r) => r.id);
  } finally {
    conn.release();
  }
  for (const id of subIds) {
    setImmediate(() => ranking.refreshAndBroadcast(id));
  }
}

async function listByTournament(tournamentId) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `${SELECT_BASE} WHERE pe.tournament_id = ?
       ORDER BY pe.created_at DESC`,
      [tournamentId]
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(`${SELECT_BASE} WHERE pe.id = ?`, [id]);
    if (rows.length === 0) throw notFound('Pénalité introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

// Resolves points: if not provided, use default_points of type (if any).
async function resolvePoints(conn, type_id, points) {
  if (points !== undefined && points !== null) return points;
  if (!type_id) return 0;
  const rows = await conn.query(
    `SELECT default_points FROM penalty_types WHERE id = ?`,
    [type_id]
  );
  return rows.length > 0 ? Number(rows[0].default_points) : 0;
}

async function create(tournamentId, data) {
  const conn = await pool.getConnection();
  try {
    const points = await resolvePoints(conn, data.type_id, data.points);
    const result = await conn.query(
      `INSERT INTO penalties
         (tournament_id, player_id, type_id, points, reason, applied_round_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tournamentId,
        data.player_id,
        data.type_id ?? null,
        points,
        data.reason || null,
        data.applied_round_id ?? null,
      ]
    );
    const created = await conn.query(`${SELECT_BASE} WHERE pe.id = ?`, [
      Number(result.insertId),
    ]);
    return created[0];
  } finally {
    conn.release();
    refreshTournamentRankings(tournamentId);
  }
}

async function update(id, data) {
  const conn = await pool.getConnection();
  let tournamentId = null;
  try {
    const existing = await conn.query(
      `SELECT id, tournament_id FROM penalties WHERE id = ?`,
      [id]
    );
    if (existing.length === 0) throw notFound('Pénalité introuvable');
    tournamentId = existing[0].tournament_id;

    const result = await conn.query(
      `UPDATE penalties
         SET player_id = ?, type_id = ?, points = ?,
             reason = ?, applied_round_id = ?
       WHERE id = ?`,
      [
        data.player_id,
        data.type_id ?? null,
        data.points,
        data.reason || null,
        data.applied_round_id ?? null,
        id,
      ]
    );
    if (result.affectedRows === 0) throw notFound('Pénalité introuvable');
    const updated = await conn.query(`${SELECT_BASE} WHERE pe.id = ?`, [id]);
    return updated[0];
  } finally {
    conn.release();
    if (tournamentId) refreshTournamentRankings(tournamentId);
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  let tournamentId = null;
  try {
    const existing = await conn.query(
      `SELECT id, tournament_id FROM penalties WHERE id = ?`,
      [id]
    );
    if (existing.length === 0) throw notFound('Pénalité introuvable');
    tournamentId = existing[0].tournament_id;
    await conn.query(`DELETE FROM penalties WHERE id = ?`, [id]);
  } finally {
    conn.release();
    if (tournamentId) refreshTournamentRankings(tournamentId);
  }
}

module.exports = { listByTournament, getById, create, update, remove };
