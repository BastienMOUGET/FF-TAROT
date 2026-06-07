-- =====================================================
-- FFT TAROT - SCHÉMA DB (mode Libre par 4)
-- =====================================================
-- Notes :
--   - 1 tournoi peut contenir plusieurs sous-tournois (parallèles).
--   - Inscriptions par équipe de 4 (paire NS + paire EO).
--   - Licence FFT optionnelle (champ texte libre, pas obligatoire).
-- =====================================================

CREATE DATABASE IF NOT EXISTS fft
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fft;

SET FOREIGN_KEY_CHECKS = 0;

-- Suppression (ordre inverse des dépendances, dev only)
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS donne_cards;
DROP TABLE IF EXISTS donne_sets;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS pp_grids;
DROP TABLE IF EXISTS rankings;
DROP TABLE IF EXISTS hand_results;
DROP TABLE IF EXISTS table_results;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS rounds;
DROP TABLE IF EXISTS movement_patterns;
DROP TABLE IF EXISTS movement_steps;
DROP TABLE IF EXISTS movements;
DROP TABLE IF EXISTS team_players;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS sub_tournaments;
DROP TABLE IF EXISTS penalties;
DROP TABLE IF EXISTS penalty_types;
DROP TABLE IF EXISTS parameters;
DROP TABLE IF EXISTS tournaments;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS clubs;
DROP TABLE IF EXISTS comites;
DROP TABLE IF EXISTS ligues;

-- Tables non utilisées par le nouveau schéma (legacy v0)
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS table_players;
DROP TABLE IF EXISTS game_tables;
DROP TABLE IF EXISTS byes;

-- NB : FOREIGN_KEY_CHECKS reste désactivé pendant les CREATE pour
-- s'affranchir des cycles d'ordre. Réactivé à la toute fin du fichier.

-- =====================================================
-- RÉFÉRENTIEL FFT (ligues > comités > clubs > joueurs)
-- =====================================================

