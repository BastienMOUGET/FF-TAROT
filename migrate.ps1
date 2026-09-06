#
# PABB90 - Migrateur de base de donnees (Windows)
#
# Equivalent PowerShell de migrate.sh : applique dans l'ordre les fichiers
# migrations\NNN_*.sql absents de la table `schema_migrations`.
#
#   - Base vierge  -> toutes les migrations sont jouees (= installation).
#   - Base a jour  -> rien n'est fait.
#   - Base d'une version anterieure -> seules les migrations manquantes sont
#     jouees, les donnees existantes sont conservees.
#
# Usage :
#   .\migrate.ps1                # connexion lue dans .env
#   .\migrate.ps1 -AsRoot        # connexion root MariaDB (installation)
#   .\migrate.ps1 -Status        # etat des migrations, sans rien appliquer
#   .\migrate.ps1 -AsRoot -Seed  # + jeu de demo, SI la base etait vierge
#
param(
    [switch]$AsRoot,
    [switch]$Seed,
    [switch]$Status,
    [string]$MysqlBin
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host "[DB] $m" -ForegroundColor Cyan }
function Write-Ok2  { param($m) Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Warn2{ param($m) Write-Host "[!!] $m" -ForegroundColor Yellow }
function Die        { param($m) Write-Host "[KO] $m" -ForegroundColor Red; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MigDir    = Join-Path $ScriptDir 'migrations'

# ---------------------------- Connexion ----------------------------

# .env fournit les defauts ; l'environnement du shell reste prioritaire.
$EnvFile = Join-Path $ScriptDir '.env'
$cfg = @{ DB_HOST = 'localhost'; DB_PORT = '3306'; DB_USER = 'fft_user'; DB_PASSWORD = ''; DB_NAME = 'fft' }
if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=(.*)$') {
            $cfg[$Matches[1]] = $Matches[2]
        }
    }
}
foreach ($k in @($cfg.Keys)) {
    $fromEnv = [Environment]::GetEnvironmentVariable($k)
    if ($fromEnv) { $cfg[$k] = $fromEnv }
}
$DbName = $cfg.DB_NAME

if (-not $MysqlBin) {
    $MysqlBin = (Get-Command mysql.exe -ErrorAction SilentlyContinue).Source
    if (-not $MysqlBin) { $MysqlBin = (Get-Command mariadb.exe -ErrorAction SilentlyContinue).Source }
    if (-not $MysqlBin) {
        # Installation MariaDB standard : C:\Program Files\MariaDB XX.Y\bin
        $MysqlBin = Get-ChildItem 'C:\Program Files\MariaDB*\bin\mysql.exe' -ErrorAction SilentlyContinue |
                    Select-Object -First 1 -ExpandProperty FullName
    }
}
if (-not $MysqlBin) { Die "Client mysql.exe/mariadb.exe introuvable." }

# En -AsRoot on ne passe pas de mot de passe : root@localhost utilise l'auth
# nommee Windows ; MYSQL_PWD reste honore par le client s'il est pose.
if ($AsRoot) {
    $Conn = @('--user=root')
} else {
    $Conn = @("--host=$($cfg.DB_HOST)", "--port=$($cfg.DB_PORT)", "--user=$($cfg.DB_USER)")
    if ($cfg.DB_PASSWORD) { $Conn += "--password=$($cfg.DB_PASSWORD)" }
}

# Renvoie la premiere cellule d'un SELECT, ou $null si la requete echoue.
function Sql-Scalar {
    param([string]$Query, [switch]$NoDb)
    $args2 = $Conn + @('--batch', '--skip-column-names')
    if (-not $NoDb) { $args2 += $DbName }
    $out = & $MysqlBin @args2 -e $Query 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($out | Select-Object -First 1)
}

function Sql-Exec {
    param([string]$Query, [switch]$NoDb)
    $args2 = $Conn
    if (-not $NoDb) { $args2 = $Conn + @($DbName) }
    & $MysqlBin @args2 -e $Query
    if ($LASTEXITCODE -ne 0) { Die "Echec SQL : $Query" }
}

