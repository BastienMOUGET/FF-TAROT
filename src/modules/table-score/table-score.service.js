const pool = require('../../config/db');

const { getIO } = require('../../socket');

const rankingService =
  require('../ranking/ranking.service');

async function saveTableScore(data) {

  const conn = await pool.getConnection();

  try {

    /*
    |--------------------------------------------------------------------------
    | VALIDATIONS
    |--------------------------------------------------------------------------
    */

    if (!data.players || !Array.isArray(data.players)) {

      throw new Error(
        'Players manquant'
      );

    }

    if (data.players.length !== 4) {

      throw new Error(
        'Une table FFT doit contenir 4 joueurs'
      );

    }

    /*
    |--------------------------------------------------------------------------
    | CHECK ATTACKER
    |--------------------------------------------------------------------------
    */

    const attackers = data.players.filter(
      p => p.role === 'A'
    );

    if (attackers.length !== 1) {

      throw new Error(
        'Une seule attaque obligatoire'
      );

    }

    /*
    |--------------------------------------------------------------------------
    | CHECK DUPLICATE PLAYERS
    |--------------------------------------------------------------------------
    */

    const ids = data.players.map(
      p => p.player_id
    );

    const unique = new Set(ids);

    if (unique.size !== ids.length) {

      throw new Error(
        'Doublon joueur détecté'
      );

    }

    /*
    |--------------------------------------------------------------------------
    | CHECK TABLE ALREADY PLAYED
    |--------------------------------------------------------------------------
    */

    const existing = await conn.query(`
      SELECT id
      FROM scores
      WHERE table_id = ?
      LIMIT 1
    `, [data.table_id]);

    if (existing.length > 0) {

      throw new Error(
        'Table déjà validée'
      );

    }

    /*
    |--------------------------------------------------------------------------
    | INSERT SCORES
    |--------------------------------------------------------------------------
    */

    for (const player of data.players) {

      await conn.query(`
        INSERT INTO scores (
          tournament_id,
          round_id,
          table_id,
          player_id,
          score,
          codif,
          role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [

        data.tournament_id,

        data.round_id,

        data.table_id,

        player.player_id,

        player.score,

        player.codif || null,

        player.role

      ]);

    }

    /*
    |--------------------------------------------------------------------------
    | LIVE RANKING
    |--------------------------------------------------------------------------
    */

    const ranking =
      await rankingService.getRanking(
        data.tournament_id
      );

    const io = getIO();

    io.emit('ranking:update', {

      tournament_id: data.tournament_id,

      ranking

    });

    /*
    |--------------------------------------------------------------------------
    | DONE
    |--------------------------------------------------------------------------
    */

    return {
      success: true
    };

  } finally {

    conn.release();

  }

}

async function deleteTableScore(tableId) {

  const conn = await pool.getConnection();

  try {

    await conn.query(`
      DELETE FROM scores
      WHERE table_id = ?
    `, [tableId]);

    return {
      success: true
    };

  } finally {

    conn.release();

  }

}

module.exports = {
  saveTableScore,
  deleteTableScore
};