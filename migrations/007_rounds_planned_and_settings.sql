-- =====================================================
-- 007 — Nombre de manches prévu + paramètres globaux
-- =====================================================
-- Retour terrain n°6 : le club joue 4 manches par soirée et veut imprimer
-- les feuilles de marque des 4 dès le début. Le tournoi porte donc son
-- nombre de manches prévu ; les manches sont toutes générées après le
-- tirage au sort.
ALTER TABLE sub_tournaments
  ADD COLUMN IF NOT EXISTS rounds_planned INT NOT NULL DEFAULT 4
  AFTER imported;

-- Paramètres globaux (table `parameters`, scope 'global') :
--   rounds_default   nombre de manches proposé à la création d'un tournoi
--   default_club_id  club affiché en tête du bandeau et présélectionné
-- La clé unique contient tournament_id (NULL ici) : INSERT IGNORE ne
-- dédoublonne pas sur NULL, d'où le WHERE NOT EXISTS.
INSERT INTO parameters (scope, tournament_id, param_key, param_value)
  SELECT 'global', NULL, 'rounds_default', '4' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM parameters WHERE scope = 'global' AND param_key = 'rounds_default');
