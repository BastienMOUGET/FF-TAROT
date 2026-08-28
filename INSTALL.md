# Installation PABB90

4 façons d'installer, choisis celle qui te convient.

> 💡 **Le plus simple sous Windows** : télécharger
> `pabb90-X.Y.Z-setup.exe` depuis la
> [page Releases GitHub](../../releases) et double-cliquer. L'installeur
> Inno Setup s'occupe de tout (Node, MariaDB, base, service Windows
> auto-start, raccourci Bureau).
>
> Toutes les méthodes installent PABB90 en **service auto-démarré au
> boot** : Windows (NSSM), Linux (systemd), Docker (`restart: unless-stopped`).

---

## 🪟 Windows — installeur .exe Inno Setup (recommandé)

**Prérequis** : Windows 10 1809+ avec winget.

1. Télécharger `pabb90-X.Y.Z-setup.exe` depuis la [page Releases](../../releases)
2. Double-clic sur le fichier
3. Suivre l'assistant : Suivant → Suivant → Installer
4. Le wizard fait tout :
   - Installe Node.js LTS via winget (si absent)
   - Installe MariaDB Server via winget (si absent)
   - Crée la base + utilisateur avec mots de passe aléatoires
   - Build le front Angular si pas déjà pré-buildé
   - Enregistre **PABB90 comme service Windows** (NSSM, auto-start au boot,
     restart automatique en cas de crash)
   - Crée des raccourcis Menu Démarrer + Bureau (pointant sur http://localhost:3000)
5. À la fin, le navigateur s'ouvre tout seul. Login : `admin` / `admin123`

### Au quotidien
- **Le service tourne en permanence en arrière-plan** : pas besoin de le démarrer
- Cliquer sur le raccourci **PABB90** ouvre directement le navigateur
- Gestion : Menu Démarrer > PABB90 > Démarrer/Arrêter le service
- Logs : `C:\PABB90\logs\server.log`
- Désinstallation : Panneau de configuration > Programmes > PABB90 > Désinstaller
  (stoppe et supprime le service automatiquement)

---

## 🪟 Windows — archive zip + PowerShell (alternative pour customisation)

**Prérequis** : Windows 10 1809+ avec winget.

```powershell
# Télécharger pabb90-X.Y.Z-windows.zip depuis la page Releases, dézipper.
# Ouvrir PowerShell EN ADMIN (clic droit -> Exécuter en admin) dans le dossier.
# Si la politique d'exécution refuse les scripts, autoriser une fois :
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

cd C:\chemin\vers\pabb90
.\install.ps1
```

L'installeur va :

1. installer Node.js LTS via `winget` (si absent)
2. installer MariaDB Server via `winget` (si absent) et démarrer le service
3. créer la base `fft` + un utilisateur `fft_user` avec un mot de passe **aléatoire**
4. générer un secret JWT aléatoire dans `.env`
5. installer les dépendances back + front et builder le bundle Angular
6. créer **`start.bat`** et **`stop.bat`** à la racine
7. créer un raccourci **"PABB90" sur le Bureau**
8. lancer le serveur et ouvrir [http://localhost:3000](http://localhost:3000)

**Identifiants par défaut** : `admin` / `admin123` (à changer immédiatement via la page Admin).

### Au quotidien

- **Démarrer** : double-clic sur le raccourci Bureau, ou `start.bat`
- **Arrêter** : `stop.bat`
- **Logs** : `Get-Content logs\server.log -Wait`
- **URL** : http://localhost:3000

### Si winget n'est pas disponible

Installer manuellement :
- Node.js LTS : https://nodejs.org/
- MariaDB Server : https://mariadb.org/download/

Puis relancer `.\install.ps1` (il détecte les présences existantes).

---

## 🐧 Linux — script bash (Debian/Ubuntu/Fedora/RHEL)

**Prérequis** : un système avec `apt-get` ou `dnf`/`yum`, et un accès root.

```bash
cd /chemin/vers/PABB90
sudo ./install.sh
```

L'installeur va :

1. installer Node.js 20 (NodeSource) si absent
2. installer MariaDB Server si absent et démarrer le service
3. créer la base `fft` + un utilisateur `fft_user` avec un mot de passe **aléatoire**
4. générer un secret JWT aléatoire dans `.env`
5. installer les dépendances back + front et builder le bundle Angular
6. créer **`start.sh`** / **`stop.sh`** à la racine
7. créer une **unité systemd `pabb90.service`** pour démarrage auto au boot
8. afficher l'URL d'accès

Pour ne pas installer le service systemd :

```bash
sudo ./install.sh --no-systemd
```

### Au quotidien

- **Service systemd** : `systemctl {status,start,stop,restart} pabb90`
- **Manuel** : `./start.sh` et `./stop.sh`
- **Logs** : `tail -f logs/server.log` (ou `journalctl -u pabb90 -f`)
- **URL** : http://localhost:3000

---

## 🐳 Docker (Linux / Mac / Windows avec Docker Desktop)

**Prérequis** : Docker + Docker Compose v2.

```bash
cd /chemin/vers/PABB90
docker compose up -d
```

C'est tout. Le `docker-compose.yml` lance :
- Un conteneur `db` (MariaDB 11) avec volume persistant
- Un conteneur `app` (Node + bundle Angular) qui :
  1. attend que la DB soit healthy
  2. au premier démarrage, applique `db.sql` + `seed.sql`
  3. sert l'API + le front sur le port 3000

URL : http://localhost:3000 (admin / admin123)

### Commandes utiles

```bash
docker compose ps                # statut
docker compose logs -f app       # suivre les logs du back
docker compose logs -f db        # suivre les logs MariaDB
docker compose down              # arrêter les conteneurs
docker compose down -v           # arrêter + effacer les données DB
docker compose build --no-cache  # rebuild de l'image (après modif code)
```

### En production

Modifier `docker-compose.yml` pour :
- Changer `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `JWT_SECRET`
- Restreindre `ports: ['127.0.0.1:3000:3000']` (pas exposé sur l'extérieur)
- Mettre derrière un reverse proxy (nginx/Caddy/Traefik) avec HTTPS

---

## Première connexion

1. Aller sur http://localhost:3000
2. Se connecter : `admin` / `admin123`
3. **Aller dans "Administration" > onglet "Utilisateurs"** et **changer le mot de passe**
4. Créer ses joueurs (onglet Joueurs), club (Clubs), etc.
5. Créer un tournoi via le menu "Tournois"

---

## Désinstallation

### Windows
```powershell
.\stop.bat
# Optionnel : désinstaller MariaDB et Node via Panneau de configuration
# Optionnel : supprimer la base
mysql -u root -e "DROP DATABASE fft; DROP USER 'fft_user'@'localhost';"
# Supprimer le raccourci Bureau et le dossier PABB90
```

### Linux
```bash
sudo systemctl disable --now pabb90
sudo rm /etc/systemd/system/pabb90.service
sudo systemctl daemon-reload
mysql -u root -e "DROP DATABASE fft; DROP USER 'fft_user'@'localhost';"
# Optionnel : sudo apt remove --purge mariadb-server nodejs
```

### Docker
```bash
docker compose down -v
docker rmi pabb90:latest
```

---

## Dépannage

### "Port 3000 déjà utilisé"
Modifier la variable `PORT` dans `.env` (ex: `PORT=3001`) puis relancer.

### "Le navigateur ne s'ouvre pas"
Aller manuellement sur http://localhost:3000

### "Erreur de connexion MariaDB"
- Vérifier que le service tourne : `systemctl status mariadb` (Linux) ou
  `Get-Service MariaDB` (Windows)
- Vérifier le mot de passe dans `.env` correspond à celui en base

### "Le front ne se charge pas (page blanche)"
- Vérifier que `frontend/dist/frontend/browser/index.html` existe
- Sinon : `cd frontend && npm run build`

### Réinitialiser la base de zéro
```bash
mysql -u root < db.sql
mysql -u root fft < seed.sql
```
