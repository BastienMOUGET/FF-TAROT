# =====================================================
# FF-TAROT — Installeur Windows clé en main (PowerShell)
# =====================================================
#
# Installe automatiquement :
#   - Node.js LTS (via winget) si absent
#   - MariaDB serveur (via winget) si absent
#   - Crée la base `fft` + un utilisateur dédié avec mot de passe aléatoire
#   - Construit le front Angular et installe les dépendances back
#   - Crée start.bat / stop.bat à la racine
#   - Crée un raccourci "FF-TAROT" sur le Bureau qui démarre + ouvre le navigateur
#
# Usage (clic droit -> Exécuter avec PowerShell, OU dans une console admin) :
#   PS> .\install.ps1
#
# Si la politique d'exécution refuse, lancer une fois en admin :
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# Prérequis : Windows 10/11 + winget (déjà inclus sur W10 1809+ via App Installer).

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step([string]$msg) { Write-Host "[FFT] $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg){ Write-Host "[!!]  $msg" -ForegroundColor Yellow }
function Write-Err2([string]$msg) { Write-Host "[KO]  $msg" -ForegroundColor Red }

function Require-Admin {
    $cur = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $cur.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Err2 "Cet installeur doit être lancé en administrateur (winget service)."
        Write-Host  "Ouvrir PowerShell en admin (clic droit -> Exécuter en tant qu'administrateur) puis relancer .\install.ps1"
        exit 1
    }
}

function New-RandomPassword([int]$len = 24) {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.ToCharArray()
    $rnd   = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $len
    $rnd.GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Refresh-Env {
    # Recharge le PATH après installation winget (sinon node/mysql introuvables)
    $machine = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $user    = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH = "$machine;$user"
}

function Wait-Service([string]$name, [int]$timeoutSec = 60) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') { return $true }
        Start-Sleep -Seconds 2
        try { Start-Service -Name $name -ErrorAction SilentlyContinue } catch {}
    }
    return $false
}

# ----------------------------------------------------------
Require-Admin

$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Step "Installation dans : $InstallDir"

# ---------------------------- winget ----------------------------

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err2 "winget introuvable. Installer d'abord 'App Installer' depuis le Microsoft Store."
    Write-Host "Lien : https://apps.microsoft.com/store/detail/app-installer/9NBLGGH4NNS1"
    exit 1
}

