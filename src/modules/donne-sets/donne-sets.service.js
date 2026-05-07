const pool = require('../../config/db');
const { notFound, badRequest } = require('../../utils/httpError');

const SEATS_NSEO = ['N', 'S', 'E', 'O'];
const CARDS_PER_SEAT = 18;
const ECART_SIZE = 6;
const TOTAL_CARDS = SEATS_NSEO.length * CARDS_PER_SEAT + ECART_SIZE; // 78

/* -----------------------------------------------------------
 * Utilities
 * ----------------------------------------------------------- */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadAllCardIds(conn) {
  const rows = await conn.query(`SELECT id FROM cards ORDER BY id ASC`);
  return rows.map((r) => r.id);
}

// Distribute the 78 cards of one donne to N/S/E/O (18 each) + ECART (6).
// Returns [{ card_id, position }, ...]
function dealOneDonne(allCardIds) {
  if (allCardIds.length !== TOTAL_CARDS) {
    throw new Error(
      `Expected ${TOTAL_CARDS} cards, got ${allCardIds.length}`
    );
  }
  const shuffled = shuffle(allCardIds);
  const out = [];
  let idx = 0;
  for (const seat of SEATS_NSEO) {
    for (let k = 0; k < CARDS_PER_SEAT; k++) {
      out.push({ card_id: shuffled[idx++], position: seat });
    }
  }
  for (let k = 0; k < ECART_SIZE; k++) {
    out.push({ card_id: shuffled[idx++], position: 'ECART' });
  }
  return out;
}

/* -----------------------------------------------------------
 * Sets : list / get / create / update / delete
 * ----------------------------------------------------------- */

