const pool = require('../../config/db');

async function getAll() {
  const conn = await pool.getConnection();

  try {
    return await conn.query(`
      SELECT * FROM tournaments
      ORDER BY date DESC
    `);
  } finally {
    conn.release();
  }
}

async function create(data) {
  const conn = await pool.getConnection();

  try {
    const result = await conn.query(`
      INSERT INTO tournaments (name, date)
      VALUES (?, ?)
    `, [
      data.name,
      data.date
    ]);

    return {
      id: result.insertId,
      ...data
    };

  } finally {
    conn.release();
  }
}

async function getById(id) {
  const conn = await pool.getConnection();

  try {
    const rows = await conn.query(`
      SELECT * FROM tournaments
      WHERE id = ?
    `, [id]);

    return rows[0];

  } finally {
    conn.release();
  }
}

module.exports = {
  getAll,
  create,
  getById
};