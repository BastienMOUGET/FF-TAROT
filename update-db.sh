#!/usr/bin/env bash
# Applique les migrations en attente sur la base locale de dev.
# Ne détruit rien : voir reset-db.sh pour repartir de zéro.
set -e
cd "$(dirname "$(readlink -f "$0")")"
sudo ./migrate.sh --as-root "$@"
