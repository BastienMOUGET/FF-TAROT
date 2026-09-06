# =====================================================
# PABB90 — Installeur Windows clé en main (PowerShell)
# =====================================================
#
# Installe automatiquement :
#   - Node.js LTS (via winget) si absent
#   - MariaDB serveur (via winget) si absent
#   - Crée la base `fft` + un utilisateur dédié avec mot de passe aléatoire
#   - Construit le front Angular si pas déjà pré-buildé
#   - Crée start.bat / stop.bat à la racine
#   - Crée un raccourci "PABB90" sur le Bureau (sauf si -NoShortcut)
#   - Lance le serveur et ouvre le navigateur (sauf si -NoStart)
#
# Usage (clic droit -> Exécuter avec PowerShell, OU dans une console admin) :
#   PS> .\install.ps1
#
# Paramètres :
#   -NoShortcut   Pas de raccourci Bureau (utilisé par Inno Setup qui crée
#                 ses propres raccourcis via [Icons]).
#   -NoStart      Ne pas lancer le serveur ni ouvrir le navigateur à la fin
#                 (utilisé par Inno Setup qui gère sa propre étape postinstall).
#   -WithDemo     Charge le jeu de démo (club/tournoi de test), uniquement si
#                 la base est vierge.
#
# Réinstallation : le schéma passe par migrate.ps1, qui n'applique que les
# migrations manquantes. Les données déjà en base sont conservées.
#
# Si la politique d'exécution refuse, lancer une fois en admin :
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#
# Prérequis : Windows 10/11 + winget (déjà inclus sur W10 1809+ via App Installer).

param(
    [switch]$NoShortcut,
    [switch]$NoStart,
    [switch]$WithDemo
)

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

# Migrations : installe le schéma sur une base vierge, applique seulement
# les migrations manquantes sur une base existante. Réinstaller par-dessus
# une base qui contient les données du club ne les efface donc plus.
Write-Step "Migration du schéma..."
$MigrateArgs = @('-AsRoot', '-MysqlBin', $MysqlBin)
if ($WithDemo) { $MigrateArgs += '-Seed' }
$env:DB_NAME = $DB_NAME
& (Join-Path $InstallDir 'migrate.ps1') @MigrateArgs
if ($LASTEXITCODE -ne 0) { Write-Err2 "Échec de la migration de la base."; exit 1 }

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

# Back = binaire Amalgame (server.exe), livré dans le package release ou buildé
# via build.sh (toolchain amc + libmariadb). Plus de npm install côté back.
$ServerExe = Join-Path $InstallDir 'server.exe'
if (-not (Test-Path $ServerExe)) {
    Write-Err2 "server.exe introuvable dans $InstallDir (build AM requis : voir build.sh)."
    exit 1
}
Write-Ok "Binaire back server.exe présent"

$FrontIndex = Join-Path $InstallDir 'frontend\dist\frontend\browser\index.html'
if (Test-Path $FrontIndex) {
    Write-Ok "Front déjà pré-buildé (release package), skip de l'install/build front"
} else {
    Write-Step "Installation dépendances front + build (peut prendre 1-2 min)..."
    Push-Location (Join-Path $InstallDir 'frontend')
    & npm install --no-fund --no-audit
    & npm run build
    Pop-Location
    Write-Ok "Front buildé dans frontend\dist\frontend\browser"
}

# ---------------------------- Service Windows natif (sans NSSM) ----------------------------
# server.exe embarque le dispatcher SCM (amalgame-service) -> sc.exe suffit,
# plus besoin de NSSM. Config via la cle registre Environment du service
# (un service tourne avec CWD=system32 : on passe DB_*/JWT/FRONT_DIR par le
# registre, lus cote binaire par Config.Get qui priorise l'env process).

$ServiceName = 'PABB90'

& sc.exe stop $ServiceName 2>$null | Out-Null
& sc.exe delete $ServiceName 2>$null | Out-Null
Start-Sleep -Seconds 1