CREATE TABLE ligues (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(10)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE comites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(10)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  ligue_id    INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comites_ligue
    FOREIGN KEY (ligue_id) REFERENCES ligues(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE clubs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(15)  NOT NULL UNIQUE,
  name        VARCHAR(150) NOT NULL,
  comite_id   INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_clubs_comite
    FOREIGN KEY (comite_id) REFERENCES comites(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE players (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  licence     VARCHAR(20)  NULL UNIQUE,    -- numéro FFT optionnel
  name        VARCHAR(100) NOT NULL,
  firstname   VARCHAR(100) NOT NULL,
  club_id     INT NULL,
  category    VARCHAR(10)  NULL,           -- ex : 'S','E','J','D1','D2'…
  gender      CHAR(1)      NULL,           -- 'M' / 'F'
  birth_year  SMALLINT     NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_players_club
    FOREIGN KEY (club_id) REFERENCES clubs(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_players_name (name, firstname)
) ENGINE=InnoDB;

-- =====================================================
-- TOURNOIS
-- =====================================================

CREATE TABLE tournaments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20)  NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  date            DATE         NULL,
  type            VARCHAR(20)  NOT NULL DEFAULT 'libre',
  status          ENUM('draft','open','running','closed') NOT NULL DEFAULT 'draft',
  current_round   INT          NOT NULL DEFAULT 0,
  coef_default    DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  club_id         INT NULL,
  comite_id       INT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tournaments_club
    FOREIGN KEY (club_id) REFERENCES clubs(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tournaments_comite
    FOREIGN KEY (comite_id) REFERENCES comites(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Sous-tournois parallèles (A/B/Open/Promo…)
CREATE TABLE sub_tournaments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id   INT NOT NULL,
  label           VARCHAR(50)  NOT NULL,    -- ex : 'A', 'Open'
  color           VARCHAR(20)  NULL,        -- hex ou nom CSS
  color_name      VARCHAR(50)  NULL,
  -- PCN (codification fédérale) : 0 = pas de PCN
  indice_pcn      DECIMAL(5,2) NOT NULL DEFAULT 0,
  championnat     BOOLEAN      NOT NULL DEFAULT FALSE,
  -- Jeu de donnes pré-tirées attaché (optionnel)
  donne_set_id    INT          NULL,
  CONSTRAINT fk_subt_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_subt_donneset
    FOREIGN KEY (donne_set_id) REFERENCES donne_sets(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY uniq_subt_label (tournament_id, label)
) ENGINE=InnoDB;

-- =====================================================
-- INSCRIPTIONS (Libre par 4)
-- 1 équipe = 4 joueurs = 1 paire NS + 1 paire EO
-- =====================================================

CREATE TABLE teams (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sub_tournament_id   INT NOT NULL,
  team_number         INT NOT NULL,           -- numéro d'équipe dans le sub-tournoi
  CONSTRAINT fk_teams_subt
    FOREIGN KEY (sub_tournament_id) REFERENCES sub_tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_team_number (sub_tournament_id, team_number)
) ENGINE=InnoDB;

CREATE TABLE team_players (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  team_id             INT NOT NULL,
  player_id           INT NOT NULL,
  pair                ENUM('NS','EO') NOT NULL,
  player_number       INT NOT NULL,           -- 1..4 (ordre fixé à l'inscription)
  CONSTRAINT fk_tp_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tp_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uniq_team_slot (team_id, player_number)
) ENGINE=InnoDB;

-- =====================================================
-- MOUVEMENTS (patron d'offsets par nb de tables)
-- Reproduit la table mouvJoueurLib4 du legacy : pour chaque
-- nombre de tables, on stocke l'offset à appliquer sur le
-- numéro de table d'un joueur en fonction de sa place (N/S/E/O).
-- L'entrée table_count = 0 sert de patron par défaut.
-- =====================================================

CREATE TABLE movement_patterns (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  table_count INT          NOT NULL UNIQUE,    -- 0 = défaut (toutes tailles)
  offset_n    INT          NOT NULL DEFAULT 0,
  offset_s    INT          NOT NULL DEFAULT 1,
  offset_e    INT          NOT NULL DEFAULT 2,
  offset_o    INT          NOT NULL DEFAULT -1,
  label       VARCHAR(150) NULL
) ENGINE=InnoDB;

-- =====================================================
-- ROUNDS + MISE EN PLACE
-- =====================================================

CREATE TABLE rounds (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sub_tournament_id   INT NOT NULL,
  round_number        INT NOT NULL,
  coef                DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  started_at          TIMESTAMP NULL,
  closed_at           TIMESTAMP NULL,
  CONSTRAINT fk_rounds_subt
    FOREIGN KEY (sub_tournament_id) REFERENCES sub_tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_round (sub_tournament_id, round_number)
) ENGINE=InnoDB;

-- Mise en place : qui est où à chaque round.
CREATE TABLE seats (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  round_id        INT NOT NULL,
  table_number    INT NOT NULL,
  seat            ENUM('N','S','E','O') NOT NULL,
  player_id       INT NOT NULL,
  team_id         INT NULL,
  CONSTRAINT fk_seats_round
    FOREIGN KEY (round_id) REFERENCES rounds(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_seats_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_seats_team
    FOREIGN KEY (team_id) REFERENCES teams(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY uniq_seat_pos (round_id, table_number, seat),
  INDEX idx_seats_player (player_id)
) ENGINE=InnoDB;

-- =====================================================
-- SCORES
-- =====================================================

-- Total par table (un par table par round)
CREATE TABLE table_results (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  round_id        INT NOT NULL,
  table_number    INT NOT NULL,
  score_n         INT NOT NULL DEFAULT 0,
  score_s         INT NOT NULL DEFAULT 0,
  score_e         INT NOT NULL DEFAULT 0,
  score_o         INT NOT NULL DEFAULT 0,
  codif_n         VARCHAR(5) NULL,    -- ex : '*4', '*6'…
  codif_s         VARCHAR(5) NULL,
  codif_e         VARCHAR(5) NULL,
  codif_o         VARCHAR(5) NULL,
  validated       BOOLEAN NOT NULL DEFAULT FALSE,
  validated_at    TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tr_round
    FOREIGN KEY (round_id) REFERENCES rounds(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_table_result (round_id, table_number)
) ENGINE=InnoDB;

-- Détail par donne (preneur + score N/S/E/O sur cette donne)
CREATE TABLE hand_results (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  table_result_id   INT NOT NULL,
  hand_number       INT NOT NULL,
  taker_seat        ENUM('N','S','E','O') NULL,
  score_n           INT NOT NULL DEFAULT 0,
  score_s           INT NOT NULL DEFAULT 0,
  score_e           INT NOT NULL DEFAULT 0,
  score_o           INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_hand_table
    FOREIGN KEY (table_result_id) REFERENCES table_results(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_hand (table_result_id, hand_number)
) ENGINE=InnoDB;

-- =====================================================
-- CLASSEMENT (matérialisé pour live)
-- =====================================================

CREATE TABLE rankings (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sub_tournament_id   INT NOT NULL,
  player_id           INT NOT NULL,
  rounds_played       INT     NOT NULL DEFAULT 0,
  total               DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_general       DECIMAL(8,2) NOT NULL DEFAULT 0,
  place               INT     NOT NULL DEFAULT 0,
  pcn                 DECIMAL(8,2) NOT NULL DEFAULT 0,
  pp                  DECIMAL(6,2) NOT NULL DEFAULT 0,
  eliminated          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                      ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rankings_subt
    FOREIGN KEY (sub_tournament_id) REFERENCES sub_tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rankings_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_ranking (sub_tournament_id, player_id)
) ENGINE=InnoDB;

-- =====================================================
-- GRILLE PP (Palmarès des Points) par sous-tournoi
-- Place -> nombre de points PP. Reproduit pp_tournois du legacy.
-- =====================================================

CREATE TABLE pp_grids (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  sub_tournament_id   INT NOT NULL,
  place               INT NOT NULL,
  pp                  DECIMAL(6,2) NOT NULL,
  CONSTRAINT fk_pp_subt
    FOREIGN KEY (sub_tournament_id) REFERENCES sub_tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_pp_grid (sub_tournament_id, place)
) ENGINE=InnoDB;

-- =====================================================
-- PÉNALITÉS
-- =====================================================

CREATE TABLE penalty_types (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20)  NOT NULL UNIQUE,
  label           VARCHAR(150) NOT NULL,
  default_points  DECIMAL(6,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE penalties (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id   INT NOT NULL,
  player_id       INT NOT NULL,
  type_id         INT NULL,
  points          DECIMAL(6,2) NOT NULL,
  reason          VARCHAR(255) NULL,
  applied_round_id INT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pen_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pen_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pen_type
    FOREIGN KEY (type_id) REFERENCES penalty_types(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_pen_round
    FOREIGN KEY (applied_round_id) REFERENCES rounds(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =====================================================
-- PARAMÈTRES (clé/valeur par scope)
-- =====================================================

CREATE TABLE parameters (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  scope           ENUM('global','tournament') NOT NULL DEFAULT 'global',
  tournament_id   INT NULL,
  param_key       VARCHAR(60)  NOT NULL,
  param_value     VARCHAR(255) NULL,
  CONSTRAINT fk_param_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uniq_param (scope, tournament_id, param_key)
) ENGINE=InnoDB;

-- =====================================================
-- CARTES DU TAROT (référentiel des 78 cartes)
-- =====================================================

CREATE TABLE cards (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(10)  NOT NULL UNIQUE,
  -- 'pique', 'coeur', 'carreau', 'trefle', 'atout', 'excuse'
  suit          VARCHAR(10)  NOT NULL,
  -- 1..10, V, C, D, R pour couleurs ; 1..21 pour atouts ; 0 pour excuse
  rank_label    VARCHAR(3)   NOT NULL,
  -- valeur ordinale pour tri/affichage
  display_order INT          NOT NULL,
  INDEX idx_cards_suit (suit)
) ENGINE=InnoDB;

-- =====================================================
-- JEUX DE DONNES PRÉ-TIRÉES
-- Reproduit liste_genedonne / genedonne du legacy.
-- =====================================================

CREATE TABLE donne_sets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  nb_donne    INT          NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 78 cartes × N donnes, position parmi N/S/E/O/ECART (chien)
CREATE TABLE donne_cards (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  donne_set_id  INT NOT NULL,
  donne_number  INT NOT NULL,
  card_id       INT NOT NULL,
  position      ENUM('N','S','E','O','ECART') NOT NULL,
  CONSTRAINT fk_dc_set
    FOREIGN KEY (donne_set_id) REFERENCES donne_sets(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dc_card
    FOREIGN KEY (card_id) REFERENCES cards(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uniq_dc (donne_set_id, donne_number, card_id),
  INDEX idx_dc_donne (donne_set_id, donne_number)
) ENGINE=InnoDB;

-- =====================================================
-- UTILISATEURS / AUTH
-- =====================================================

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','arbitre','viewer') NOT NULL DEFAULT 'viewer',
  full_name     VARCHAR(150) NULL,
  email         VARCHAR(150) NULL UNIQUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- DONNÉES DE RÉFÉRENCE (toujours présentes)
-- =====================================================

-- Patron de mouvement par défaut (table_count = 0 = "toutes tailles") :
-- N fixe, S+1, E+2, O-1 modulo nb_table — règle FFT Libre par 4.
INSERT INTO movement_patterns (table_count, offset_n, offset_s, offset_e, offset_o, label)
VALUES (0, 0, 1, 2, -1, 'Mouvement par défaut Libre par 4');

-- 78 cartes du jeu de Tarot français :
--   - 4 couleurs (pique, coeur, carreau, trefle) × 14 valeurs (1..10, V, C, D, R) = 56
--   - 21 atouts (1..21)
--   - 1 excuse
INSERT INTO cards (code, suit, rank_label, display_order) VALUES
  -- Pique
  ('P_1','pique','1',1),  ('P_2','pique','2',2),  ('P_3','pique','3',3),  ('P_4','pique','4',4),
  ('P_5','pique','5',5),  ('P_6','pique','6',6),  ('P_7','pique','7',7),  ('P_8','pique','8',8),
  ('P_9','pique','9',9),  ('P_10','pique','10',10),('P_V','pique','V',11),('P_C','pique','C',12),
  ('P_D','pique','D',13),('P_R','pique','R',14),
  -- Coeur
  ('C_1','coeur','1',15), ('C_2','coeur','2',16), ('C_3','coeur','3',17), ('C_4','coeur','4',18),
  ('C_5','coeur','5',19), ('C_6','coeur','6',20), ('C_7','coeur','7',21), ('C_8','coeur','8',22),
  ('C_9','coeur','9',23), ('C_10','coeur','10',24),('C_V','coeur','V',25),('C_C','coeur','C',26),
  ('C_D','coeur','D',27),('C_R','coeur','R',28),
  -- Carreau
  ('K_1','carreau','1',29),('K_2','carreau','2',30),('K_3','carreau','3',31),('K_4','carreau','4',32),
  ('K_5','carreau','5',33),('K_6','carreau','6',34),('K_7','carreau','7',35),('K_8','carreau','8',36),
  ('K_9','carreau','9',37),('K_10','carreau','10',38),('K_V','carreau','V',39),('K_C','carreau','C',40),
  ('K_D','carreau','D',41),('K_R','carreau','R',42),
  -- Trefle
  ('T_1','trefle','1',43),('T_2','trefle','2',44),('T_3','trefle','3',45),('T_4','trefle','4',46),
  ('T_5','trefle','5',47),('T_6','trefle','6',48),('T_7','trefle','7',49),('T_8','trefle','8',50),
  ('T_9','trefle','9',51),('T_10','trefle','10',52),('T_V','trefle','V',53),('T_C','trefle','C',54),
  ('T_D','trefle','D',55),('T_R','trefle','R',56),
  -- Atouts (1..21)
  ('A_1','atout','1',57),  ('A_2','atout','2',58),  ('A_3','atout','3',59),  ('A_4','atout','4',60),
  ('A_5','atout','5',61),  ('A_6','atout','6',62),  ('A_7','atout','7',63),  ('A_8','atout','8',64),
  ('A_9','atout','9',65),  ('A_10','atout','10',66),('A_11','atout','11',67),('A_12','atout','12',68),
  ('A_13','atout','13',69),('A_14','atout','14',70),('A_15','atout','15',71),('A_16','atout','16',72),
  ('A_17','atout','17',73),('A_18','atout','18',74),('A_19','atout','19',75),('A_20','atout','20',76),
  ('A_21','atout','21',77),
  -- Excuse
  ('EXC','excuse','0',78);

-- Utilisateur admin par défaut (mot de passe : admin123)
-- Hash scrypt (amalgame-crypto Password.Hash). Changez immédiatement en prod.
INSERT INTO users (username, password_hash, role, full_name) VALUES
  ('admin',
   '$scrypt$ln=15,r=8,p=1$lzTnhnClOkY7RcXOaJJS-g$UQLg5juPCb6q3Js07u-_V1woLKtzjBj4dU4yKLtPgkQ',
   'admin',
   'Administrateur');

SET FOREIGN_KEY_CHECKS = 1;
