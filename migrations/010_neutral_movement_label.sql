-- ============================================================================
-- 010 — Libellé du mouvement de base sans référence à une fédération
-- ============================================================================
-- Le logiciel n'a plus de lien avec la fédération dont il est issu : le
-- libellé posé par 009 (« Mouvement de base FFT … ») est renommé.
--
-- Seul le libellé change : les décalages (N fixe, S+1, E+2, O-2), donc les
-- placements, restent identiques. Le libellé n'est lu par aucun calcul.
--
-- Rejouable : la condition sur l'ancien libellé exact rend un second passage
-- sans effet, et laisse intact un libellé que le club aurait déjà modifié.
-- ============================================================================

UPDATE movement_patterns
   SET label = 'Mouvement de base (N fixe, S+1, E+2, O-2)'
 WHERE table_count = 0
   AND position = 0
   AND label = 'Mouvement de base FFT (N fixe, S+1, E+2, O-2)';
