# Installation FF-TAROT

3 façons d'installer, choisis celle qui te convient.

---

## 🪟 Windows — installeur clé en main

**Prérequis** : Windows 10/11 avec winget (App Installer du Microsoft Store).

```powershell
# Ouvrir PowerShell EN ADMIN (clic droit -> Exécuter en admin)
# Si la politique d'exécution refuse les scripts, autoriser une fois :
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Aller dans le dossier où tu as cloné/dézippé FF-TAROT
cd C:\chemin\vers\FF-TAROT

# Lancer l'installeur
.\install.ps1
```

L'installeur va :

1. installer Node.js LTS via `winget` (si absent)
2. installer MariaDB Server via `winget` (si absent) et démarrer le service
3. créer la base `fft` + un utilisateur `fft_user` avec un mot de passe **aléatoire**
4. générer un secret JWT aléatoire dans `.env`
5. installer les dépendances back + front et builder le bundle Angular
6. créer **`start.bat`** et **`stop.bat`** à la racine
7. créer un raccourci **"FF-TAROT" sur le Bureau**
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
cd /chemin/vers/FF-TAROT
sudo ./install.sh
```

L'installeur va :

1. installer Node.js 20 (NodeSource) si absent
2. installer MariaDB Server si absent et démarrer le service
3. créer la base `fft` + un utilisateur `fft_user` avec un mot de passe **aléatoire**
4. générer un secret JWT aléatoire dans `.env`
5. installer les dépendances back + front et builder le bundle Angular
6. créer **`start.sh`** / **`stop.sh`** à la racine
7. créer une **unité systemd `ff-tarot.service`** pour démarrage auto au boot
8. afficher l'URL d'accès

Pour ne pas installer le service systemd :

```bash
sudo ./install.sh --no-systemd
```

### Au quotidien

- **Service systemd** : `systemctl {status,start,stop,restart} ff-tarot`
- **Manuel** : `./start.sh` et `./stop.sh`
- **Logs** : `tail -f logs/server.log` (ou `journalctl -u ff-tarot -f`)
- **URL** : http://localhost:3000

---

## 🐳 Docker (Linux / Mac / Windows avec Docker Desktop)

**Prérequis** : Docker + Docker Compose v2.

```bash
cd /chemin/vers/FF-TAROT
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
# Supprimer le raccourci Bureau et le dossier FF-TAROT
```

### Linux
```bash
sudo systemctl disable --now ff-tarot
sudo rm /etc/systemd/system/ff-tarot.service
sudo systemctl daemon-reload
mysql -u root -e "DROP DATABASE fft; DROP USER 'fft_user'@'localhost';"
# Optionnel : sudo apt remove --purge mariadb-server nodejs
```

### Docker
```bash
docker compose down -v
docker rmi ff-tarot:latest
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
