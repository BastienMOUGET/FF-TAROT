-- =====================================================
-- 005 — Joueurs « Relais » (tables de 3) + tournois importés
-- =====================================================
-- Tables de 3 (retour terrain n°4) : le club joue avec un joueur virtuel
-- « Relais 1/2/3 » assis en Nord, FIXE à sa table toute la soirée, qui
-- marque des points comme les autres (la somme des 4 sièges fait 0). Il
-- ne doit apparaître ni dans la liste des joueurs ni dans les
-- classements : players.is_relais le marque.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_relais BOOLEAN NOT NULL DEFAULT FALSE
  AFTER club_member;

INSERT INTO players (name, firstname, is_relais)
  SELECT 'Relais', '1', TRUE FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE is_relais = TRUE AND firstname = '1');
INSERT INTO players (name, firstname, is_relais)
  SELECT 'Relais', '2', TRUE FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE is_relais = TRUE AND firstname = '2');
INSERT INTO players (name, firstname, is_relais)
  SELECT 'Relais', '3', TRUE FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM players WHERE is_relais = TRUE AND firstname = '3');

-- Tournoi importé depuis un classement externe (CSV de l'Excel FFT) : il
-- n'a ni équipes ni manches, seulement des lignes de `rankings`. Le
-- recalcul des classements doit l'ignorer, sinon il l'effacerait.
ALTER TABLE sub_tournaments
  ADD COLUMN IF NOT EXISTS imported BOOLEAN NOT NULL DEFAULT FALSE
  AFTER donne_set_id;
