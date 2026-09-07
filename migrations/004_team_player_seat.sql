-- =====================================================
-- 004 — Siège demandé par joueur dans son équipe
-- =====================================================
-- Le tirage au sort du front choisit un siège N/S/E/O par joueur (avec les
-- préférences d'orientation : Nord, Sud, Est, Ouest ou « non Nord »). Il
-- n'envoyait que la paire NS/EO et l'ordre des joueurs : sur une table de
-- 3, le siège réel était perdu et la place vide tombait toujours au même
-- endroit. Le siège explicite est maintenant conservé, et la mise en
-- place de la manche 1 le respecte. NULL = ancien comportement (ordre des
-- joueurs). ADD COLUMN IF NOT EXISTS : rejouable, sans effet sur une base
-- déjà migrée.
ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS seat ENUM('N','S','E','O') NULL
  AFTER player_number;
