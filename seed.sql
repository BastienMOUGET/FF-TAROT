-- =====================================================
-- FFT TAROT - SEED minimal pour dev / tests manuels
-- =====================================================
USE fft;

-- ----- nettoyage (ordre inverse des FK) -----
-- NOTE: users n'est pas truncate ici (l'admin par défaut est créé dans db.sql)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE donne_cards;
TRUNCATE donne_sets;
TRUNCATE pp_grids;
TRUNCATE rankings;
TRUNCATE hand_results;
TRUNCATE table_results;
TRUNCATE seats;
TRUNCATE rounds;
TRUNCATE team_players;
TRUNCATE teams;
TRUNCATE sub_tournaments;
TRUNCATE penalties;
TRUNCATE penalty_types;
TRUNCATE parameters;
TRUNCATE tournaments;
TRUNCATE players;
TRUNCATE clubs;
TRUNCATE comites;
TRUNCATE ligues;
SET FOREIGN_KEY_CHECKS = 1;

-- ----- référentiel -----
INSERT INTO ligues (id, code, name) VALUES
  (1, 'IDF', 'Ligue Île-de-France');

INSERT INTO comites (id, code, name, ligue_id) VALUES
  (1, '75', 'Comité de Paris', 1);

INSERT INTO clubs (id, code, name, comite_id) VALUES
  (1, '75001', 'Club Test FFT', 1);

-- ----- joueurs (8 = 2 équipes complètes) -----
INSERT INTO players (id, licence, name, firstname, club_id) VALUES
  (1, NULL,        'Dupont',  'Jean',    1),
  (2, NULL,        'Martin',  'Paul',    1),
  (3, NULL,        'Durand',  'Luc',     1),
  (4, NULL,        'Bernard', 'Marc',    1),
  (5, '0000005',   'Petit',   'Sophie',  1),
  (6, '0000006',   'Robert',  'Anne',    1),
  (7, NULL,        'Richard', 'Pierre',  1),
  (8, NULL,        'Thomas',  'Marie',   1);

-- ----- types de pénalité -----
INSERT INTO penalty_types (id, code, label, default_points) VALUES
  (1, 'RETARD',  'Retard',                    -2.00),
  (2, 'CARTON',  'Carton (avertissement)',    -5.00),
  (3, 'TEL',     'Téléphone à table',         -3.00);

-- ----- tournoi de démo -----
INSERT INTO tournaments (id, code, name, date, type, status, current_round, coef_default, club_id, comite_id)
VALUES (1, 'TEST-2026', 'Tournoi Test FFT', CURDATE(), 'libre', 'open', 0, 1.00, 1, 1);

INSERT INTO sub_tournaments (id, tournament_id, label, color, color_name)
VALUES (1, 1, 'Open', '#1976D2', 'Bleu');

-- ----- 2 équipes Libre par 4 -----
INSERT INTO teams (id, sub_tournament_id, team_number) VALUES
  (1, 1, 1),
  (2, 1, 2);

INSERT INTO team_players (team_id, player_id, pair, player_number) VALUES
  (1, 1, 'NS', 1),
  (1, 2, 'NS', 2),
  (1, 3, 'EO', 3),
  (1, 4, 'EO', 4),
  (2, 5, 'NS', 1),
  (2, 6, 'NS', 2),
  (2, 7, 'EO', 3),
  (2, 8, 'EO', 4);
