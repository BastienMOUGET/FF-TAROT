-- =========================
-- DATABASE
-- =========================
CREATE DATABASE IF NOT EXISTS fft;
USE fft;

-- =========================
-- PLAYERS
-- =========================
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  firstname VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TOURNAMENTS
-- =========================
CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  date DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SCORES
-- =========================
CREATE TABLE IF NOT EXISTS scores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT,
  round_id INT,
  player_id INT,
  score INT,
  codif VARCHAR(5),
  role CHAR(1),

  INDEX (tournament_id),
  INDEX (player_id)
);

-- =========================
-- PENALTIES
-- =========================
CREATE TABLE IF NOT EXISTS penalties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT,
  player_id INT,
  points INT,

  INDEX (tournament_id),
  INDEX (player_id)
);