#!/usr/bin/env bash
#
# PABB90 — Migrateur de base de données
#
# Applique, dans l'ordre, les fichiers migrations/NNN_*.sql qui n'ont pas
# encore été joués sur cette base. Le suivi se fait dans la table
# `schema_migrations` (une ligne par migration appliquée).
#
#   - Base vierge  → toutes les migrations sont jouées (= installation).
#   - Base à jour  → rien n'est fait.
#   - Base d'une version antérieure → seules les migrations manquantes
#     sont jouées, les données existantes sont conservées.
#
# Une base PABB90 antérieure au système de migrations (≤ v3.0.19) n'a pas
# de table `schema_migrations` : 001_baseline.sql lui sera appliqué, mais
# il est écrit en CREATE TABLE IF NOT EXISTS / INSERT IGNORE et ne touchera
# donc à aucune de ses données.
#
# Usage :
#   ./migrate.sh                 # migre, en lisant .env pour la connexion
#   sudo ./migrate.sh --as-root  # migre en se connectant en root MariaDB
#   ./migrate.sh --status        # liste l'état sans rien appliquer
#   ./migrate.sh --seed          # + jeu de démo, SI la base était vierge
#
# Variables d'environnement reconnues (prioritaires sur .env) :
#   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME MYSQL_BIN

set -euo pipefail

log()  { printf '\033[1;34m[DB]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[KO]\033[0m %s\n' "$*" >&2; exit 1; }

SCRIPT_DIR=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
MIG_DIR="$SCRIPT_DIR/migrations"

# ---------------------------- Args ----------------------------

AS_ROOT=0
WITH_SEED=0
STATUS_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --as-root) AS_ROOT=1 ;;
    --seed)    WITH_SEED=1 ;;
    --status)  STATUS_ONLY=1 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) die "Argument inconnu : $arg" ;;
  esac
done

# ---------------------------- Connexion ----------------------------

# .env fournit les défauts ; l'environnement du shell est prioritaire.
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  while IFS='=' read -r k v; do
    case "$k" in
      DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)
        [[ -z "${!k:-}" ]] && export "$k=$v" ;;
    esac
  done < <(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' "$SCRIPT_DIR/.env" || true)
fi

: "${DB_HOST:=localhost}"
: "${DB_PORT:=3306}"
: "${DB_USER:=fft_user}"
: "${DB_PASSWORD:=}"
: "${DB_NAME:=fft}"
: "${MYSQL_BIN:=}"

if [[ -z "$MYSQL_BIN" ]]; then
  MYSQL_BIN=$(command -v mariadb || command -v mysql || true)
fi
[[ -n "$MYSQL_BIN" ]] || die "Client mariadb/mysql introuvable."

# Construit les options de connexion une fois pour toutes. En --as-root on
# ne passe pas de mot de passe : root@localhost utilise unix_socket (Linux)
# ou l'auth nommée (Windows) ; MYSQL_PWD reste honoré par le client si posé.
CONN=()
if [[ "$AS_ROOT" -eq 1 ]]; then
  CONN=(--user=root)
else
  CONN=(--host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER")
  [[ -n "$DB_PASSWORD" ]] && CONN+=(--password="$DB_PASSWORD")
fi

# Exécute du SQL sur la base applicative.
sql() { "$MYSQL_BIN" "${CONN[@]}" --batch --skip-column-names "$DB_NAME" -e "$1"; }
# Idem mais sans base sélectionnée (pour le CREATE DATABASE).
sql_nodb() { "$MYSQL_BIN" "${CONN[@]}" --batch --skip-column-names -e "$1"; }
# Joue un fichier .sql entier (multi-statements gérés par le client).
sql_file() { "$MYSQL_BIN" "${CONN[@]}" "$DB_NAME" < "$1"; }

sql_nodb 'SELECT 1' >/dev/null 2>&1 \
  || die "Connexion MariaDB impossible ($DB_USER@$DB_HOST:$DB_PORT)."

# ---------------------------- Bootstrap ----------------------------

db_exists() {
  local n
  n=$(sql_nodb "SELECT COUNT(*) FROM information_schema.schemata
                WHERE schema_name = '$DB_NAME';" 2>/dev/null || echo 0)
  [[ "$n" == "1" ]]
}

# On ne tente le CREATE DATABASE que si la base manque : l'utilisateur
# applicatif n'a de droits que sur `$DB_NAME` et un CREATE DATABASE, même
# IF NOT EXISTS, lui serait refusé.
if [[ "$STATUS_ONLY" -eq 0 ]] && ! db_exists; then
  log "Création de la base $DB_NAME..."
  sql_nodb "CREATE DATABASE \`$DB_NAME\`
            CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
    || die "Création de $DB_NAME refusée. Relancez avec --as-root, ou créez
la base à la main puis relancez."
fi

table_exists() {
  local n
  n=$(sql "SELECT COUNT(*) FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = '$1';" 2>/dev/null || echo 0)
  [[ "$n" == "1" ]]
}

# Base "vierge" = pas encore de table applicative. Sert à décider si le jeu
# de démo (--seed) peut être posé : jamais sur une base qui contient déjà
# les données d'un club.
FRESH=0
if ! table_exists players; then FRESH=1; fi

if [[ "$STATUS_ONLY" -eq 0 ]]; then
  sql "CREATE TABLE IF NOT EXISTS schema_migrations (
         version     VARCHAR(64)  NOT NULL PRIMARY KEY,
         filename    VARCHAR(255) NOT NULL,
         applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB;"
elif ! table_exists schema_migrations; then
  warn "Base non migrée (pas de table schema_migrations)."
fi

is_applied() {
  local n
  n=$(sql "SELECT COUNT(*) FROM schema_migrations WHERE version = '$1';" 2>/dev/null || echo 0)
  [[ "$n" != "0" ]]
}

# ---------------------------- Application ----------------------------

shopt -s nullglob
FILES=("$MIG_DIR"/[0-9]*.sql)
shopt -u nullglob
[[ ${#FILES[@]} -gt 0 ]] || die "Aucune migration trouvée dans $MIG_DIR"

APPLIED=0
for f in "${FILES[@]}"; do
  base=$(basename "$f")
  version=${base%%_*}

  if is_applied "$version"; then
    [[ "$STATUS_ONLY" -eq 1 ]] && printf '  %-4s %-45s déjà appliquée\n' "$version" "$base"
    continue
  fi

  if [[ "$STATUS_ONLY" -eq 1 ]]; then
    printf '  %-4s %-45s \033[1;33mEN ATTENTE\033[0m\n' "$version" "$base"
    continue
  fi

  log "Application de $base..."
  sql_file "$f" || die "Échec de la migration $base — base laissée en l'état, rien n'a été enregistré."
  sql "INSERT INTO schema_migrations (version, filename) VALUES ('$version', '$base');"
  APPLIED=$((APPLIED + 1))
done

if [[ "$STATUS_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ "$APPLIED" -eq 0 ]]; then
  ok "Base $DB_NAME déjà à jour (aucune migration à appliquer)"
else
  ok "$APPLIED migration(s) appliquée(s) sur $DB_NAME"
fi

# ---------------------------- Seed (démo) ----------------------------

if [[ "$WITH_SEED" -eq 1 ]]; then
  if [[ "$FRESH" -eq 1 ]]; then
    log "Base vierge : chargement du jeu de démo (seed.sql)..."
    sql_file "$SCRIPT_DIR/seed.sql"
    ok "Jeu de démo chargé (club + tournoi de test)"
  else
    warn "--seed ignoré : la base contient déjà des données (le seed les écraserait)."
  fi
fi
