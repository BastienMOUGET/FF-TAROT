# FF-TAROT — Roadmap & versions

> Refonte from-scratch d'un logiciel ASP de gestion de tournois FFT
> (Fédération Française de Tarot). Stack : Node.js + Express + MariaDB +
> Socket.IO côté back ; Angular côté front (à venir).

---

## ✅ V1.0 — Back complet Libre par 4 *(livré)*

Backend fonctionnellement complet pour gérer un tournoi FFT en mode
**Libre par 4** (équipe NS+EO) du début à la fin. Auth incluse.

### Ce qui est livré
| Phase | Sujet | Commit |
|---|---|---|
| 1 | Schéma DB (21 tables) | `134277f` |
| 2 | Référentiel ligues / comités / clubs / joueurs | `53a21fa` |
| 3 | Tournaments + sub_tournaments + teams (équipes 4 NS/EO) | `b427b88` |
| 4 | Mouvements + mise en place automatique (par défaut N=0/S=+1/E=+2/O=-1) | `87202bc` |
| 5 | Saisie scores : `table_results` + `hand_results` par donne | `d3d8ca2` |
| 6 | Classement + diffusion live Socket.IO | `dd0379e` |
| 7 | Pénalités (`penalty_types` + `penalties`) avec intégration classement | `664841e` |
| 8 | PCN + grilles PP + export CSV format FFT | `5fc4e98` |
| 9a | Feuille de route consolidée (agrégation imprimable) | `769666e` |
| 9b | Génération de donnes pré-tirées (78 cartes, distribution, swap, regen) | `94cf261` |
| 10 | Authentification JWT + 3 rôles (admin / arbitre / viewer) | `322be20` |

### Workflow supporté de bout en bout
1. Login admin (`POST /auth/login`)
2. Création référentiel : ligues, comités, clubs, joueurs
3. Création tournoi + sub-tournoi (avec PCN/championnat/donne_set optionnels)
4. Inscription des équipes (4 joueurs NS+EO)
5. Optionnel : génération d'un jeu de donnes pré-tirées
6. Paramétrage de la grille PP
7. Pour chaque round : création + génération automatique de la mise en place
8. Saisie scores donne par donne, validation par table
9. Classement live diffusé sur chaque mutation (`ranking:update`)
10. Pénalités → recompute auto du classement
11. Feuille de route imprimable (JSON agrégé)
12. Export PCN au format CSV FFT

### Stack
- Node.js 20 + Express 5 + MariaDB
- Socket.IO 4 (live ranking)
- bcryptjs + jsonwebtoken (auth)
- express-validator (validation)
- 13 modules métier, ~5000 lignes

---

## 🔜 V1.x — Petits chantiers de consolidation

À planifier au fil de l'eau, à choisir selon urgence terrain.

| # | Sujet | Effort estimé | Notes |
|---|---|---|---|
| V1.1 | Multi-séance avec carryover `score_precedent` entre séances | 1-2 j | Schéma déjà compatible (juste FK `previous_sub_tournament_id`) |
| V1.2 | Import CSV de joueurs | 1 j | Module `players` + endpoint `POST /players/import` |
| V1.3 | Sauvegarde / restauration de tournois (JSON export/import) | 2 j | Lit/écrit toutes les tables liées à un tournament |
| V1.4 | Tests automatisés (Jest + supertest) | 3-5 j | Indispensable avant prod |
| V1.5 | PDF imprimables (feuille de route, feuille de score, étiquettes) | 1-2 sem | Lib pdfkit ou puppeteer |

---

## 🚧 V2.0 — Front Angular + production-ready

**Objectif : MVP utilisable par un vrai club pour un vrai tournoi.**

### Stack retenue (acté)
- Angular 21 (standalone components, signals + RxJS)
- Angular Material (azure-blue + Roboto)
- Socket.IO client pour le live ranking
- Build zoneless (provideZonelessChangeDetection)
- App dans `frontend/` à la racine du repo (un seul git, deux package.json)

### Tâches V2.0
| Sujet | Effort | État |
|---|---|---|
| Workspace Angular + Material + routing | 1 j | ✅ V2.0.0 |
| Service API + intercepteur JWT + auth state (signals) | 1 j | ✅ V2.0.0 |
| Page login | 0.5 j | ✅ V2.0.0 |
| Layout authentifié (toolbar + sidenav + guards) | 0.5 j | ✅ V2.0.0 |
| Page liste / création tournois | 1 j | ✅ V2.0.0 |
| Page détail tournoi (sub-tournois, équipes, rounds) | 2-3 j | ✅ V2.0.0 (basique) |
| Page inscriptions équipes (4 joueurs NS+EO) | 1 j | ✅ V2.0.0 |
| Page round detail (mise en place visuelle) | 1 j | ✅ V2.0.0 |
| Page saisie de scores (donne par donne) | 2-3 j | ✅ V2.0.0 (basique) |
| Écran classement live (Socket.IO) | 1-2 j | ✅ V2.0.0 |
| Page admin (référentiel + utilisateurs) | 1-2 j | ⚠️ V2.0.0 (lecture seule) |
| Build de prod + déploiement | 1 j | À faire (V2.0.1) |
| CRUD admin complet (créer/éditer ligues/clubs/joueurs/users) | 2-3 j | À faire (V2.0.1) |
| Polish UX (loading states, erreurs, validations front) | 2-3 j | À faire (V2.0.1) |
| Page feuille de route imprimable | 1 j | À faire (V2.0.1) |
| Gestion grille PP côté front | 1 j | À faire (V2.0.1) |
| Tests E2E Playwright | 3-5 j | À faire (V2.0.2) |

