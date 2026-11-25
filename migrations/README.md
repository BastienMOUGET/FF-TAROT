# Migrations de schéma

Chaque fichier `NNN_description.sql` est appliqué **une seule fois** par base,
dans l'ordre de son préfixe numérique. Ce qui a été appliqué est enregistré
dans la table `schema_migrations`.

| Situation | Effet |
|---|---|
| Base vierge | toutes les migrations sont jouées → installation complète |
| Base déjà à jour | rien n'est fait |
| Base d'une version antérieure | seules les migrations manquantes sont jouées, les données sont conservées |

## Qui applique les migrations

| Plateforme | Mécanisme |
|---|---|
| Linux (`install.sh`) | `migrate.sh --as-root` |
| Docker (`docker-entrypoint.sh`) | `migrate.sh`, à chaque démarrage du conteneur |
| Windows `.exe` (`installer/setup.iss`) | `RunMigrations()`, en Pascal natif |
| Windows `.zip` (`install.ps1`) | `migrate.ps1 -AsRoot` |
| Dev / ops | `./migrate.sh --status`, `./update-db.sh`, `./reset-db.sh` |

Les quatre implémentations lisent **les mêmes fichiers `.sql`** : seule la
boucle qui les applique diffère, pas le schéma.

## Écrire une nouvelle migration

1. Créer `migrations/00N_ce_que_ça_fait.sql` avec le numéro suivant.
2. N'y mettre que des instructions **rejouables** et **non destructrices**.
3. Vérifier avec `./migrate.sh --status` puis `./migrate.sh`.
4. Lancer `./tests/migrations.sh` (MariaDB jetable : base vierge, rejeu,
   base peuplée, migration en échec) et y ajouter un contrôle de la colonne
   ajoutée. La CI rejoue ce test à chaque push.

### La règle à ne pas oublier

> **Ne jamais ajouter une colonne en modifiant `001_baseline.sql`.**

`001` est en `CREATE TABLE IF NOT EXISTS` : sur une base qui possède déjà la
table, il ne fait rien du tout. Et une base qui a déjà `001` dans
`schema_migrations` ne le rejouera jamais. Une colonne ajoutée à `001` n'aurait
donc **aucun effet** sur les bases existantes — le back interrogerait une
colonne absente, la requête échouerait, et l'écran concerné se viderait en
silence. C'est exactement ce que `002` corrige pour `players.club_member` et
`tournaments.challenge_mode`.

Toute évolution de schéma passe par un **nouveau fichier** :

```sql
ALTER TABLE joueurs ADD COLUMN IF NOT EXISTS ma_colonne VARCHAR(50) NULL;
```

`ADD COLUMN IF NOT EXISTS` est une extension MariaDB — c'est le SGBD utilisé
par tous les installeurs du projet.

### Migrations existantes

| # | Rôle |
|---|---|
| `001_baseline.sql` | schéma complet + données de référence (78 cartes, patron de mouvement, types de pénalité, compte admin) |
| `002_reconcile_pre_migration_schema.sql` | ajoute `players.club_member` et `tournaments.challenge_mode` aux bases antérieures au système de migrations |
| `003_legacy_password_hashes.sql` | remet sur `admin123` les comptes admin dont le hash est hérité de l'ancien back Node (bcrypt), donc invérifiable par le back Amalgame |
| `004_team_player_seat.sql` | ajoute `team_players.seat` : le siège N/S/E/O choisi au tirage au sort, respecté par la mise en place de la manche 1 (tables de 3) |
| `005_relais_and_imported.sql` | `players.is_relais` + 3 joueurs « Relais » (Nord fixe des tables de 3) ; `sub_tournaments.imported` (classement importé, jamais recalculé) |
| `006_club_logo.sql` | `clubs.logo` : image du club en data URL, miniature sur les classements imprimés |
| `007_rounds_planned_and_settings.sql` | `sub_tournaments.rounds_planned` (manches prévues, 4) + paramètre global `rounds_default` |
| `008_placement_mode.sql` | `sub_tournaments.placement_mode` : mouvement standard, tables par niveau, ou dernière manche par niveau |
| `009_fft_movements.sql` | mouvements par nombre de tables **et par position** : `movement_patterns.position`, mouvement de base corrigé en Ouest −2, tableaux 6/8/9/10/12/14/15/16/18/20 tables |
| `010_neutral_movement_label.sql` | libellé du mouvement de base renommé « Mouvement de base (N fixe, S+1, E+2, O-2) », sans référence à une fédération ; décalages inchangés |
| `011_team_player_orientation.sql` | `team_players.orientation` : consigne de position du tirage (N/S/E/O fixe, « Non Nord », NULL = aléatoire), respectée aussi par les manches formées par niveau |

### Interdit dans une migration

`DROP TABLE`, `DROP DATABASE` et `TRUNCATE` : la CI les refuse. C'est ce que
faisait l'ancien `db.sql`, et c'est pour ça que réinstaller par-dessus une base
existante effaçait le club.

## Jeu de démo

`seed.sql` (club et tournoi de test) n'est **jamais** installé par défaut. Il se
demande explicitement, et n'est chargé que si la base est vierge :

```bash
sudo ./install.sh --with-demo     # Linux
.\install.ps1 -WithDemo           # Windows .zip
FFT_SEED_DEMO=1 docker compose up # Docker
```
