#!/bin/bash

set -e

echo "=== INSTALL FFT TAROT API ==="

DB_NAME="fft"
DB_USER="fft_user"
DB_PASSWORD="fft_password"

# -----------------------------
# UPDATE
# -----------------------------
sudo apt update -y

# -----------------------------
# NODE
# -----------------------------
if ! command -v node >/dev/null 2>&1; then
  echo ">>> Install Node"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# -----------------------------
# MARIADB
# -----------------------------
if ! command -v mariadb >/dev/null 2>&1; then
  echo ">>> Install MariaDB"
  sudo apt install -y mariadb-server
fi

sudo systemctl start mariadb
sudo systemctl enable mariadb

# -----------------------------
# DB USER + RIGHTS
# -----------------------------
echo ">>> Config DB user"

sudo mariadb <<EOF
CREATE DATABASE IF NOT EXISTS $DB_NAME;

CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';

GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';

FLUSH PRIVILEGES;
EOF

# -----------------------------
# APPLY SCHEMA
# -----------------------------
echo ">>> Import db.sql"

sudo mariadb $DB_NAME < db.sql

# -----------------------------
# ENV
# -----------------------------
echo ">>> Create .env"

cat > .env <<EOF
PORT=3000

DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
EOF

# -----------------------------
# NPM
# -----------------------------
npm install

echo ""
echo "=== DONE ==="
echo "node src/server.js"