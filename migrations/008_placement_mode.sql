-- =====================================================
-- 008 — Mode de placement des manches
-- =====================================================
-- Retour terrain n°9 : d'autres clubs forment les tables « par niveau »,
-- d'après le classement en cours, au lieu du mouvement fédéral :
--   movement   : mouvement Libre par 4 (N fixe, S+1, E+2, O-1) — jusqu'ici
--                le seul mode, et le défaut.
--   level      : dès la manche 2, les 4 meilleurs du classement cumulé
--                ensemble, les 4 suivants ensemble, etc.
--   level_last : mouvement pour toutes les manches sauf la dernière, formée
--                par niveau d'après le classement après l'avant-dernière.
-- Ces deux derniers modes se calculent manche par manche (il faut la
-- précédente validée), donc les manches ne sont plus toutes générées
-- d'avance et le placement s'imprime entre chaque manche.
ALTER TABLE sub_tournaments
  ADD COLUMN IF NOT EXISTS placement_mode
    ENUM('movement','level','level_last') NOT NULL DEFAULT 'movement'
  AFTER rounds_planned;
