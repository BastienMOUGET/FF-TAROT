-- ============================================================================
-- 011 — Consigne de position de chaque joueur inscrit
-- ============================================================================
-- Au tirage au sort, chaque joueur peut recevoir une consigne : Nord, Sud,
-- Est ou Ouest fixe, ou « Non Nord ». Elle n'était connue que de l'écran du
-- tirage : les manches formées PAR NIVEAU (mode « par niveau » ou « dernière
-- manche par niveau ») tiraient ensuite les places au hasard et l'ignoraient.
--
-- team_players.orientation la conserve pour toute la soirée :
--   NULL         = position aléatoire (par défaut, et pour toutes les
--                  inscriptions antérieures à cette migration)
--   'N','S','E','O' = siège fixe
--   'not_north'  = tout siège sauf Nord
--
-- Rejouable et non destructive : ADD COLUMN IF NOT EXISTS, colonne
-- facultative, aucune donnée existante modifiée.
-- ============================================================================

ALTER TABLE team_players
  ADD COLUMN IF NOT EXISTS orientation VARCHAR(10) NULL
  AFTER seat;
