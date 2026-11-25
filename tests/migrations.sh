#!/usr/bin/env bash
#
# PABB90 — test des migrations de base
#
# Vérifie ce que CLAUDE.md exige de toute nouvelle migration :
#   1. base VIERGE   → toutes les migrations passent, le schéma est complet
#   2. rejeu         → rien n'est réappliqué (idempotence)
#   3. base PEUPLÉE  → les données d'un club existant survivent, et les
#                      colonnes ajoutées depuis sont bien là
#   4. échec         → une migration cassée n'est pas enregistrée, donc
#                      retentée à la prochaine installation
#
# Tourne sur sa PROPRE instance MariaDB jetable : ne touche jamais à la base
# de dev ni à celle du club. Rien à installer d'autre que mariadb-server.
#
#   ./tests/migrations.sh
#
set -uo pipefail

cd "$(dirname "$(readlink -f "$0")")/.."
REPO=$PWD
PORT=${PORT:-3399}
# Le socket doit rester court : MariaDB refuse au-delà de 107 caractères.
SOCK=/tmp/pabb90-migtest-$PORT.sock
WORK=$(mktemp -d /tmp/pabb90-migtest-XXXXXX)

PASS=0; FAIL=0
ok()   { printf '  \033[1;32mok\033[0m   %s\n' "$1"; PASS=$((PASS+1)); }
ko()   { printf '  \033[1;31mKO\033[0m   %s — attendu [%s], obtenu [%s]\n' "$1" "$2" "$3"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else ko "$1" "$3" "$2"; fi; }
step() { printf '\n\033[1;34m%s\033[0m\n' "$1"; }

cleanup() {
    [ -f "$WORK/mariadbd.pid" ] && kill "$(cat "$WORK/mariadbd.pid")" 2>/dev/null
    sleep 1
    pkill -f "mariadbd.*--port=$PORT" 2>/dev/null
    rm -rf "$WORK" "$SOCK"
}
trap cleanup EXIT

command -v /usr/sbin/mariadbd >/dev/null || { echo "mariadb-server absent" >&2; exit 2; }

step "Instance MariaDB jetable (port $PORT)"
mariadb-install-db --datadir="$WORK/data" --auth-root-authentication-method=normal \
    --skip-test-db >"$WORK/install.log" 2>&1 || { cat "$WORK/install.log"; exit 2; }
rm -f "$SOCK"
/usr/sbin/mariadbd --no-defaults --datadir="$WORK/data" --port="$PORT" \
    --bind-address=127.0.0.1 --socket="$SOCK" --pid-file="$WORK/mariadbd.pid" \
    --log-error="$WORK/error.log" --skip-name-resolve >"$WORK/out.log" 2>&1 &
for _ in $(seq 1 30); do
    mariadb --socket="$SOCK" --user=root -e 'SELECT 1' >/dev/null 2>&1 && break
    sleep 1
done
mariadb --socket="$SOCK" --user=root -e 'SELECT 1' >/dev/null 2>&1 \
    || { echo "MariaDB n'a pas démarré :"; tail -5 "$WORK/error.log"; exit 2; }

# migrate.sh parle au serveur par ce wrapper (il n'a pas d'option --socket).
printf '#!/usr/bin/env bash\nexec /usr/bin/mariadb --socket=%s "$@"\n' "$SOCK" > "$WORK/mysql"
chmod +x "$WORK/mysql"
export MYSQL_BIN="$WORK/mysql" DB_HOST=127.0.0.1 DB_PORT="$PORT"
R() { "$WORK/mysql" --user=root --batch --skip-column-names "$@"; }

NB_MIG=$(ls migrations/[0-9]*.sql | wc -l)
echo "  $NB_MIG migration(s) dans migrations/"

# ---------------------------------------------------------------- 1. vierge
step "1. Base vierge : installation complète"
DB_NAME=mt_fresh ./migrate.sh --as-root >"$WORK/fresh.log" 2>&1 \
    || { echo "  migrate.sh a échoué :"; tail -5 "$WORK/fresh.log"; FAIL=$((FAIL+1)); }
check "les $NB_MIG migrations sont enregistrées" \
    "$(R mt_fresh -e 'SELECT COUNT(*) FROM schema_migrations')" "$NB_MIG"
check "compte admin en scrypt" \
    "$(R mt_fresh -e "SELECT LEFT(password_hash,8) FROM users WHERE username='admin'")" '$scrypt$'
check "78 cartes de référence" "$(R mt_fresh -e 'SELECT COUNT(*) FROM cards')" 78
check "3 types de pénalité" "$(R mt_fresh -e 'SELECT COUNT(*) FROM penalty_types')" 3
check "aucune donnée de club (pas de --seed)" \
    "$(R mt_fresh -e 'SELECT COUNT(*) FROM clubs')" 0
# Colonnes ajoutées par les migrations successives : le back les interroge,
# leur absence viderait un écran en silence.
for col in players.club_member players.is_relais clubs.logo \
           tournaments.challenge_mode team_players.seat \
           sub_tournaments.imported sub_tournaments.rounds_planned \
           sub_tournaments.placement_mode; do
    t=${col%%.*}; c=${col##*.}
    check "colonne $col" "$(R mt_fresh -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='mt_fresh' AND table_name='$t' AND column_name='$c'")" 1
