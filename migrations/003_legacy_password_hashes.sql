-- =====================================================
-- 003 — Comptes admin bloqués par un hash hérité (pré-Amalgame)
-- =====================================================
-- L'ancien back Node hachait les mots de passe en bcrypt ($2a$/$2b$/$2y$).
-- Le back Amalgame vérifie via Password.Verify d'amalgame-crypto, qui ne
-- connaît que scrypt ($scrypt$...). Un compte au hash bcrypt ne peut donc
-- PLUS s'authentifier : la comparaison échoue toujours, quel que soit le
-- mot de passe saisi. C'est un identifiant mort.
--
-- Conséquence sur une installation venue de l'ancien back : si le seul
-- compte admin a un hash bcrypt, plus personne ne peut entrer dans
-- l'application, et il n'existe aucun écran de récupération.
--
-- Ce rattrapage remet ces comptes admin sur le mot de passe par défaut
-- documenté partout ailleurs (admin / admin123), à changer immédiatement.
--
-- Pourquoi c'est sans risque : on ne remplace pas un mot de passe
-- utilisable par un mot de passe faible. Le hash visé est déjà
-- invérifiable — le compte est inaccessible avant comme après, la
-- migration ne fait que le rendre récupérable.
--
-- Portée volontairement limitée aux comptes 'admin' : c'est le minimum
-- pour rendre la main. Les comptes arbitre/viewer au hash hérité restent
-- inactifs plutôt que de devenir des accès vivants sur un mot de passe
-- connu ; l'admin les réinitialise depuis l'onglet Utilisateurs.

UPDATE users
   SET password_hash = '$scrypt$ln=15,r=8,p=1$lzTnhnClOkY7RcXOaJJS-g$UQLg5juPCb6q3Js07u-_V1woLKtzjBj4dU4yKLtPgkQ'
 WHERE role = 'admin'
   AND password_hash NOT LIKE '$scrypt$%';
