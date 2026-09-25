-- =====================================================
-- 009 — Mouvements FFT par nombre de tables ET par position
-- =====================================================
-- Retour terrain n°13. Deux écarts avec le règlement fédéral :
--
--   1. Le mouvement de base était « Ouest −1 ». La FFT impose
--      NORD fixe, SUD +1, EST +2, OUEST **−2**, valable pour 5, 7, 11, 13,
--      17, 19, 21 tables et au-delà.
--   2. Certains nombres de tables ont des mouvements qui changent selon la
--      POSITION jouée (la manche). La table n'avait qu'une ligne par
--      nombre de tables : on ajoute la position.
--
-- `position` = numéro de la manche que le mouvement produit (on passe de la
-- manche N-1 à la manche N). 0 = règle valable pour toutes les positions de
-- ce nombre de tables. La recherche va du plus précis au plus général :
-- (tables, position) → (tables, 0) → (0, 0).
ALTER TABLE movement_patterns
  ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0
  AFTER table_count;

-- La clé unique portait sur le seul nombre de tables.
ALTER TABLE movement_patterns DROP INDEX IF EXISTS table_count;
ALTER TABLE movement_patterns ADD UNIQUE KEY IF NOT EXISTS
  uniq_movement (table_count, position);

-- Mouvement de base : Ouest passe de −1 à −2.
UPDATE movement_patterns
   SET offset_o = -2, label = 'Mouvement de base FFT (N fixe, S+1, E+2, O-2)'
 WHERE table_count = 0 AND position = 0;

-- Nombres de tables et positions dont le mouvement diffère du mouvement de
-- base (tableaux « Organisation des tournois » de la FFT). INSERT IGNORE :
-- la clé unique (table_count, position) rend le rejeu sans effet.
INSERT IGNORE INTO movement_patterns
  (table_count, position, offset_n, offset_s, offset_e, offset_o, label) VALUES
  -- Nombres de tables où Ouest recule d'une seule table.
  ( 6, 0, 0, 1, 2, -1, '6 tables : Ouest -1 (5 positions max)'),
  ( 8, 0, 0, 1, 2, -1, '8 tables : Ouest -1 (6 positions max)'),
  (10, 0, 0, 1, 2, -1, '10 tables : Ouest -1'),
  -- Exceptions par position.
  ( 6, 3, 0, 1, 2,  3, '6 tables, position 3 : Ouest +3'),
  ( 6, 4, 0, 1, 2, -2, '6 tables, position 4 : Ouest -2'),
  ( 8, 5, 0, 2, 3, -1, '8 tables, position 5 : Sud +2, Est +3'),
  ( 8, 6, 0, 1, 4, -1, '8 tables, position 6 : Est +4'),
  ( 9, 4, 0, 1, 3, -3, '9 tables, position 4 : Est +3, Ouest -3'),
  ( 9, 5, 0, 1, 3, -3, '9 tables, position 5 : Est +3, Ouest -3'),
  (10, 6, 0, 1, 3, -2, '10 tables, position 6 : Est +3, Ouest -2'),
  (12, 4, 0, 1, 2, -3, '12 tables, position 4 : Ouest -3'),
  (12, 7, 0, 1, 3, -2, '12 tables, position 7 : Est +3'),
  (14, 5, 0, 1, 2, -3, '14 tables, position 5 : Ouest -3'),
  (15, 5, 0, 1, 2, -3, '15 tables, position 5 : Ouest -3'),
  (16, 5, 0, 1, 2, -3, '16 tables, position 5 : Ouest -3'),
  (16, 6, 0, 1, 2, -3, '16 tables, position 6 : Ouest -3'),
  (18, 6, 0, 1, 2, -3, '18 tables, position 6 : Ouest -3'),
  (20, 6, 0, 1, 2, -3, '20 tables, position 6 : Ouest -3');
