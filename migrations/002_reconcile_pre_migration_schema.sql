-- =====================================================
-- 002 — Rattrapage des bases antérieures au système de migrations
-- =====================================================
-- 001_baseline.sql est en CREATE TABLE IF NOT EXISTS : il crée les tables
-- absentes, mais ne touche JAMAIS à une table qui existe déjà. Une base
-- installée avec un ancien db.sql, puis restée en place, garde donc son
-- schéma d'époque — sans les colonnes ajoutées depuis. Le back interroge
-- ces colonnes et la requête échoue en silence (liste de joueurs vide,
-- classement Challenge cassé).
--
-- Ce fichier remet ces bases au niveau. ADD COLUMN IF NOT EXISTS est une
-- extension MariaDB : sur une base fraîche, où 001 a déjà créé les colonnes,
-- chaque instruction est un no-op.
--
-- RÈGLE POUR LA SUITE : ne jamais ajouter une colonne en éditant 001 — une
-- base déjà migrée ne rejouera pas 001 et ne la verra donc jamais. Toute
-- évolution de schéma passe par un NOUVEAU fichier NNN_*.sql.

-- Adhérent du club (statut club, indépendant de la licence FFT).
-- Interrogé par ModPlayers.SELECT_BASE : son absence vide toute la liste
-- des joueurs dans l'admin.
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS club_member BOOLEAN NOT NULL DEFAULT FALSE
  AFTER birth_year;

-- Mode de calcul du classement "Challenge" agrégeant les sous-tournois :
-- 'place' = points selon le rang, 'raw' = cumul brut.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS challenge_mode ENUM('place','raw') NOT NULL DEFAULT 'place'
  AFTER coef_default;
