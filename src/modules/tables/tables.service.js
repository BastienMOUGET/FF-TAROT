const pool = require('../../config/db');

async function createTable(data) {

  const conn = await pool.getConnection();

  try {

    const result = await conn.query(`
      INSERT INTO game_tables (
        tournament_id,
        round_id,
        table_number
      )
      VALUES (?, ?, ?)
    `, [
      data.tournament_id,
      data.round_id,
      data.table_number
    ]);

    const tableId = result.insertId;

    for (const player of data.players) {

      await conn.query(`
        INSERT INTO table_players (
          table_id,
          player_id,
          seat
        )
        VALUES (?, ?, ?)
      `, [
        tableId,
        player.player_id,
        player.seat
      ]);

    }

    return {
      id: tableId
    };

  } finally {

    conn.release();

  }

}

async function getTables(roundId) {

  const conn = await pool.getConnection();

  try {

    const tables = await conn.query(`
      SELECT *
      FROM game_tables
      WHERE round_id = ?
      ORDER BY table_number
    `, [roundId]);

    for (const table of tables) {

      const players = await conn.query(`
        SELECT
          tp.*,
          p.name,
          p.firstname
        FROM table_players tp
        JOIN players p
          ON p.id = tp.player_id
        WHERE tp.table_id = ?
        ORDER BY tp.seat
      `, [table.id]);

      table.players = players;

    }

    return tables;

  } finally {

    conn.release();

  }

}

module.exports = {
  createTable,
  getTables
};