# ---------------------------- Install Node.js LTS ----------------------------

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Step "Installation Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS --silent `
        --accept-package-agreements --accept-source-agreements
    Refresh-Env
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err2 "Node introuvable après install. Réessayer après reboot."
        exit 1
    }
} else {
    $cur = (& node -v).TrimStart('v').Split('.')[0]
    if ([int]$cur -lt 20) {
        Write-Warn2 "Node $cur trop ancien (>= 20 requis). Upgrade via winget..."
        winget upgrade --id OpenJS.NodeJS.LTS --silent `
            --accept-package-agreements --accept-source-agreements
        Refresh-Env
    }
}
Write-Ok "Node $(node -v) OK"

# ---------------------------- Install MariaDB ----------------------------

if (-not (Get-Service -Name 'MariaDB' -ErrorAction SilentlyContinue)) {
    Write-Step "Installation MariaDB serveur via winget..."
    winget install --id MariaDB.Server --silent `
        --accept-package-agreements --accept-source-agreements
    Refresh-Env
}
if (-not (Wait-Service -name 'MariaDB' -timeoutSec 90)) {
    Write-Err2 "Le service MariaDB ne démarre pas. Vérifier l'install manuellement."
    exit 1
}
Write-Ok "Service MariaDB en cours"

# Localiser le client mysql.exe
$MysqlBin = (Get-Command mysql -ErrorAction SilentlyContinue)?.Source
if (-not $MysqlBin) {
    $candidate = Get-ChildItem 'C:\Program Files\MariaDB*\bin\mysql.exe' -ErrorAction SilentlyContinue |
                 Select-Object -First 1
    if ($candidate) { $MysqlBin = $candidate.FullName }
}
if (-not $MysqlBin) {
    Write-Err2 "mysql.exe introuvable. Vérifier l'install MariaDB."
    exit 1
}
Write-Ok "Client mysql : $MysqlBin"

# ---------------------------- Configuration DB ----------------------------

$DB_NAME = 'fft'
$DB_USER = 'fft_user'
$EnvFile = Join-Path $InstallDir '.env'

if (Test-Path $EnvFile) {
    $existing = Get-Content $EnvFile
    $DB_PASSWORD = ($existing | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=', ''
    $JWT_SECRET  = ($existing | Where-Object { $_ -match '^JWT_SECRET=' })  -replace '^JWT_SECRET=', ''
}
if (-not $DB_PASSWORD) { $DB_PASSWORD = New-RandomPassword -len 24 }
if (-not $JWT_SECRET)  { $JWT_SECRET  = (New-RandomPassword -len 24) + (New-RandomPassword -len 24) }

Write-Step "Création de la base $DB_NAME et de l'utilisateur $DB_USER..."

# MariaDB sur Windows : par défaut, root@localhost utilise auth Windows
# (unix_socket n'est pas dispo, c'est l'auth nommée). On essaie sans password.
$sqlInit = @"
CREATE DATABASE IF NOT EXISTS ``$DB_NAME`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON ``$DB_NAME``.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
"@

$sqlInit | & $MysqlBin --user=root
if ($LASTEXITCODE -ne 0) {
    Write-Err2 "Échec connexion mysql -u root sans password."
    Write-Host  "Si root MariaDB a un mot de passe, exporte-le dans la session puis relance :"
    Write-Host  '   $env:MYSQL_PWD = "ton_pwd_root"'
    exit 1
}
Write-Ok "Base $DB_NAME prête"

Write-Step "Application du schéma db.sql + seed.sql..."
Get-Content (Join-Path $InstallDir 'db.sql')   | & $MysqlBin --user=root
Get-Content (Join-Path $InstallDir 'seed.sql') | & $MysqlBin --user=root $DB_NAME
Write-Ok "Schéma + seed appliqués"

# ---------------------------- .env ----------------------------

@"
PORT=3000

DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=12h
"@ | Out-File -FilePath $EnvFile -Encoding ASCII -Force
Write-Ok ".env généré"

# ---------------------------- npm install + build ----------------------------

Write-Step "Installation dépendances back (npm install)..."
Push-Location $InstallDir
& npm install --no-fund --no-audit
Pop-Location

Write-Step "Installation dépendances front + build (peut prendre 1-2 min)..."
Push-Location (Join-Path $InstallDir 'frontend')
& npm install --no-fund --no-audit
& npm run build
Pop-Location
Write-Ok "Front buildé dans frontend\dist\frontend\browser"

# ---------------------------- Scripts start/stop ----------------------------

$StartBat = Join-Path $InstallDir 'start.bat'
$StopBat  = Join-Path $InstallDir 'stop.bat'

@'
@echo off
REM Lance FF-TAROT en arrière-plan, log dans logs\server.log
cd /d "%~dp0"
if not exist logs mkdir logs

REM Si déjà lancé, juste ouvrir le navigateur
for /f %%I in ('powershell -nop -c "Try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:3000/api).StatusCode } Catch { 0 }"') do set RUNNING=%%I
if "%RUNNING%"=="200" (
  echo [FFT] deja demarre. Ouverture du navigateur...
  start http://localhost:3000
  exit /b
)

start /b "" cmd /c "node src/server.js > logs\server.log 2>&1"
echo [FFT] Demarrage en cours...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo [FFT] OK. http://localhost:3000  (admin / admin123)
'@ | Out-File -FilePath $StartBat -Encoding ASCII -Force

@'
@echo off
REM Stoppe les processus node servant src\server.js
for /f "tokens=2" %%P in ('tasklist /fi "imagename eq node.exe" /fo table /nh ^| findstr /v "INFO"') do (
  taskkill /pid %%P /f >nul 2>&1
)
echo [FFT] Arret demande
'@ | Out-File -FilePath $StopBat -Encoding ASCII -Force

Write-Ok "Scripts start.bat / stop.bat créés"

# ---------------------------- Raccourci Bureau ----------------------------

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Desktop  = [Environment]::GetFolderPath('Desktop')
    $Lnk      = $WshShell.CreateShortcut((Join-Path $Desktop 'FF-TAROT.lnk'))
    $Lnk.TargetPath        = $StartBat
    $Lnk.WorkingDirectory  = $InstallDir
    $Lnk.WindowStyle       = 7  # minimisé
    $Lnk.Description       = 'Démarrer FF-TAROT et ouvrir l\''interface'
    $IconPath = Join-Path $InstallDir 'frontend\public\favicon.ico'
    if (Test-Path $IconPath) { $Lnk.IconLocation = $IconPath }
    $Lnk.Save()
    Write-Ok "Raccourci 'FF-TAROT' créé sur le Bureau"
} catch {
    Write-Warn2 "Impossible de créer le raccourci Bureau : $_"
}

# ---------------------------- Récap ----------------------------

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host '  FF-TAROT installé avec succès' -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  URL          : http://localhost:3000'
Write-Host '  Identifiant  : admin'
Write-Host '  Mot de passe : admin123  (à changer immédiatement via /admin)' -ForegroundColor Yellow
Write-Host ''
Write-Host "  Démarrer  : double-clic sur 'FF-TAROT' (Bureau) ou .\start.bat"
Write-Host '  Arrêter   : .\stop.bat'
Write-Host '  Logs      : Get-Content logs\server.log -Wait'
Write-Host ''

# Démarrage immédiat
Write-Step 'Démarrage du serveur...'
Start-Process -FilePath $StartBat -WorkingDirectory $InstallDir
Write-Ok 'Serveur lancé. Le navigateur va s''ouvrir sur http://localhost:3000'
