#!/usr/bin/env bash
#
# DEV UNIQUEMENT — détruit la base et la recrée depuis les migrations.
# Toutes les données sont perdues. En production, utiliser migrate.sh.
#
#   ./reset-db.sh          # base vide (schéma + données de référence)
#   ./reset-db.sh --seed   # + jeu de démo (club/tournoi de test)
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

DB_NAME="${DB_NAME:-fft}"
MYSQL_BIN=$(command -v mariadb || command -v mysql)

read -rp "Détruire complètement la base '$DB_NAME' ? (tape OUI) " answer
[[ "$answer" == "OUI" ]] || { echo "Annulé."; exit 1; }

sudo "$MYSQL_BIN" --user=root -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;"
echo "[reset] Base $DB_NAME supprimée."
sudo DB_NAME="$DB_NAME" ./migrate.sh --as-root "$@"
