#!/usr/bin/env bash
#
# FF-TAROT — Installeur Linux clé en main
#
# Installe automatiquement :
#   - Node.js 20+ (si absent)
#   - MariaDB serveur + client (si absents)
#   - Crée la base `fft` + un utilisateur dédié avec mot de passe aléatoire
#   - Construit le front Angular et installe les dépendances back
#   - Crée les scripts start.sh / stop.sh
#   - Optionnel : installe une unité systemd pour démarrage auto
#
# Usage :
#   sudo ./install.sh                # install complet (apt/dnf, DB, build)
#   sudo ./install.sh --no-systemd   # idem mais sans service systemd
#
# Distribs supportées : Debian/Ubuntu (apt), Fedora/RHEL (dnf).

set -euo pipefail

# ---------------------------- Helpers ----------------------------

log()  { printf '\033[1;34m[FFT]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[OK]\033[0m  %s\n' "$*"; }
warn() { printf '\033[1;33m[!!]\033[0m  %s\n' "$*"; }
err()  { printf '\033[1;31m[KO]\033[0m  %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    die "Doit être exécuté en root (sudo)."
  fi
}

detect_pkg_mgr() {
  if command -v apt-get >/dev/null 2>&1; then echo apt
  elif command -v dnf >/dev/null 2>&1; then echo dnf
  elif command -v yum >/dev/null 2>&1; then echo yum
  else die "Pas d'apt/dnf/yum. Distrib non supportée par ce script."
  fi
}

random_password() {
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24
}

# ---------------------------- Args ----------------------------

INSTALL_SYSTEMD=1
for arg in "$@"; do
  case "$arg" in
    --no-systemd) INSTALL_SYSTEMD=0 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) die "Argument inconnu : $arg" ;;
  esac
done

# ---------------------------- Préchecks ----------------------------

require_root
PKG=$(detect_pkg_mgr)

APP_USER="${SUDO_USER:-$USER}"
INSTALL_DIR=$(cd "$(dirname "$0")" && pwd)
log "Installation dans : $INSTALL_DIR"
log "Utilisateur cible : $APP_USER"

# ---------------------------- Install Node.js ----------------------------

NODE_MAJOR=20
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  CUR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$CUR" -ge "$NODE_MAJOR" ]]; then
    ok "Node déjà présent : $(node -v)"
    NEED_NODE=0
  else
    warn "Node trop vieux ($CUR), upgrade vers $NODE_MAJOR..."
  fi
fi

if [[ "$NEED_NODE" -eq 1 ]]; then
  log "Installation Node.js $NODE_MAJOR via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  case "$PKG" in
    apt) apt-get install -y nodejs ;;
    dnf|yum) $PKG install -y nodejs ;;
  esac
  ok "Node $(node -v) installé"
fi

# ---------------------------- Install MariaDB ----------------------------

if ! command -v mariadb >/dev/null 2>&1 && ! command -v mysql >/dev/null 2>&1; then
  log "Installation MariaDB serveur + client..."
  case "$PKG" in
    apt)
      DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client
      ;;
    dnf|yum)
      $PKG install -y mariadb-server mariadb
      ;;
  esac
fi

if ! systemctl is-active --quiet mariadb 2>/dev/null && \
   ! systemctl is-active --quiet mysql 2>/dev/null; then
  log "Démarrage du service MariaDB..."
  systemctl enable --now mariadb 2>/dev/null || systemctl enable --now mysql
fi
ok "MariaDB en service"

MYSQL_BIN=$(command -v mariadb || command -v mysql)
[[ -z "$MYSQL_BIN" ]] && die "Client mysql/mariadb introuvable après install."

# ---------------------------- Configuration DB ----------------------------

DB_NAME="fft"
DB_USER="fft_user"

if [[ -f "$INSTALL_DIR/.env" ]] && grep -q '^DB_PASSWORD=' "$INSTALL_DIR/.env"; then
  DB_PASSWORD=$(grep '^DB_PASSWORD=' "$INSTALL_DIR/.env" | cut -d= -f2-)
  log "Mot de passe DB existant récupéré depuis .env"
else
  DB_PASSWORD=$(random_password)
  log "Génération d'un mot de passe DB aléatoire"
fi

if [[ -f "$INSTALL_DIR/.env" ]] && grep -q '^JWT_SECRET=' "$INSTALL_DIR/.env"; then
  JWT_SECRET=$(grep '^JWT_SECRET=' "$INSTALL_DIR/.env" | cut -d= -f2-)
else
  JWT_SECRET=$(random_password)$(random_password)
fi

log "Création de la base $DB_NAME et de l'utilisateur $DB_USER..."
"$MYSQL_BIN" --user=root <<EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF
ok "Base $DB_NAME prête"

log "Application du schéma db.sql + seed.sql..."
"$MYSQL_BIN" --user=root < "$INSTALL_DIR/db.sql"
"$MYSQL_BIN" --user=root "$DB_NAME" < "$INSTALL_DIR/seed.sql"
ok "Schéma + seed appliqués"

# ---------------------------- .env ----------------------------

cat > "$INSTALL_DIR/.env" <<EOF
PORT=3000

DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=12h
EOF
chmod 640 "$INSTALL_DIR/.env"
chown "$APP_USER":"$APP_USER" "$INSTALL_DIR/.env"
ok ".env généré (permissions 640)"

# ---------------------------- back AM + build front ----------------------------

# Le back est un binaire Amalgame (server). Soit il est livré dans le package
# (release), soit on le build via build.sh (nécessite la toolchain amc +
# libmariadb-dev). Plus de npm install côté back.
if [[ -x "$INSTALL_DIR/server" ]]; then
  ok "Binaire back 'server' présent (release package)"
elif command -v amc >/dev/null 2>&1; then
  log "Build du back Amalgame (amc)..."
  sudo -u "$APP_USER" -H bash -c "cd '$INSTALL_DIR' && ./build.sh"
  ok "Back AM buildé ($INSTALL_DIR/server)"
else
  err "Binaire 'server' absent et amc introuvable. Lancez ./build.sh sur une"
  err "machine avec la toolchain amc + libmariadb-dev, ou utilisez le package release."
  exit 1
fi

FRONT_INDEX="$INSTALL_DIR/frontend/dist/frontend/browser/index.html"
if [[ -f "$FRONT_INDEX" ]]; then
  ok "Front déjà pré-buildé (release package), skip de l'install/build front"
else
  log "Installation des dépendances front + build (peut prendre 1-2 min)..."
  sudo -u "$APP_USER" -H bash -c "cd '$INSTALL_DIR/frontend' && npm install --no-fund --no-audit"
  sudo -u "$APP_USER" -H bash -c "cd '$INSTALL_DIR/frontend' && npm run build"
  ok "Front buildé dans frontend/dist/frontend/browser"
fi

# ---------------------------- Scripts start/stop ----------------------------

cat > "$INSTALL_DIR/start.sh" <<'STARTSH'
#!/usr/bin/env bash
# Lance le back AM (binaire ./server) en arrière-plan, log dans logs/server.log.
# Le binaire lit son .env du dossier courant (DB, ports, JWT).
cd "$(dirname "$(readlink -f "$0")")"
mkdir -p logs
if pgrep -x server > /dev/null; then
  echo "[FFT] déjà démarré. http://localhost:3000"
  exit 0
fi
nohup ./server > logs/server.log 2>&1 &
echo $! > logs/server.pid
sleep 0.5
echo "[FFT] démarré (pid $(cat logs/server.pid)). http://localhost:3000"
STARTSH

cat > "$INSTALL_DIR/stop.sh" <<'STOPSH'
#!/usr/bin/env bash
cd "$(dirname "$(readlink -f "$0")")"
if [[ -f logs/server.pid ]]; then
  PID=$(cat logs/server.pid)
  if kill "$PID" 2>/dev/null; then
    echo "[FFT] arrêté (pid $PID)"
  else
    echo "[FFT] pid $PID introuvable, nettoyage"
  fi
  rm -f logs/server.pid
else
  pkill -x server && echo "[FFT] arrêté" || echo "[FFT] pas en cours"
fi
STOPSH

chmod +x "$INSTALL_DIR/start.sh" "$INSTALL_DIR/stop.sh"
chown "$APP_USER":"$APP_USER" "$INSTALL_DIR/start.sh" "$INSTALL_DIR/stop.sh"
ok "Scripts start.sh / stop.sh créés"

# ---------------------------- Service systemd ----------------------------

if [[ "$INSTALL_SYSTEMD" -eq 1 ]] && command -v systemctl >/dev/null 2>&1; then
  log "Création du service systemd ff-tarot.service..."
  cat > /etc/systemd/system/ff-tarot.service <<EOF
[Unit]
Description=FF-TAROT — Gestion de tournois FFT
After=network.target mariadb.service mysql.service
Wants=mariadb.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/server
Restart=on-failure
RestartSec=5
StandardOutput=append:$INSTALL_DIR/logs/server.log
StandardError=append:$INSTALL_DIR/logs/server.log

[Install]
WantedBy=multi-user.target
EOF
  mkdir -p "$INSTALL_DIR/logs"
  chown "$APP_USER":"$APP_USER" "$INSTALL_DIR/logs"
  systemctl daemon-reload
  systemctl enable --now ff-tarot.service
  ok "Service ff-tarot.service installé et démarré (auto-start au boot)"
fi

# ---------------------------- Récap ----------------------------

cat <<EOF

\033[1;32m================================================================\033[0m
  FF-TAROT installé avec succès

  URL          : http://localhost:3000
  Identifiant  : admin
  Mot de passe : admin123  (à changer immédiatement via /admin)

  Base de données : $DB_NAME (utilisateur $DB_USER)
  Configuration   : $INSTALL_DIR/.env

  Démarrage manuel : ./start.sh
  Arrêt            : ./stop.sh
  Logs             : tail -f logs/server.log
EOF

if [[ "$INSTALL_SYSTEMD" -eq 1 ]]; then
cat <<EOF
  Service systemd  : systemctl {status,start,stop,restart} ff-tarot
EOF
fi

echo ""
echo -e "\033[1;32m================================================================\033[0m"
echo ""