async function list() {
  const conn = await pool.getConnection();
  try {
    return await conn.query(
      `SELECT id, name, nb_donne, created_at
       FROM donne_sets
       ORDER BY created_at DESC`
    );
  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query(
      `SELECT id, name, nb_donne, created_at
       FROM donne_sets WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) throw notFound('Jeu de donnes introuvable');
    return rows[0];
  } finally {
    conn.release();
  }
}

// Create a new set + immediately deal nb_donne random donnes (transactional)
async function create({ name, nb_donne }) {
  if (!Number.isInteger(nb_donne) || nb_donne < 1 || nb_donne > 200) {
    throw badRequest('nb_donne doit être entre 1 et 200');
  }
  const conn = await pool.getConnection();
  try {
    const allCardIds = await loadAllCardIds(conn);
    if (allCardIds.length !== TOTAL_CARDS) {
      throw new Error(
        'Référentiel cards non initialisé (78 cartes attendues)'
      );
    }

    await conn.beginTransaction();
    try {
      const result = await conn.query(
        `INSERT INTO donne_sets (name, nb_donne) VALUES (?, ?)`,
        [name, nb_donne]
      );
      const setId = Number(result.insertId);

      for (let d = 1; d <= nb_donne; d++) {
        const distribution = dealOneDonne(allCardIds);
        for (const { card_id, position } of distribution) {
          await conn.query(
            `INSERT INTO donne_cards
               (donne_set_id, donne_number, card_id, position)
             VALUES (?, ?, ?, ?)`,
            [setId, d, card_id, position]
          );
        }
      }
      await conn.commit();
      return getById(setId);
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    conn.release();
  }
}

async function rename(id, { name }) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `UPDATE donne_sets SET name = ? WHERE id = ?`,
      [name, id]
    );
    if (result.affectedRows === 0) throw notFound('Jeu de donnes introuvable');
    return getById(id);
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      `DELETE FROM donne_sets WHERE id = ?`,
      [id]
    );
    if (result.affectedRows === 0) throw notFound('Jeu de donnes introuvable');
  } finally {
    conn.release();
  }
}

/* -----------------------------------------------------------
 * Donnes within a set
 * ----------------------------------------------------------- */

async function getDonneByNumber(setId, donneNumber) {
  const conn = await pool.getConnection();
  try {
    const sets = await conn.query(
      `SELECT id, nb_donne FROM donne_sets WHERE id = ?`,
      [setId]
    );
    if (sets.length === 0) throw notFound('Jeu de donnes introuvable');
    if (donneNumber < 1 || donneNumber > sets[0].nb_donne) {
      throw notFound(`Donne ${donneNumber} hors plage (1..${sets[0].nb_donne})`);
    }

    const rows = await conn.query(
      `SELECT dc.position, c.code, c.suit, c.rank_label, c.display_order, c.id AS card_id
       FROM donne_cards dc
       JOIN cards c ON c.id = dc.card_id
       WHERE dc.donne_set_id = ? AND dc.donne_number = ?
       ORDER BY FIELD(dc.position, 'N','S','E','O','ECART'), c.display_order ASC`,
      [setId, donneNumber]
    );

    // Group by position
    const byPos = { N: [], S: [], E: [], O: [], ECART: [] };
    for (const r of rows) {
      byPos[r.position].push({
        card_id: r.card_id,
        code: r.code,
        suit: r.suit,
        rank: r.rank_label,
      });
    }
    return {
      donne_set_id: setId,
      donne_number: donneNumber,
      hands: byPos,
    };
  } finally {
    conn.release();
  }
}

// Re-deal a single donne (replaces all 78 cards for that donne_number)
async function regenerateDonne(setId, donneNumber) {
  const conn = await pool.getConnection();
  try {
    const sets = await conn.query(
      `SELECT id, nb_donne FROM donne_sets WHERE id = ?`,
      [setId]
    );
    if (sets.length === 0) throw notFound('Jeu de donnes introuvable');
    if (donneNumber < 1 || donneNumber > sets[0].nb_donne) {
      throw notFound(`Donne ${donneNumber} hors plage`);
    }

    const allCardIds = await loadAllCardIds(conn);

    await conn.beginTransaction();
    try {
      await conn.query(
        `DELETE FROM donne_cards
         WHERE donne_set_id = ? AND donne_number = ?`,
        [setId, donneNumber]
      );
      const distribution = dealOneDonne(allCardIds);
      for (const { card_id, position } of distribution) {
        await conn.query(
          `INSERT INTO donne_cards
             (donne_set_id, donne_number, card_id, position)
           VALUES (?, ?, ?, ?)`,
          [setId, donneNumber, card_id, position]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }

    return getDonneByNumber(setId, donneNumber);
  } finally {
    conn.release();
  }
}

// Swap the hands of two seats on a given donne (legacy `echanger_main`)
async function swapHands(setId, donneNumber, seatA, seatB) {
  if (seatA === seatB) {
    throw badRequest('Les deux sièges doivent être différents');
  }
  const valid = new Set(['N', 'S', 'E', 'O', 'ECART']);
  if (!valid.has(seatA) || !valid.has(seatB)) {
    throw badRequest("Siège invalide (attendu : 'N','S','E','O','ECART')");
  }

  const conn = await pool.getConnection();
  try {
    const sets = await conn.query(
      `SELECT id, nb_donne FROM donne_sets WHERE id = ?`,
      [setId]
    );
    if (sets.length === 0) throw notFound('Jeu de donnes introuvable');
    if (donneNumber < 1 || donneNumber > sets[0].nb_donne) {
      throw notFound(`Donne ${donneNumber} hors plage`);
    }

    // Single atomic UPDATE via CASE — UNIQUE key is on card_id, not position,
    // so no risk of constraint violation here. CASE flips A<->B in one shot.
    await conn.query(
      `UPDATE donne_cards
         SET position = CASE position WHEN ? THEN ? WHEN ? THEN ? END
       WHERE donne_set_id = ? AND donne_number = ?
         AND position IN (?, ?)`,
      [seatA, seatB, seatB, seatA, setId, donneNumber, seatA, seatB]
    );

    return getDonneByNumber(setId, donneNumber);
  } finally {
    conn.release();
  }
}

module.exports = {
  list,
  getById,
  create,
  rename,
  remove,
  getDonneByNumber,
  regenerateDonne,
  swapHands,
};