done
check "3 joueurs Relais" "$(R mt_fresh -e 'SELECT COUNT(*) FROM players WHERE is_relais = TRUE')" 3
# 009 : mouvements par nombre de tables et par position.
check "colonne movement_patterns.position" "$(R mt_fresh -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='mt_fresh' AND table_name='movement_patterns' AND column_name='position'")" 1
check "mouvement de base : Ouest -2" "$(R mt_fresh -e 'SELECT offset_o FROM movement_patterns WHERE table_count = 0 AND position = 0')" -2
check "6 tables : Ouest -1" "$(R mt_fresh -e 'SELECT offset_o FROM movement_patterns WHERE table_count = 6 AND position = 0')" -1
check "8 tables, position 5 : Sud +2" "$(R mt_fresh -e 'SELECT offset_s FROM movement_patterns WHERE table_count = 8 AND position = 5')" 2
check "clé unique (tables, position)" "$(R mt_fresh -e "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema='mt_fresh' AND table_name='movement_patterns' AND index_name='uniq_movement'")" 2
# 010 : libellé du mouvement de base sans référence à une fédération.
check "libellé du mouvement de base" "$(R mt_fresh -e 'SELECT label FROM movement_patterns WHERE table_count = 0 AND position = 0')" "Mouvement de base (N fixe, S+1, E+2, O-2)"
# 011 : consigne de position du tirage (team_players.orientation).
check "colonne team_players.orientation" "$(R mt_fresh -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='mt_fresh' AND table_name='team_players' AND column_name='orientation'")" 1

# ---------------------------------------------------------------- 2. rejeu
step "2. Rejeu : rien ne doit être réappliqué"
DB_NAME=mt_fresh ./migrate.sh --as-root >"$WORK/again.log" 2>&1
check "toujours $NB_MIG migrations" \
    "$(R mt_fresh -e 'SELECT COUNT(*) FROM schema_migrations')" "$NB_MIG"
check "message « déjà à jour »" \
    "$(grep -c 'déjà à jour' "$WORK/again.log")" 1
check "toujours un seul admin" \
    "$(R mt_fresh -e "SELECT COUNT(*) FROM users WHERE username='admin'")" 1

# ------------------------------------------------------- 3. base d'un club
step "3. Base d'une version antérieure, avec des données"
# On simule une installation restée au baseline : 001 seul, puis les données
# du club, puis la montée de version.
R -e "CREATE DATABASE mt_club CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
"$WORK/mysql" --user=root mt_club < migrations/001_baseline.sql 2>/dev/null
R mt_club -e "CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(64) NOT NULL PRIMARY KEY, filename VARCHAR(255) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;
             INSERT INTO schema_migrations (version, filename) VALUES ('001','001_baseline.sql');
             INSERT INTO clubs (code, name) VALUES ('PABB','Le Petit Au Bout Belfortain');
             INSERT INTO players (name, firstname) VALUES ('DUPONT','Jean'),('MARTIN','Paul');
             INSERT INTO tournaments (code, name) VALUES ('C-4T2026','Challenge 4T 2026');"
AV_P=$(R mt_club -e 'SELECT COUNT(*) FROM players')
DB_NAME=mt_club ./migrate.sh --as-root >"$WORK/club.log" 2>&1 \
    || { echo "  migrate.sh a échoué :"; tail -5 "$WORK/club.log"; FAIL=$((FAIL+1)); }
check "montée à $NB_MIG migrations" \
    "$(R mt_club -e 'SELECT COUNT(*) FROM schema_migrations')" "$NB_MIG"
check "le club est conservé" \
    "$(R mt_club -e "SELECT name FROM clubs WHERE code='PABB'")" 'Le Petit Au Bout Belfortain'
check "les joueurs sont conservés ($AV_P + 3 relais)" \
    "$(R mt_club -e 'SELECT COUNT(*) FROM players')" "$((AV_P + 3))"
check "DUPONT toujours là" \
    "$(R mt_club -e "SELECT COUNT(*) FROM players WHERE name='DUPONT'")" 1
check "le challenge est conservé" \
    "$(R mt_club -e "SELECT COUNT(*) FROM tournaments WHERE code='C-4T2026'")" 1
# La requête réelle du back : son échec vide la liste des joueurs.
check "SELECT du back exploitable (p.club_member, p.is_relais)" \
    "$(R mt_club -e 'SELECT COUNT(*) FROM players p WHERE p.is_relais = FALSE AND p.club_member = 0')" "$AV_P"

# ---------------------------------------------------------------- 4. échec
step "4. Migration en échec : pas enregistrée, donc retentée"
cp -r migrate.sh migrations "$WORK/"
BAD=$(printf '%03d' $((NB_MIG + 1)))
echo 'SELECT * FROM table_qui_nexiste_pas;' > "$WORK/migrations/${BAD}_cassee.sql"
DB_NAME=mt_fresh "$WORK/migrate.sh" --as-root >"$WORK/bad.log" 2>&1
check "la migration cassée n'est pas enregistrée" \
    "$(R mt_fresh -e "SELECT COUNT(*) FROM schema_migrations WHERE version='$BAD'")" 0
echo 'ALTER TABLE players ADD COLUMN IF NOT EXISTS mt_col INT NULL;' > "$WORK/migrations/${BAD}_cassee.sql"
DB_NAME=mt_fresh "$WORK/migrate.sh" --as-root >"$WORK/fixed.log" 2>&1
check "elle est appliquée une fois corrigée" \
    "$(R mt_fresh -e "SELECT COUNT(*) FROM schema_migrations WHERE version='$BAD'")" 1

step "Résultat"
printf '  %d vérification(s) OK, %d échec(s)\n\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
