const express = require('express');
const pool = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const rows = await conn.query(
        `SELECT id, code, suit, rank_label AS rank, display_order
         FROM cards
         ORDER BY display_order ASC`
      );
      res.json(rows);
    } finally {
      conn.release();
    }
  })
);

module.exports = router;