# Joue un fichier .sql entier (multi-statements geres par le client).
function Sql-File {
    param([string]$Path)
    $args2 = $Conn + @($DbName)
    Get-Content -Raw -Encoding UTF8 $Path | & $MysqlBin @args2
    return ($LASTEXITCODE -eq 0)
}

if ($null -eq (Sql-Scalar -Query 'SELECT 1' -NoDb)) {
    Die "Connexion MariaDB impossible ($($cfg.DB_USER)@$($cfg.DB_HOST):$($cfg.DB_PORT))."
}

# ---------------------------- Bootstrap ----------------------------

# On ne tente le CREATE DATABASE que si la base manque : l'utilisateur
# applicatif n'a de droits que sur $DbName et se verrait refuser un
# CREATE DATABASE, meme IF NOT EXISTS.
$dbExists = (Sql-Scalar -NoDb -Query "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DbName';") -eq '1'
if (-not $Status -and -not $dbExists) {
    Write-Step "Creation de la base $DbName..."
    Sql-Exec -NoDb -Query "CREATE DATABASE ``$DbName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

function Table-Exists {
    param([string]$Name)
    return (Sql-Scalar -Query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '$Name';") -eq '1'
}

# Base "vierge" = pas encore de table applicative. Sert a decider si le jeu
# de demo (-Seed) peut etre pose : jamais sur une base deja peuplee.
$Fresh = -not (Table-Exists 'players')

if (-not $Status) {
    Sql-Exec -Query @"
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(64)  NOT NULL PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL,
  applied_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
"@
} elseif (-not (Table-Exists 'schema_migrations')) {
    Write-Warn2 "Base non migree (pas de table schema_migrations)."
}

function Is-Applied {
    param([string]$Version)
    $n = Sql-Scalar -Query "SELECT COUNT(*) FROM schema_migrations WHERE version = '$Version';"
    return ($n -and $n -ne '0')
}

# ---------------------------- Application ----------------------------

$files = Get-ChildItem -Path $MigDir -Filter '*.sql' -ErrorAction SilentlyContinue |
         Where-Object { $_.Name -match '^[0-9]' } | Sort-Object Name
if (-not $files) { Die "Aucune migration trouvee dans $MigDir" }

$applied = 0
foreach ($f in $files) {
    $version = ($f.Name -split '_')[0]

    if (Is-Applied $version) {
        if ($Status) { Write-Host ("  {0,-4} {1,-45} deja appliquee" -f $version, $f.Name) }
        continue
    }
    if ($Status) {
        Write-Host ("  {0,-4} {1,-45} EN ATTENTE" -f $version, $f.Name) -ForegroundColor Yellow
        continue
    }

    Write-Step "Application de $($f.Name)..."
    if (-not (Sql-File $f.FullName)) {
        Die "Echec de la migration $($f.Name) - base laissee en l'etat, rien n'a ete enregistre."
    }
    Sql-Exec -Query "INSERT INTO schema_migrations (version, filename) VALUES ('$version', '$($f.Name)');"
    $applied++
}

if ($Status) { exit 0 }

if ($applied -eq 0) { Write-Ok2 "Base $DbName deja a jour (aucune migration a appliquer)" }
else                { Write-Ok2 "$applied migration(s) appliquee(s) sur $DbName" }

# ---------------------------- Seed (demo) ----------------------------

if ($Seed) {
    if ($Fresh) {
        Write-Step "Base vierge : chargement du jeu de demo (seed.sql)..."
        if (-not (Sql-File (Join-Path $ScriptDir 'seed.sql'))) { Die "Echec du chargement de seed.sql" }
        Write-Ok2 "Jeu de demo charge (club + tournoi de test)"
    } else {
        Write-Warn2 "-Seed ignore : la base contient deja des donnees (le seed les ecraserait)."
    }
}
