-- =====================================================
-- FFT TAROT DATABASE
-- =====================================================

CREATE DATABASE IF NOT EXISTS fft;

USE fft;

-- =====================================================
-- PLAYERS
-- =====================================================

CREATE TABLE IF NOT EXISTS players (

  id INT AUTO_INCREMENT PRIMARY KEY,

  name VARCHAR(100) NOT NULL,

  firstname VARCHAR(100) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- TOURNAMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS tournaments (

  id INT AUTO_INCREMENT PRIMARY KEY,

  name VARCHAR(255) NOT NULL,

  date DATETIME,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- ROUNDS
-- =====================================================

CREATE TABLE IF NOT EXISTS rounds (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  round_number INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id)

);

-- =====================================================
-- TABLES FFT
-- =====================================================

CREATE TABLE IF NOT EXISTS game_tables (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  round_id INT NOT NULL,

  table_number INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id),

  INDEX (round_id)

);

-- =====================================================
-- TABLE PLAYERS
-- =====================================================

CREATE TABLE IF NOT EXISTS table_players (

  id INT AUTO_INCREMENT PRIMARY KEY,

  table_id INT NOT NULL,

  player_id INT NOT NULL,

  seat INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (table_id),

  INDEX (player_id)

);
ALTER TABLE table_players
ADD COLUMN role VARCHAR(1) NULL;

-- =====================================================
-- SCORES
-- =====================================================

CREATE TABLE IF NOT EXISTS scores (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  round_id INT NOT NULL,

  table_id INT,

  player_id INT NOT NULL,

  score INT DEFAULT 0,

  codif VARCHAR(5),

  role CHAR(1),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id),

  INDEX (round_id),

  INDEX (table_id),

  INDEX (player_id)

);

-- =====================================================
-- PENALTIES
-- =====================================================

CREATE TABLE IF NOT EXISTS penalties (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  player_id INT NOT NULL,

  points INT NOT NULL,

  reason VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id),

  INDEX (player_id)

);

-- =====================================================
-- BES
-- =====================================================

CREATE TABLE IF NOT EXISTS byes (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  round_id INT NOT NULL,

  player_id INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id),

  INDEX (round_id),

  INDEX (player_id)

);

-- =====================================================
-- BYES / EXEMPTS
-- =====================================================

CREATE TABLE IF NOT EXISTS byes (

  id INT AUTO_INCREMENT PRIMARY KEY,

  tournament_id INT NOT NULL,

  round_id INT NOT NULL,

  player_id INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX (tournament_id),

  INDEX (round_id),

  INDEX (player_id)

);