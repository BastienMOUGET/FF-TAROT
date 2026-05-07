const pool = require('../../config/db');

/*
|--------------------------------------------------------------------------
| SHUFFLE
|--------------------------------------------------------------------------
*/

function shuffle(array) {

  for (let i = array.length - 1; i > 0; i--) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [array[i], array[j]] =
      [array[j], array[i]];
  }

  return array;
}

/*
|--------------------------------------------------------------------------
| PLAYER CONFLICTS
|--------------------------------------------------------------------------
*/

async function getPlayerConflicts(conn) {

  const rows = await conn.query(`
    SELECT
      tp1.player_id AS p1,
      tp2.player_id AS p2,
      COUNT(*) AS total

    FROM table_players tp1

    JOIN table_players tp2
      ON tp1.table_id = tp2.table_id

    WHERE tp1.player_id != tp2.player_id

    GROUP BY p1, p2
  `);

  const map = {};

  for (const row of rows) {

    const key =
      `${row.p1}-${row.p2}`;

    map[key] =
      Number(row.total);

  }

  return map;
}

/*
|--------------------------------------------------------------------------
| GROUP CONFLICT SCORE
|--------------------------------------------------------------------------
*/

function getGroupConflictScore(
  group,
  conflicts
) {

  let score = 0;

  for (let i = 0; i < group.length; i++) {

    for (let j = i + 1; j < group.length; j++) {

      const a = group[i].id;
      const b = group[j].id;

      score +=
        conflicts[`${a}-${b}`] || 0;

      score +=
        conflicts[`${b}-${a}`] || 0;

    }

  }

  return score;
}

/*
|--------------------------------------------------------------------------
| PLAYER STATS
|--------------------------------------------------------------------------
*/

async function getPlayerStats(conn) {

  const rows = await conn.query(`
    SELECT
      player_id,
      seat,
      role,
      COUNT(*) AS total

    FROM table_players

    GROUP BY
      player_id,
      seat,
      role
  `);

  const stats = {};

  for (const row of rows) {

    if (!stats[row.player_id]) {

      stats[row.player_id] = {
        seats: {},
        roles: {}
      };

    }

    /*
    |--------------------------------------------------------------------------
    | SEATS
    |--------------------------------------------------------------------------
    */

    if (row.seat !== null) {

      stats[row.player_id]
        .seats[row.seat] =
          Number(row.total);

    }

    /*
    |--------------------------------------------------------------------------
    | ROLES
    |--------------------------------------------------------------------------
    */

    if (row.role) {

      stats[row.player_id]
        .roles[row.role] =
          Number(row.total);

    }

  }

  return stats;
}

/*
|--------------------------------------------------------------------------
| SEAT PENALTY
|--------------------------------------------------------------------------
*/

function getSeatPenalty(
  player,
  seat,
  stats
) {

  const playerStats =
    stats[player.id];

  if (!playerStats) {
    return 0;
  }

  return playerStats
    .seats[seat] || 0;
}

/*
|--------------------------------------------------------------------------
| CREATE ROUND
|--------------------------------------------------------------------------
*/

async function createRound(
  tournamentId,
  roundNumber
) {

  const conn = await pool.getConnection();

  try {

    const result = await conn.query(`
      INSERT INTO rounds (
        tournament_id,
        round_number
      )
      VALUES (?, ?)
    `, [
      tournamentId,
      roundNumber
    ]);

    return {
      id: Number(result.insertId),
      tournament_id: tournamentId,
      round_number: roundNumber
    };

  } finally {

    conn.release();

  }

}

/*
|--------------------------------------------------------------------------
| GET ROUNDS
|--------------------------------------------------------------------------
*/

async function getRounds(tournamentId) {

  const conn = await pool.getConnection();

  try {

    return await conn.query(`
      SELECT *
      FROM rounds
      WHERE tournament_id = ?
      ORDER BY round_number
    `, [tournamentId]);

  } finally {

    conn.release();

  }

}

/*
|--------------------------------------------------------------------------
| GENERATE TABLES
|--------------------------------------------------------------------------
*/

