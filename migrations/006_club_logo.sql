-- =====================================================
-- 006 — Logo de club (retour terrain n°5)
-- =====================================================
-- Image du club, en miniature sur les classements imprimés (challenge,
-- tournoi, manche). Stockée en data URL (image/jpeg réduite côté
-- navigateur à ~200 px, donc quelques dizaines de Ko) : pas de fichier à
-- servir ni de dossier à sauvegarder, la base contient tout. Optionnel
-- par club : l'application reste utilisable par d'autres clubs.
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS logo MEDIUMTEXT NULL
  AFTER comite_id;