Write-Step "Creation du service Windows natif '$ServiceName'..."
& sc.exe create $ServiceName binPath= "`"$ServerExe`"" start= auto DisplayName= "PABB90" | Out-Null
& sc.exe description $ServiceName "PABB90 - Gestion de tournois FFT (Libre par 4)" | Out-Null
& sc.exe failure $ServiceName reset= 60 actions= restart/5000/restart/5000/restart/15000 | Out-Null

$FrontDir = Join-Path $InstallDir 'frontend\dist\frontend\browser'
$envMulti = @(
    "PORT=3000", "SOCKET_PORT=3001",
    "DB_HOST=localhost", "DB_USER=fft_user", "DB_PASSWORD=$DB_PASSWORD",
    "DB_NAME=fft", "JWT_SECRET=$JWT_SECRET", "FRONT_DIR=$FrontDir"
)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName" `
    -Name 'Environment' -Value $envMulti -PropertyType MultiString -Force | Out-Null

Write-Step "Demarrage du service..."
& sc.exe start $ServiceName | Out-Null
Start-Sleep -Seconds 2
Write-Ok "Service natif '$ServiceName' installe et demarre (auto-start au boot)"

# ---------------------------- Scripts start/stop pilotant le service ----------------------------

$StartBat = Join-Path $InstallDir 'start.bat'
$StopBat  = Join-Path $InstallDir 'stop.bat'

@'
@echo off
REM Démarre le service PABB90 puis ouvre le navigateur
sc query "PABB90" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    net start "PABB90" >nul 2>&1
    timeout /t 1 /nobreak >nul
    start http://localhost:3000
    echo [FFT] Service demarre. http://localhost:3000  (admin / admin123)
) else (
    echo [FFT] Service introuvable, demarrage en mode standalone...
    cd /d "%~dp0"
    if not exist logs mkdir logs
    start /b "" "%~dp0server.exe" > logs\server.log 2>&1
    timeout /t 3 /nobreak >nul
    start http://localhost:3000
)
'@ | Out-File -FilePath $StartBat -Encoding ASCII -Force

@'
@echo off
REM Arrête le service PABB90 (ou les processus standalone en fallback)
sc query "PABB90" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    net stop "PABB90" >nul 2>&1
    echo [FFT] Service arrete
) else (
    for /f "tokens=2" %%P in ('tasklist /fi "imagename eq node.exe" /fo table /nh ^| findstr /v "INFO"') do (
        taskkill /pid %%P /f >nul 2>&1
    )
    echo [FFT] Processus standalone arretes
)
'@ | Out-File -FilePath $StopBat -Encoding ASCII -Force

Write-Ok "Scripts start.bat / stop.bat créés (pilotent le service)"

# ---------------------------- Raccourci Bureau ----------------------------

if (-not $NoShortcut) {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Desktop  = [Environment]::GetFolderPath('Desktop')
        $Lnk      = $WshShell.CreateShortcut((Join-Path $Desktop 'PABB90.lnk'))
        $Lnk.TargetPath        = $StartBat
        $Lnk.WorkingDirectory  = $InstallDir
        $Lnk.WindowStyle       = 7  # minimisé
        $Lnk.Description       = 'Démarrer PABB90 et ouvrir l''interface'
        $IconPath = Join-Path $InstallDir 'frontend\public\favicon.ico'
        if (Test-Path $IconPath) { $Lnk.IconLocation = $IconPath }
        $Lnk.Save()
        Write-Ok "Raccourci 'PABB90' créé sur le Bureau"
    } catch {
        Write-Warn2 "Impossible de créer le raccourci Bureau : $_"
    }
} else {
    Write-Step "Raccourci Bureau ignoré (-NoShortcut, géré par l'installeur appelant)"
}

# ---------------------------- Récap ----------------------------

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host '  PABB90 installé avec succès' -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  URL          : http://localhost:3000'
Write-Host '  Identifiant  : admin'
Write-Host '  Mot de passe : admin123  (à changer immédiatement via /admin)' -ForegroundColor Yellow
Write-Host ''
Write-Host "  Démarrer  : double-clic sur 'PABB90' (Bureau) ou .\start.bat"
Write-Host '  Arrêter   : .\stop.bat'
Write-Host '  Logs      : Get-Content logs\server.log -Wait'
Write-Host ''

# Démarrage immédiat (sauf si -NoStart, auquel cas l'appelant gère)
if (-not $NoStart) {
    Write-Step 'Démarrage du serveur...'
    Start-Process -FilePath $StartBat -WorkingDirectory $InstallDir
    Write-Ok 'Serveur lancé. Le navigateur va s''ouvrir sur http://localhost:3000'
} else {
    Write-Step "Lancement automatique ignoré (-NoStart, géré par l'installeur appelant)"
}
