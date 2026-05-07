#!/usr/bin/env bash
# Attend la DB, applique db.sql + seed.sql si la base est vide, puis démarre.
set -e

: "${DB_HOST:=db}"
: "${DB_USER:=fft_user}"
: "${DB_PASSWORD:=fft_password}"
: "${DB_NAME:=fft}"

echo "[entrypoint] Attente MariaDB sur $DB_HOST..."
until mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e 'SELECT 1' >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] MariaDB répond."

# Si la table 'players' n'existe pas, on initialise.
if ! mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
     -e 'SELECT 1 FROM players LIMIT 1' >/dev/null 2>&1; then
  echo "[entrypoint] Première init : application de db.sql + seed.sql"
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" < /app/db.sql
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < /app/seed.sql
  echo "[entrypoint] DB initialisée"
else
  echo "[entrypoint] DB déjà initialisée"
fi

echo "[entrypoint] Démarrage du serveur Node..."
exec "$@"