### V2.0.0 livré (premier squelette utilisable bout-en-bout)
Workflow couvert : login → liste/création tournois → sub-tournois →
inscription équipes 4 joueurs NS+EO → création/régénération de round →
saisie scores donne par donne avec totaux auto → validation table →
classement live (Socket.IO) avec couleurs podium.

11 routes lazy-loadées, 7 pages métier, Material Design.

### V2.0.1 livré (CRUD admin complet + grille PP + feuille de route)
- Admin CRUD complet : 6 dialogs (player, club, comite, ligue, penalty
  type, user) avec créer/modifier/supprimer + recherche joueurs +
  confirm dialog réutilisable
- Page éditeur de grille PP (place ↔ pp éditables, préréglage top 3)
- Page feuille de route imprimable (CSS @media print, page-break-inside
  avoid, sièges colorés N/S/E/O, bouton Imprimer)
- API service : 17 endpoints CRUD ajoutés (update/delete pour toutes les
  entités)
- Liens routés depuis le détail tournoi vers feuille de route et grille PP

13 routes lazy-loadées, 13 composants page, ~3500 lignes front total.
Front version 0.2.0.

### V2.0.2 (qualité, à venir)
Tests E2E end-to-end via Playwright + déploiement prod.

---

## 🔮 V3.0 — Modes de jeu autres + qualifs fédérales

Reproduire les autres disciplines de l'ASP legacy.

| Sujet | Effort | Notes |
|---|---|---|
| Mode Individuel (avec topage 0..100) | 1-2 sem | 56 fichiers ASP legacy |
| Mode Triplette | 2 sem | 50 fichiers ASP legacy, équipe de 3 |
| Mode Quadrette (avec quadrette_duo) | 2 sem | 50 fichiers ASP legacy |
| Mode AD (donne-par-donne avec topage par donne) | ~1 mois | Algorithme spécifique (`AD/functionClassement.asp`) |
| Mode Coupe (élimination directe + tableaux) | ~3 sem | 44 fichiers ASP legacy |
| Mode Triathlon | 1 sem | 19 fichiers ASP legacy |
| Mode Formation | 1 sem | 16 fichiers ASP legacy |
| Système qualifications fédérales (bordereau_qualifier, qualifier_cf) | ~1 mois | Critères FFT, exports Excel par comité |
| Détail bouts / contrat / calcul auto du score | 2-3 sem | Saisie déclarative au lieu de score_n/s/e/o |
| UI interactive de génération de donnes (diagrammes drag-drop) | ~3 sem | Front complète le back déjà fait |
| Rôles affinés ligue / comité / club | 1 sem | Données restreintes par périmètre |
| Import base joueurs FFT (si dump disponible) | 2 j | Module dédié |

---

## 📊 Couverture vs ASP legacy

L'ASP legacy = ~600 fichiers répartis sur 8 disciplines :
- ✅ **Libre** (141 fichiers ASP) → V1.0
- ⏳ **Individuel** (56) → V3.0
- ⏳ **Triplette** (50) → V3.0
- ⏳ **Quadrette** (50) → V3.0
- ⏳ **AD** (45) → V3.0
- ⏳ **Coupe** (44) → V3.0
- ⏳ **Triathlon** (19) → V3.0
- ⏳ **Formation** (16) → V3.0

**V1.0 couvre la discipline Libre** (la plus utilisée en pratique). V3.0
visera la parité complète, mais sa pertinence dépend du retour d'usage
réel de V2.0.

---

## Versioning

- **V1.0.x** : back Libre par 4 + auth (livré)
- **V1.1.x** : petits chantiers de consolidation back
- **V2.0.0** : front Angular MVP — squelette bout-en-bout livré
- **V2.0.x** : consolidation front (CRUD admin complet, polish, tests)
- **V3.0.x** : autres disciplines + qualifs fédérales

Numéros internes :
- Back (`package.json` racine) : `1.0.0`
- Front (`frontend/package.json`) : `0.1.0` → passera à `1.0.0` quand
  l'admin CRUD sera complet et le déploiement opérationnel

Format : [SemVer](https://semver.org). Major = changement de périmètre
fonctionnel. Minor = ajout de fonctionnalité. Patch = bugfix / sécurité.
