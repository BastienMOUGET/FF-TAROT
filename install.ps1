$ErrorActionPreference = "Stop"

Write-Host "=== INSTALL FFT TAROT API (Windows) ==="

# -----------------------------
# CONFIG
# -----------------------------
$DB_NAME = "fft"
$DB_USER = "fft_user"
$DB_PASSWORD = "fft_password"

# -----------------------------
# CHECK NODE
# -----------------------------
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js non installé"
    Write-Host "Installe Node.js : https://nodejs.org/"
    exit
}

# -----------------------------
# CHECK MYSQL/MARIADB
# -----------------------------
if (!(Get-Command mysql -ErrorAction SilentlyContinue)) {
    Write-Host "MariaDB/MySQL client non trouvé"
    Write-Host "Installe MariaDB : https://mariadb.org/download/"
    exit
}

# -----------------------------
# CREATE DB + USER
# -----------------------------
Write-Host "Configuration MariaDB"

mysql -u root -p -e "
CREATE DATABASE IF NOT EXISTS $DB_NAME;

CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';

GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';

FLUSH PRIVILEGES;
"

# -----------------------------
# IMPORT DB
# -----------------------------
Write-Host "Import db.sql"

mysql -u root -p $DB_NAME < db.sql

# -----------------------------
# CREATE ENV
# -----------------------------
Write-Host "Création .env"

@"
PORT=3000

DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
"@ | Out-File -Encoding UTF8 .env

# -----------------------------
# INSTALL NPM
# -----------------------------
Write-Host "npm install"

npm install

Write-Host ""
Write-Host "=== INSTALL TERMINEE ==="
Write-Host ""
Write-Host "Lancer :"
Write-Host "node src/server.js"