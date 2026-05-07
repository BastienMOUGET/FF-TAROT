const pool = require('../../config/db');
const { notFound, badRequest } = require('../../utils/httpError');
const ranking = require('../ranking/ranking.service');

const SEATS = ['N', 'S', 'E', 'O'];

// Run a ranking refresh + broadcast in the background. Never blocks
// the caller and never throws (errors logged in ranking module).
function scheduleRankingRefresh(subTournamentId) {
  setImmediate(() => ranking.refreshAndBroadcast(subTournamentId));
}

/* -----------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------- */

async function findRoundOrFail(conn, roundId) {
  const rows = await conn.query(
    `SELECT id, sub_tournament_id FROM rounds WHERE id = ?`,
    [roundId]
  );
  if (rows.length === 0) throw notFound('Round introuvable');
  return rows[0];
}

async function getSubTournamentIdForHand(conn, handId) {
  const rows = await conn.query(
    `SELECT r.sub_tournament_id
     FROM hand_results h
     JOIN table_results tr ON tr.id = h.table_result_id
     JOIN rounds r ON r.id = tr.round_id
     WHERE h.id = ?`,
    [handId]
  );
  return rows.length > 0 ? rows[0].sub_tournament_id : null;
}

async function findTableResult(conn, roundId, tableNumber) {
  const rows = await conn.query(
    `SELECT * FROM table_results WHERE round_id = ? AND table_number = ?`,
    [roundId, tableNumber]
  );
  return rows[0] || null;
}

// Get or create the table_result row for (round, table). Caller owns the conn.
async function ensureTableResult(conn, roundId, tableNumber) {
  let tr = await findTableResult(conn, roundId, tableNumber);
  if (tr) return tr;

  // Validate the table number actually has a placement in this round
  const seats = await conn.query(
    `SELECT 1 FROM seats WHERE round_id = ? AND table_number = ? LIMIT 1`,
    [roundId, tableNumber]
  );
  if (seats.length === 0) {
    throw badRequest(
      `Aucune mise en place pour la table ${tableNumber} de ce round`
    );
  }

  const result = await conn.query(
    `INSERT INTO table_results (round_id, table_number) VALUES (?, ?)`,
    [roundId, tableNumber]
  );
  return findTableResult(conn, roundId, tableNumber);
}

async function recomputeTotals(conn, tableResultId) {
  const sums = await conn.query(
    `SELECT
       COALESCE(SUM(score_n), 0) AS sn,
       COALESCE(SUM(score_s), 0) AS ss,
       COALESCE(SUM(score_e), 0) AS se,
       COALESCE(SUM(score_o), 0) AS so
     FROM hand_results
     WHERE table_result_id = ?`,
    [tableResultId]
  );
  const row = sums[0];
  await conn.query(
    `UPDATE table_results
       SET score_n = ?, score_s = ?, score_e = ?, score_o = ?
     WHERE id = ?`,
    [Number(row.sn), Number(row.ss), Number(row.se), Number(row.so), tableResultId]
  );
}

async function loadTableResultWithHands(conn, tableResultId) {
  const trs = await conn.query(
    `SELECT * FROM table_results WHERE id = ?`,
    [tableResultId]
  );
  if (trs.length === 0) throw notFound('Résultat de table introuvable');

  const hands = await conn.query(
    `SELECT id, hand_number, taker_seat,
            score_n, score_s, score_e, score_o
     FROM hand_results
     WHERE table_result_id = ?
     ORDER BY hand_number ASC`,
    [tableResultId]
  );
  return { ...trs[0], hands };
}

/* -----------------------------------------------------------
 * table_results : queries / actions
 * ----------------------------------------------------------- */

async function listByRound(roundId) {
  const conn = await pool.getConnection();
  try {
    await findRoundOrFail(conn, roundId);
    const trs = await conn.query(
      `SELECT * FROM table_results WHERE round_id = ?
       ORDER BY table_number ASC`,
      [roundId]
    );
    if (trs.length === 0) return [];

    const ids = trs.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const hands = await conn.query(
      `SELECT id, table_result_id, hand_number, taker_seat,
              score_n, score_s, score_e, score_o
       FROM hand_results
       WHERE table_result_id IN (${placeholders})
       ORDER BY table_result_id, hand_number ASC`,
      ids
    );
    const byTr = new Map();
    for (const h of hands) {
      const list = byTr.get(h.table_result_id) || [];
      list.push(h);
      byTr.set(h.table_result_id, list);
    }
    return trs.map((t) => ({ ...t, hands: byTr.get(t.id) || [] }));
  } finally {
    conn.release();
  }
}

async function getByRoundAndTable(roundId, tableNumber) {
  const conn = await pool.getConnection();
  try {
    await findRoundOrFail(conn, roundId);
    const tr = await findTableResult(conn, roundId, tableNumber);
    if (!tr) throw notFound('Résultat de table introuvable');
    return loadTableResultWithHands(conn, tr.id);
  } finally {
    conn.release();
  }
}

