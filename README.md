# PABB90

**PABB90** (Petit Au Bout Belfortain 90) — logiciel de gestion de tournois
de tarot (mode Libre par 4). Refonte from-scratch d'un ancien outil ASP, en
**Amalgame/Mosaic + MariaDB** côté back et **Angular 21 + Material** côté
front, avec **classement live** via Socket.IO.

## Installation

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![Release](../../actions/workflows/release.yml/badge.svg)](../../actions/workflows/release.yml)

Voir **[INSTALL.md](INSTALL.md)** — 3 méthodes au choix :

- **Windows (recommandé)** : télécharge `pabb90-X.Y.Z-setup.exe` depuis la
  [page Releases](../../releases) et lance-le. Il installe MariaDB si
  besoin, crée la base, applique les migrations et enregistre le service
  Windows. C'est le **seul artefact publié** par la release.
- **Linux** : cloner le dépôt, puis `sudo ./install.sh` → apt/dnf, base,
  build, unité systemd.
- **Docker** : `docker compose up -d` (clone du dépôt).

Une nouvelle version **s'installe par-dessus la précédente** : les
migrations manquantes sont appliquées et les données du club sont
conservées. Voir [`migrations/README.md`](migrations/README.md).

URL : http://localhost:3000 — identifiants par défaut `admin` / `admin123`
(à changer immédiatement).

## Roadmap & versions

Voir **[ROADMAP.md](ROADMAP.md)** pour le détail des phases V1 (back),
V2 (front), V3 (autres disciplines).

## Stack

- **Back** : Amalgame/Mosaic (binaire natif `server`, aucune dépendance
  Node à l'exécution) + MariaDB + Socket.IO + JWT. Le back était en
  Node.js/Express jusqu'au portage complet (commit `3850c05`).
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
