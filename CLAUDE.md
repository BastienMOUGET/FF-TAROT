# PABB90 (FF-TAROT) — conventions du dépôt

Gestion de tournois de tarot (mode Libre par 4) pour le club Petit Au Bout
Belfortain. Back Amalgame/Mosaic (`server.am`, `lib/`, `modules/`), front
Angular (`frontend/`), base MariaDB. Livré en installeur Windows `.exe`.

## Vocabulaire (celui du club, à respecter dans l'interface)

| Base | Interface |
|---|---|
| `tournaments` | **Challenge** (un par trimestre) |
| `sub_tournaments` | **Tournoi** (une soirée) |
| `rounds` | **Manche** (4 par soirée) |
| `teams` | tables / joueurs présents |

Un « Relais » est un joueur virtuel (`players.is_relais`) assis en Nord des
tables de 3, fixe toute la soirée, qui marque des points mais n'apparaît
dans aucun classement ni aucune liste.

## Règle n°1 : toute évolution du schéma passe par une migration

**Jamais** de modification d'un fichier `migrations/*.sql` existant, ni de
schéma appliqué à la main. Pour chaque changement de structure :

1. Créer `migrations/00N_ce_que_ça_fait.sql` avec le numéro suivant, en
   instructions rejouables et non destructrices
   (`ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `INSERT … WHERE NOT EXISTS`).
   `DROP TABLE`, `DROP DATABASE` et `TRUNCATE` sont refusés par la CI.
2. Ajouter la ligne correspondante au tableau « Migrations existantes » de
   [`migrations/README.md`](migrations/README.md).
3. Lancer `./tests/migrations.sh` : il monte une MariaDB jetable et vérifie
   base vierge, rejeu, base déjà peuplée (les données doivent survivre) et
   migration en échec. Y ajouter la vérification de la colonne créée. La CI
   le rejoue à chaque push.

Pourquoi : le beau-père installe chaque version par-dessus la précédente,
avec les données réelles du club. Les quatre chemins d'installation
(`install.sh`, `install.ps1`, `docker-entrypoint.sh`, `RunMigrations()` dans
`installer/setup.iss`) appliquent les mêmes fichiers, dans l'ordre, une
seule fois par base, en traçant dans `schema_migrations`. Une migration
oubliée ou un `001` édité = le back interroge une colonne absente et l'écran
se vide en silence. Voir l'historique v3.0.20 dans `ROADMAP.md`.

Corollaire pour les réponses à l'utilisateur : quand une version contient
une migration, le dire, et rappeler que l'installation se fait par-dessus
sans perte de données.

## Construire et tester le back

`./build.sh` utilise l'`amc` du poste. Il ne produit **pas** un binaire
représentatif : avec amc 0.8.90 et le cache local, toute requête
authentifiée répond 401. Pour tester l'API, utiliser :

```bash
./build-ci.sh        # → ./server-ci, chaîne identique à la release
```

Il télécharge l'`amc` épinglé par `.github/workflows/release.yml` dans
`~/.cache/pabb90-ci/`, remplit un cache de paquets vierge depuis
`amalgame.lock` et vérifie que le lock ressort inchangé.

Base de test : instance MariaDB jetable sur le port 3307, socket dans
`/tmp` (limite de 107 caractères), puis `migrate.sh` avec `MYSQL_BIN`
pointant sur un script qui passe `--socket`. Le listener HTTP est en
`SO_REUSEPORT` : plusieurs serveurs peuvent écouter le même port sans
erreur, donc `kill -9` et `ss -ltnp | grep <port>` avant chaque test.

## Cycle de livraison

1. Modifications + `migrations/README.md` et `ROADMAP.md` (une section par
   version, avec la cause des bugs et ce qui a été vérifié).
2. Commit de la fonctionnalité.
3. Bump de version dans **quatre** fichiers : `amalgame.toml`,
   `frontend/package.json`, `frontend/package-lock.json`,
   `frontend/src/environments/environment.ts`.
4. Commit `ci: vX.Y.Z (…)`, tag `vX.Y.Z`, push de `main` et du tag.
5. La CI et le workflow Release produisent `pabb90-X.Y.Z-setup.exe`.

`amalgame.lock` épingle des commits, pas seulement des tags : ne jamais
l'aligner sur le cache local, toujours vérifier avec `git ls-remote`.

## Défauts connus, non corrigés

- Une pénalité saisie sur un challenge est appliquée au classement de
  **chacun** de ses tournois (`ModRanking.Compute` somme les pénalités du
  `tournament_id` sans filtrer sur le sous-tournoi). Sans effet aujourd'hui :
  le club n'utilise pas les pénalités. À traiter avant de s'en servir, ou si
  un ajustement manuel du classement du Challenge devient nécessaire.
- Aucun test automatisé du back : la CI vérifie le build, des sentinelles
  textuelles sur `migrations/` et le lint des scripts, pas le comportement.
  Les vérifications se font à la main avec `./server-ci` sur une base
  jetable (voir plus haut).

## Sauvegarde des données du club

Les données réelles ne vivent que dans la base MariaDB `fft`. La procédure
(`mysqldump`, restauration, Windows / Linux / Docker) est dans
[`INSTALL.md`](INSTALL.md) et résumée dans la notice de l'application. Le
rappeler quand une manipulation risquée est en jeu (`reset-db.sh`,
désinstallation, changement de schéma inhabituel).

## Retours terrain

`feedback/` (non versionné, données personnelles de joueurs) contient les
mémos et fichiers Excel du club. Chaque retour est traité, journalisé dans
`ROADMAP.md` avec son numéro, et livré en une version.