async function setCodifs(roundId, tableNumber, codifs) {
  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const round = await findRoundOrFail(conn, roundId);
    subTournamentId = round.sub_tournament_id;
    await conn.beginTransaction();
    try {
      const tr = await ensureTableResult(conn, roundId, tableNumber);
      await conn.query(
        `UPDATE table_results
           SET codif_n = ?, codif_s = ?, codif_e = ?, codif_o = ?
         WHERE id = ?`,
        [
          codifs.codif_n || null,
          codifs.codif_s || null,
          codifs.codif_e || null,
          codifs.codif_o || null,
          tr.id,
        ]
      );
      await conn.commit();
      return loadTableResultWithHands(conn, tr.id);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

async function validate(roundId, tableNumber) {
  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const round = await findRoundOrFail(conn, roundId);
    subTournamentId = round.sub_tournament_id;
    await conn.beginTransaction();
    try {
      const tr = await ensureTableResult(conn, roundId, tableNumber);
      await conn.query(
        `UPDATE table_results
           SET validated = TRUE, validated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [tr.id]
      );
      await conn.commit();
      return loadTableResultWithHands(conn, tr.id);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

async function unvalidate(roundId, tableNumber) {
  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const round = await findRoundOrFail(conn, roundId);
    subTournamentId = round.sub_tournament_id;
    const tr = await findTableResult(conn, roundId, tableNumber);
    if (!tr) throw notFound('Résultat de table introuvable');
    await conn.query(
      `UPDATE table_results SET validated = FALSE, validated_at = NULL WHERE id = ?`,
      [tr.id]
    );
    return loadTableResultWithHands(conn, tr.id);
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

async function removeByRoundAndTable(roundId, tableNumber) {
  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const round = await findRoundOrFail(conn, roundId);
    subTournamentId = round.sub_tournament_id;
    const tr = await findTableResult(conn, roundId, tableNumber);
    if (!tr) throw notFound('Résultat de table introuvable');
    await conn.query(`DELETE FROM table_results WHERE id = ?`, [tr.id]);
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

/* -----------------------------------------------------------
 * hand_results : add / update / delete (auto-recompute totals)
 * ----------------------------------------------------------- */

function validateHandPayload(data) {
  if (!Number.isInteger(data.hand_number) || data.hand_number < 1) {
    throw badRequest('hand_number requis (entier >= 1)');
  }
  if (data.taker_seat && !SEATS.includes(data.taker_seat)) {
    throw badRequest("taker_seat doit être 'N', 'S', 'E' ou 'O'");
  }
}

async function addHand(roundId, tableNumber, data) {
  validateHandPayload(data);

  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const round = await findRoundOrFail(conn, roundId);
    subTournamentId = round.sub_tournament_id;
    await conn.beginTransaction();
    try {
      const tr = await ensureTableResult(conn, roundId, tableNumber);

      const result = await conn.query(
        `INSERT INTO hand_results
           (table_result_id, hand_number, taker_seat,
            score_n, score_s, score_e, score_o)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tr.id,
          data.hand_number,
          data.taker_seat || null,
          data.score_n ?? 0,
          data.score_s ?? 0,
          data.score_e ?? 0,
          data.score_o ?? 0,
        ]
      );

      await recomputeTotals(conn, tr.id);
      await conn.commit();

      return getHandById(Number(result.insertId));
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

async function getHandById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT h.id, h.table_result_id, h.hand_number, h.taker_seat,
              h.score_n, h.score_s, h.score_e, h.score_o,
              tr.round_id, tr.table_number
       FROM hand_results h
       JOIN table_results tr ON tr.id = h.table_result_id
       WHERE h.id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Donne introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

async function updateHand(id, data) {
  if (data.hand_number !== undefined) {
    if (!Number.isInteger(data.hand_number) || data.hand_number < 1) {
      throw badRequest('hand_number doit être un entier >= 1');
    }
  }
  if (data.taker_seat && !SEATS.includes(data.taker_seat)) {
    throw badRequest("taker_seat doit être 'N', 'S', 'E' ou 'O'");
  }

  // Build a partial UPDATE — only patch fields actually provided.
  const fields = [];
  const values = [];
  if (data.hand_number !== undefined) {
    fields.push('hand_number = ?');
    values.push(data.hand_number);
  }
  if (data.taker_seat !== undefined) {
    fields.push('taker_seat = ?');
    values.push(data.taker_seat || null);
  }
  for (const seat of ['n', 's', 'e', 'o']) {
    const key = `score_${seat}`;
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const existing = await conn.query(
      `SELECT id, table_result_id FROM hand_results WHERE id = ?`,
      [id]
    );
    if (existing.length === 0) throw notFound('Donne introuvable');

    subTournamentId = await getSubTournamentIdForHand(conn, id);

    if (fields.length === 0) return getHandById(id);

    await conn.beginTransaction();
    try {
      values.push(id);
      await conn.query(
        `UPDATE hand_results SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
      await recomputeTotals(conn, existing[0].table_result_id);
      await conn.commit();
      return getHandById(id);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

async function removeHand(id) {
  const conn = await pool.getConnection();
  let subTournamentId = null;
  try {
    const existing = await conn.query(
      `SELECT id, table_result_id FROM hand_results WHERE id = ?`,
      [id]
    );
    if (existing.length === 0) throw notFound('Donne introuvable');
    subTournamentId = await getSubTournamentIdForHand(conn, id);

    await conn.beginTransaction();
    try {
      await conn.query(`DELETE FROM hand_results WHERE id = ?`, [id]);
      await recomputeTotals(conn, existing[0].table_result_id);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
    if (subTournamentId) scheduleRankingRefresh(subTournamentId);
  }
}

module.exports = {
  // table_results
  listByRound,
  getByRoundAndTable,
  setCodifs,
  validate,
  unvalidate,
  removeByRoundAndTable,
  // hands
  addHand,
  getHandById,
  updateHand,
  removeHand,
};
