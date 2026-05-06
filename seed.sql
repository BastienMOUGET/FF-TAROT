USE fft;

-- -------------------------
-- JOUEURS
-- -------------------------
INSERT INTO players (id, name, firstname) VALUES
(1, 'Dupont', 'Jean'),
(2, 'Martin', 'Paul'),
(3, 'Durand', 'Luc'),
(4, 'Bernard', 'Marc');

-- -------------------------
-- TOURNOI
-- -------------------------
INSERT INTO tournaments (id, name, date)
VALUES (1, 'Tournoi Test FFT', NOW());

-- -------------------------
-- ROUND 1
-- -------------------------
INSERT INTO scores (tournament_id, round_id, player_id, score, codif, role) VALUES
(1, 1, 1, 1200, NULL, 'A'),
(1, 1, 2, 800,  NULL, 'D'),
(1, 1, 3, 400,  NULL, 'D'),
(1, 1, 4, -200, NULL, 'D');

-- -------------------------
-- ROUND 2
-- -------------------------
INSERT INTO scores (tournament_id, round_id, player_id, score, codif, role) VALUES
(1, 2, 2, 1100, NULL, 'A'),
(1, 2, 1, 700,  NULL, 'D'),
(1, 2, 3, 300,  NULL, 'D'),
(1, 2, 4, -100, NULL, 'D');

-- -------------------------
-- ROUND 3 (cas spécial FFT)
-- -------------------------
INSERT INTO scores (tournament_id, round_id, player_id, score, codif, role) VALUES
(1, 3, 3, 0, '*4', 'A'),
(1, 3, 1, 0, '*4', 'D'),
(1, 3, 2, 0, '*4', 'D'),
(1, 3, 4, 0, '*4', 'D');

-- -------------------------
-- PENALITE
-- -------------------------
INSERT INTO penalties (tournament_id, player_id, points)
VALUES (1, 4, 10);