async function generateTables(roundId) {

  const conn = await pool.getConnection();

  try {

    /*
    |--------------------------------------------------------------------------
    | GET ROUND
    |--------------------------------------------------------------------------
    */

    const rounds = await conn.query(`
      SELECT *
      FROM rounds
      WHERE id = ?
      LIMIT 1
    `, [roundId]);

    if (rounds.length === 0) {

      throw new Error(
        'Round introuvable'
      );

    }

    const round = rounds[0];

    /*
    |--------------------------------------------------------------------------
    | DELETE OLD TABLES
    |--------------------------------------------------------------------------
    */

    await conn.query(`
      DELETE FROM table_players
      WHERE table_id IN (
        SELECT id
        FROM game_tables
        WHERE round_id = ?
      )
    `, [roundId]);

    await conn.query(`
      DELETE FROM game_tables
      WHERE round_id = ?
    `, [roundId]);

    /*
    |--------------------------------------------------------------------------
    | DELETE OLD BYES
    |--------------------------------------------------------------------------
    */

    await conn.query(`
      DELETE FROM byes
      WHERE round_id = ?
    `, [roundId]);

    /*
    |--------------------------------------------------------------------------
    | GET PLAYERS
    |--------------------------------------------------------------------------
    */

    let players = await conn.query(`
      SELECT *
      FROM players
      ORDER BY id
    `);

    if (players.length < 4) {

      throw new Error(
        'Pas assez de joueurs'
      );

    }

    /*
    |--------------------------------------------------------------------------
    | SHUFFLE
    |--------------------------------------------------------------------------
    */

    players = shuffle(players);

    /*
    |--------------------------------------------------------------------------
    | CONFLICTS
    |--------------------------------------------------------------------------
    */

    const conflicts =
      await getPlayerConflicts(conn);

    /*
    |--------------------------------------------------------------------------
    | PLAYER STATS
    |--------------------------------------------------------------------------
    */

    const stats =
      await getPlayerStats(conn);

    /*
    |--------------------------------------------------------------------------
    | SMART GENERATION
    |--------------------------------------------------------------------------
    */

    const remaining = [...players];

    const tables = [];

    let tableNumber = 1;

    while (remaining.length >= 4) {

      let bestGroup = null;

      let bestScore = Infinity;

      /*
      |--------------------------------------------------------------------------
      | FIND BEST GROUP
      |--------------------------------------------------------------------------
      */

      for (let a = 0; a < remaining.length; a++) {

        for (let b = a + 1; b < remaining.length; b++) {

          for (let c = b + 1; c < remaining.length; c++) {

            for (let d = c + 1; d < remaining.length; d++) {

              const group = [

                remaining[a],

                remaining[b],

                remaining[c],

                remaining[d]

              ];

              const score =
                getGroupConflictScore(
                  group,
                  conflicts
                );

              if (score < bestScore) {

                bestScore = score;

                bestGroup = group;

              }

            }

          }

        }

      }

      /*
      |--------------------------------------------------------------------------
      | REMOVE PLAYERS
      |--------------------------------------------------------------------------
      */

      for (const player of bestGroup) {

        const index =
          remaining.findIndex(
            p => p.id === player.id
          );

        remaining.splice(index, 1);

      }

      /*
      |--------------------------------------------------------------------------
      | CREATE TABLE
      |--------------------------------------------------------------------------
      */

      const result = await conn.query(`
        INSERT INTO game_tables (
          tournament_id,
          round_id,
          table_number
        )
        VALUES (?, ?, ?)
      `, [

        round.tournament_id,

        round.id,

        tableNumber

      ]);

      const tableId =
        Number(result.insertId);

      /*
      |--------------------------------------------------------------------------
      | SMART SEATING
      |--------------------------------------------------------------------------
      */

      const seats = [1, 2, 3, 4];

      const seating = [];

      const usedSeats = new Set();

      for (const player of bestGroup) {

        let bestSeat = null;

        let bestPenalty = Infinity;

        for (const seat of seats) {

          if (usedSeats.has(seat)) {
            continue;
          }

          const penalty =
            getSeatPenalty(
              player,
              seat,
              stats
            );

          if (penalty < bestPenalty) {

            bestPenalty = penalty;

            bestSeat = seat;

          }

        }

        usedSeats.add(bestSeat);

        seating.push({
          player,
          seat: bestSeat
        });

      }

      /*
      |--------------------------------------------------------------------------
      | INSERT PLAYERS
      |--------------------------------------------------------------------------
      */

      for (const item of seating) {

        await conn.query(`
          INSERT INTO table_players (
            table_id,
            player_id,
            seat
          )
          VALUES (?, ?, ?)
        `, [

          tableId,

          item.player.id,

          item.seat

        ]);

      }

      /*
      |--------------------------------------------------------------------------
      | RESULT
      |--------------------------------------------------------------------------
      */

      tables.push({

        table_id: tableId,

        table_number: tableNumber,

        conflict_score: bestScore,

        players: seating

      });

      tableNumber++;

    }

    /*
    |--------------------------------------------------------------------------
    | HANDLE BYES
    |--------------------------------------------------------------------------
    */

    if (remaining.length > 0) {

      for (const player of remaining) {

        await conn.query(`
          INSERT INTO byes (
            tournament_id,
            round_id,
            player_id
          )
          VALUES (?, ?, ?)
        `, [

          round.tournament_id,

          round.id,

          player.id

        ]);

      }

    }

    /*
    |--------------------------------------------------------------------------
    | GET BYES
    |--------------------------------------------------------------------------
    */

    const byes = await conn.query(`
      SELECT
        b.*,
        p.name,
        p.firstname

      FROM byes b

      JOIN players p
        ON p.id = b.player_id

      WHERE b.round_id = ?
    `, [roundId]);

    /*
    |--------------------------------------------------------------------------
    | RETURN
    |--------------------------------------------------------------------------
    */

    return {

      tables,

      byes

    };

  } finally {

    conn.release();

  }

}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  createRound,
  getRounds,
  generateTables
};