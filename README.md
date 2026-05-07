# FF-TAROT

Logiciel de gestion de tournois pour la **Fédération Française de Tarot**
(mode Libre par 4). Refonte from-scratch d'un ancien outil ASP, en
**Node.js + Express + MariaDB** côté back et **Angular 21 + Material**
côté front, avec **classement live** via Socket.IO.

## Installation

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![Release](../../actions/workflows/release.yml/badge.svg)](../../actions/workflows/release.yml)

Voir **[INSTALL.md](INSTALL.md)** — 3 méthodes au choix :

- **Windows** : télécharge `ff-tarot-X.Y.Z-windows.zip` depuis la
  [page Releases](../../releases), dézippe, et lance `.\install.ps1`
  en PowerShell admin → installe Node + MariaDB via winget, build,
  crée un raccourci sur le Bureau.
- **Linux** : télécharge `ff-tarot-X.Y.Z-linux.tar.gz` depuis la
  [page Releases](../../releases), décompresse, lance `sudo ./install.sh`
  → apt/dnf, systemd unit pour démarrage auto.
- **Docker** : `docker compose up -d` (clone du repo) ou
  `docker pull ghcr.io/<owner>/<repo>:latest`.

URL : http://localhost:3000 — identifiants par défaut `admin` / `admin123`
(à changer immédiatement).

## Roadmap & versions

Voir **[ROADMAP.md](ROADMAP.md)** pour le détail des phases V1 (back),
V2 (front), V3 (autres disciplines).

## Stack

- **Back** : Node.js 20 + Express 5 + MariaDB + Socket.IO + JWT
- **Front** : Angular 21 (standalone components, signals, zoneless)
  + Angular Material (azure-blue theme)
- **DB** : 22 tables, schéma normalisé pour Libre par 4 (équipes NS+EO,
  rounds, mouvements, scores par donne, classement, pénalités, PCN, PP,
  donnes pré-tirées 78 cartes, utilisateurs)

## Workflow couvert (V2.0)

1. Login → tournois → création tournoi
2. Sous-tournois (parallèles) → inscription équipes (4 joueurs NS+EO)
3. Rounds : génération automatique de la mise en place (mouvement FFT)
4. Saisie scores donne par donne (preneur + 4 scores)
5. Validation table par table → **classement live diffusé via Socket.IO**
6. Pénalités, grille PP, feuille de route imprimable, export PCN au
   format CSV FFT
