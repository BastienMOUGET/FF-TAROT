#!/usr/bin/env bash
# Attend la DB, applique les migrations manquantes, puis démarre le back.
set -e

: "${DB_HOST:=db}"
: "${DB_USER:=fft_user}"
: "${DB_PASSWORD:=fft_password}"
: "${DB_NAME:=fft}"
export DB_HOST DB_USER DB_PASSWORD DB_NAME

echo "[entrypoint] Attente MariaDB sur $DB_HOST..."
until mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" -e 'SELECT 1' >/dev/null 2>&1; do
  sleep 1
done
echo "[entrypoint] MariaDB répond."

# migrate.sh installe le schéma sur un volume vierge et, sur un volume déjà
# peuplé, n'applique que les migrations manquantes — les données du club
# survivent donc à une montée de version de l'image.
# FFT_SEED_DEMO=1 charge en plus le jeu de démo, mais uniquement si la base
# est vierge (jamais sur des données existantes).
MIGRATE_ARGS=()
[[ "${FFT_SEED_DEMO:-0}" == "1" ]] && MIGRATE_ARGS+=(--seed)
/app/migrate.sh "${MIGRATE_ARGS[@]}"

echo "[entrypoint] Démarrage du back Amalgame (API :3000 + Socket.IO :3001)..."
exec "$@"
