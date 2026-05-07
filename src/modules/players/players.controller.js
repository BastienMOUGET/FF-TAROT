const pool = require('../../config/db');

async function getPlayers(req, res) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT * FROM players');
    res.json(rows);
  } finally {
    conn.release();
  }
}

async function createPlayer(req, res) {
  const { name, firstname } = req.body;

  const conn = await pool.getConnection();
  try {
    const result = await conn.query(
      'INSERT INTO players (name, firstname) VALUES (?, ?)',
      [name, firstname]
    );

    res.json({ id: result.insertId, name, firstname });
  } finally {
    conn.release();
  }
}

module.exports = { getPlayers, createPlayer };