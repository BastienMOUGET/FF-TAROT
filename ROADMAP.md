# PABB90 — Roadmap & versions

> Refonte from-scratch d'un logiciel ASP de gestion de tournois FFT
> (Fédération Française de Tarot). Stack : Node.js + Express + MariaDB +
> Socket.IO côté back ; Angular côté front (à venir).

---

## ✅ v3.0.23 — Retour terrain n°4 : relais, import CSV, impressions, minuterie *(livré, 2026-09-08)*

Mémo n°4 (`feedback/2026-09-08/`, sur la v3.0.22) et le fichier
`Classement 02092026.csv` de l'Excel FFT.

### Tables de 3 : le « Relais », à l'inverse de la 3.0.22

Le club joue avec un joueur virtuel **Relais 1/2/3** assis en **Nord, fixe
à sa table toute la soirée**, qui marque des points comme les autres (Sud
prend et gagne 25 : Nord relais, Est, Ouest à -25, Sud à +75). La 3.0.22
tirait la place vide hors Nord et la faisait tourner : c'était à l'envers.

- Migration `005` : `players.is_relais` + 3 joueurs Relais. Ils
  n'apparaissent ni dans la liste des joueurs, ni dans les classements
  (manche et général), ni dans l'import. `rounds.am` en crée d'autres si
  une soirée a plus de 3 tables de 3.
- Mise en place : une équipe de 3 place ses joueurs en S, E, O (sièges du
  tirage respectés, jamais Nord) et le back pose « Relais k » en Nord. Le
  patron de mouvement laisse Nord à 0 : le relais ne bouge pas.
- La saisie est donc à nouveau une somme à 0 sur 4 sièges, relais compris,
  avec le dernier score calculé — ce qu'il demande au point 3.

### Import d'un tournoi joué hors PABB90

`POST /api/tournaments/:id/import-ranking` + bouton « Importer un tournoi
(CSV) » sur la page Challenge. Le CSV de l'Excel FFT (séparateur « ; »,
lignes d'en-tête, puis `Place;N° Licence;Nom Prénom;Départ;Points;Pcn`)
est lu côté front : ligne de titres repérée par « Place » + « Points »,
codes parasites en fin de nom retirés (« 0 », « NR », « 2C »), licence
« 0 » = aucune, nom du tournoi déduit du fichier (`Classement 02092026`
→ `02/09/2026`). Joueur reconnu par licence, sinon par nom + prénom, sinon
créé. Le tournoi est marqué `sub_tournaments.imported` (migration `005`) :
`Compute()` l'ignore, sans quoi le premier recalcul l'aurait effacé. Vérifié
sur le fichier du club : 39 joueurs importés, présents au Challenge, intacts
après un recalcul, suppression propre.

Un tournoi se retire du Challenge depuis sa carte (corbeille + confirmation).

### Impressions et classements

- Le bandeau latéral et la barre du haut disparaissent à l'impression sur
  toutes les pages (règle globale dans `styles.scss`).
- Bouton Imprimer sur le classement général et sur le classement du
  Challenge (la page n'imprime alors que ce classement).
- Relief étendu aux scores **égaux à 0** (général et manche).

### Minuterie de manche

Dans le bandeau latéral : durée réglable (50 min par défaut, mémorisée
dans le navigateur), Démarrer / Pause / Remise à zéro, sonnerie
synthétisée à la fin (3 séries de 3 bips) et cadre clignotant. Elle
survit à la navigation.

Vérifié (chaîne CI reproduite en local, base jetable) : relais en Nord sur
les deux manches, exclu des classements, saisie d'une table de 3, import
CSV réel, recalcul, suppression. Rendu visuel non testé ici.

---

## ✅ v3.0.22 — Retour terrain n°3 : la soirée de A à Z *(livré, 2026-09-07)*

Le backlog du mémo n°3 (voir v3.0.21), traité en un lot. Le vocabulaire
suit celui du club : un **Challenge** (trimestre) contient des **Tournois**
(soirées hebdomadaires), chacun découpé en **manches**.

### Navigation

- Page Challenge (`/tournaments/:id`) réordonnée : la liste des tournois et
  « Ajouter un tournoi » **en haut**, le classement du Challenge en bas.
  Un tournoi créé s'ouvre directement sur sa page ; son nom par défaut est
  la date du jour. « Cumul brut » devient « Par points ».
- Nouvelle page Tournoi (`/sub-tournaments/:id`) : le déroulé de la soirée
  en 4 étapes — Joueurs présents → impressions (placement, feuilles de
  marque) → manches (avec l'avancement « n/m tables validées », saisie et
  classement de la manche) → classement général. « Équipes » devient
  « Joueurs ».

### Tables de 3

- `team_players.seat` (migration `004`) : le tirage au sort envoie le siège
  choisi pour chaque joueur, la mise en place de la manche 1 le respecte.
  Avant, seule la paire NS/EO et l'ordre étaient transmis : sur une table de
  3 le siège réel était perdu.
- La place vide d'une table de 3 est tirée au sort parmi **S, E, O — jamais
  Nord**, qui tient la feuille de marque. Comme S/E/O bougent d'une manche
  à l'autre, la table à 3 change de numéro au lieu de rester figée (c'est
  ce qu'il observait avec la place vide en Nord, dont l'offset est 0).
  Même règle côté back pour une équipe sans siège explicite.

### Impressions

- Feuille de placement refaite : une page, tableau `Table | Nord | Sud |
  Est | Ouest`, noms en gros et gras, choix de la manche.
- Nouvelles feuilles de marque (`/sub-tournaments/:id/score-sheets`) : une
  par table et par manche, avec les noms par orientation, 6 donnes par
  défaut (réglable) et une ligne Total. À imprimer en début de tournoi
  pour toutes les manches générées.

### Saisie de la manche

- Écran refait : raccourcis « Table 1 … n » en haut (cochés quand validés),
  les 4 orientations toujours affichées (place vide grisée), plus de 0 par
  défaut ni de flèches, **le dernier score se calcule** pour que la somme
  fasse 0 (sur 3 sièges pour une table de 3), un seul bouton « Valider le
  résultat de la table », en haut.
- Mode détail : les 6 donnes visibles d'un coup dans une grille, preneur
  par donne, ligne de totaux ; « Ajouter une donne » au-delà.
- Une table validée reste modifiable : le bouton devient « Enregistrer les
  corrections » et la table reste validée. Après validation, lien direct
  vers la prochaine table non validée, puis vers le classement de la manche.

### Classements

- **Classement par manche** (`GET /api/rounds/:id/ranking`, page
  `/rounds/:id/ranking`) : place, joueur, table, orientation (le siège tiré
  au sort, demandé en colonne), score × coef, égalités = même place. Les
  joueurs d'une table non validée sont listés en fin, sans place, et la
  page signale que le classement est provisoire. Imprimable.
- Classement général : le 1er en jaune, tous les scores positifs en vert
  (écran et impression).

### Chaîne de build locale : amc 0.8.90 ≠ amc 0.8.88

Découvert en testant : le binaire construit sur ce poste (amc **0.8.90**,
cache `~/.amalgame/packages` accumulé depuis des mois) répond
« Authentification requise » à **toute** requête portant un JWT — les
en-têtes HTTP n'arrivent pas au code AM. Le même code construit avec la
chaîne de la release (amc **0.8.88**, cache vierge, `HOME` dédié)
fonctionne, et c'est ce que le beau-père utilise. Le login et la liste des
joueurs sont publics, d'où des tests locaux faussement verts jusqu'ici.
`build.sh` compare désormais la version d'amc à celle de `release.yml` et
prévient. Pour tester en local : télécharger le tarball amc de la version
de `release.yml`, `HOME=<dossier vide>`, rejouer `amc package add` depuis
le lock (le lock doit ressortir identique), puis `build.sh`.

Vérifié (binaire 0.8.88, base jetable) : sièges explicites respectés,
place vide d'une table de 3 hors Nord sur 8 tirages, refus des sièges
incohérents (doublon, E en paire NS), saisie et validation d'une table de
4 et d'une table de 3, classement de manche avec égalités et table en
attente, classement général.

---

## ✅ v3.0.21 — Blocage du lendemain (connexion DB) + retour terrain n°3 *(livré, 2026-09-07)*

### Le vrai « impossible de se connecter le lendemain »

Troisième mémo du beau-père (`feedback/Copie de
Memo-Analyse-tarot-PABB90.pdf`, v3.0.19, poste **Windows**) : installé le
vendredi, compte `cclaude` créé et utilisé ; le samedi matin, **ni
admin/admin123 ni cclaude** ne passent, jusqu'à une désinstallation /
réinstallation. Un compte créé la veille par le back v3.0.19 est en scrypt :
le hash bcrypt hérité (migration `003`, v3.0.20) n'explique donc pas ce
blocage. La migration reste utile mais ne corrige pas ce cas.

Cause reproduite le 2026-09-07 sur une MariaDB jetable (`wait_timeout=5`) :
le back ouvrait **une** connexion au démarrage et ne la vérifiait plus
jamais. Deux façons de la perdre, même symptôme :

- MariaDB ferme toute connexion inactive depuis `wait_timeout` (**8 h** par
  défaut) → le lendemain matin, chaque requête échoue ;
- au boot Windows, le service PABB90 démarre avant le service MariaDB →
  `Open()` échoue et le handle reste vide.

Dans les deux cas `Rows()` rend une liste vide, le login répond
« Identifiants invalides » à tout le monde, et seul un redémarrage du service
(ou une réinstallation, qui le redémarre) débloque. Le journal du service
disait bien « DB: connexion impossible », mais personne ne le lit.

Correctifs :

- `lib/db.am` : sur une erreur de connexion (2003/2006/2013 ou handle
  jamais ouvert), fermeture, réouverture et rejeu de la requête, une fois.
  Sans coût quand tout va bien (pas de requête de sonde). `Begin` est
  rejouable, `Commit`/`Rollback` non (la transaction est déjà perdue).
- `server.am` : au démarrage, 30 tentatives à 1 s d'intervalle avant de
  servir ; si la base n'est toujours pas là, on sert quand même et la
  reconnexion à la demande prend le relais.
- `installer/setup.iss` : `sc config PABB90 depend= MariaDB`, posé
  seulement si un service `MariaDB` existe (celui de notre MSI). Une
  dépendance vers un service absent empêcherait PABB90 de démarrer.
- `migrate.ps1` : `$OutputEncoding` forcé en UTF-8 — Windows PowerShell 5.1
  pipe en ASCII par défaut et aurait cassé les accents des données de
  référence (« Téléphone à table »). Le chemin `.exe` (redirection cmd)
  n'était pas concerné.

Vérifié (binaire Linux, base jetable) : login OK après coupure par
`wait_timeout` ; serveur lancé avant la base → attend puis sert ; base
absente plus de 30 s puis disponible → première requête reconnecte.

Piège rencontré pendant ces tests, à connaître : le listener HTTP est en
`SO_REUSEPORT`, donc **plusieurs instances du back peuvent écouter le même
port sans erreur** et le noyau répartit les connexions entre elles. Trois
serveurs de test « tués » avec un simple `kill` étaient encore vivants et
répondaient à tour de rôle avec des connexions DB mortes — d'où un login
qui semblait aléatoire. Avant tout test : `ss -ltnp | grep <port>`,
et `kill -9`.

### Retour terrain n°3 — reste du mémo (backlog, non traité ici)

Vocabulaire : « Sous-tournois » → « Tournois » ; « Cumul brut » → « Par
points » ; bouton « Équipes » → « Joueurs ».

Page tournoi / challenge : la liste des tournois et « Ajouter » **en haut**,
le classement trimestriel en bas (dans les deux écrans) ; ouvrir un tournoi
ajouté sur sa propre page.

Feuille de route : aux tables de 3, la place vide est toujours Nord et
toujours la même table → choix aléatoire de la table à 3 et de la place
vide ; mémoriser l'orientation tirée pour l'afficher en colonne des
classements. Impression : une seule page, tableau dense
`Table | Nord | Sud | Est | Ouest`, noms en gros et gras, sans la colonne de
gauche.

Saisie de la manche : pas de « 0 » par défaut ni de flèches ; le 4ᵉ score
calculé pour que la somme fasse 0 ; afficher les 4 positions même vide ;
le détail donne par donne sur les 6 donnes d'un coup (correction) ; boutons
raccourcis « Table 1 … Table n » en haut de l'écran de saisie ; un seul
bouton « Valider », placé en haut ; pouvoir modifier une table déjà
validée.

Classement : un classement **par manche** en plus du général ; 1er en
couleur (et scores positifs au général). À vérifier avec sa base : « seuls
les 3 premiers et les 3 derniers sont reportés sur 39 joueurs » — le code
ne tronque rien (ni `ranking.am` ni la page), probablement les tables non
encore saisies, mais à confirmer sur ses données.

Génération et impression des feuilles de marque par table et par manche
(4 manches × n tables) — fonction non vue par lui, à confirmer si elle
existe.

---

## ✅ v3.0.20 — Migrations de base + suppression de joueur *(en cours)*

Lève la « limite connue » de v3.0.19 (voir plus bas) et débloque le
second retour terrain du beau-père : *« je ne peux pas tous les
supprimer, ça dit suppression impossible (référencé) »*.

### Migrations de schéma

Le schéma n'est plus appliqué en bloc. `db.sql` (qui commençait par 25
`DROP TABLE`) disparaît au profit de `migrations/NNN_*.sql`, appliqués
un par un et tracés dans la table `schema_migrations` :

- base vierge → installation complète ;
- base à jour → rien ;
- base d'une version antérieure → seules les migrations manquantes,
  **sans perdre les données du club**.

Les 4 chemins d'installation appliquent les mêmes fichiers `.sql` :
`install.sh` → `migrate.sh` ; Docker → `migrate.sh` à chaque démarrage
du conteneur ; l'installeur Windows `.exe` → `RunMigrations()` en Pascal
natif dans `setup.iss` (il reste sans PowerShell) ; `install.ps1` →
`migrate.ps1`. Outils dev/ops : `migrate.sh --status`, `update-db.sh`,
`reset-db.sh`.

`002_reconcile_pre_migration_schema.sql` rattrape les bases installées
avant ce système : `001_baseline.sql` est en `CREATE TABLE IF NOT
EXISTS` et ne touche pas une table existante, il n'aurait donc jamais
ajouté `players.club_member` ni `tournaments.challenge_mode` — les deux
colonnes précisément identifiées comme manquantes en v3.0.19. Vérifié
sur une vraie base pré-migrations : la liste des joueurs revenait vide
(le back sélectionne `p.club_member`, la requête échouait en silence).
La règle qui en découle est écrite dans `migrations/README.md` : une
colonne s'ajoute toujours dans un **nouveau** fichier, jamais en
éditant `001`.

Le jeu de démo (« Club Test FFT », « Tournoi Test FFT ») n'est plus
installé par défaut — c'est lui qui a créé les données que le beau-père
essayait de supprimer. Il devient explicite : `install.sh --with-demo`,
`install.ps1 -WithDemo`, `FFT_SEED_DEMO=1` en Docker, et n'est chargé
que sur une base vierge. La CI refuse tout `DROP TABLE` / `TRUNCATE`
dans `migrations/`.

### Comptes bloqués par un hash hérité

`003_legacy_password_hashes.sql` : l'ancien back Node hachait en bcrypt,
le back Amalgame vérifie en scrypt via `Password.Verify`. Un compte
bcrypt ne peut plus s'authentifier du tout — et si c'est le seul admin,
l'application devient inaccessible sans écran de récupération. La
migration remet ces comptes **admin** sur `admin123`. Elle n'affaiblit
rien : le hash visé est déjà invérifiable, le compte est mort avant
comme après, la migration le rend seulement récupérable. Les comptes
arbitre/viewer hérités restent inactifs volontairement (plutôt que de
devenir des accès vivants sur un mot de passe connu) ; l'admin les
réinitialise depuis l'onglet Utilisateurs.

*Note du 2026-09-07 : ce rattrapage est correct mais n'explique pas le
blocage du 6/09 (compte scrypt créé la veille, bloqué aussi). La cause est
la connexion DB morte après 8 h d'inactivité — voir v3.0.21.*

### Dérive de versions des dépendances (CI)

`release.yml` épingle les paquets par **tag**, `amalgame.lock` les
enregistre par **commit** — et un tag amont n'est pas immuable. Constaté :
`amalgame-datetime` v0.2.2 et `amalgame-logging` v0.2.0 avaient été
redéployés sur d'autres commits, donc la release se construisait sur du
code que le lock ne décrivait pas, sans qu'aucun fichier du dépôt n'ait
bougé. Les revs du lock sont réalignés, et les deux workflows échouent
désormais si `amc package add` fait bouger `amalgame.lock`/`.toml`.
`ci.yml` résout en plus ses paquets **depuis le lock** au lieu d'une
liste en dur sans version (sans `@tag`, `amc package add` prend « la
dernière compatible » : la CI ne testait donc pas ce que la release
construit).

Le garde-fou a immédiatement révélé un troisième écart, invisible
jusque-là : **`amc package add` n'honore pas le tag épinglé pour
`crypto`**. Malgré `amalgame-crypto@v0.7.0` en URL complète dans
`release.yml`, il installe v0.8.0 et réécrit `amalgame.lock`/`.toml`.
Les releases construisaient donc contre v0.8.0 alors que le dépôt
affichait v0.7.0. Le lock est aligné sur v0.8.0 (la version réellement
utilisée — aligner ne change donc rien au binaire produit), et vérifié :
crypto v0.8.0 valide bien le hash scrypt du compte admin, dont dépendent
`001` et `003`. La cause probable est la même que celle déjà documentée
pour net-http/tls : `amalgame.lock` étant clé par **nom**, un paquet
ajouté ensuite et dépendant d'un `crypto` plus récent écrase l'entrée.
À signaler en amont à `amc`.

Vérifié le 2026-09-07 sur le poste de dev : le cache local
`~/.amalgame/packages/` est **clé par tag** et `amc package add` réutilise
un dossier `vX.Y.Z_<rev>` déjà présent sans réinterroger GitHub. Un tag
redéployé en amont est donc invisible en local tant que l'ancien dossier
existe : `amc package add datetime@v0.2.2` rendait `1eb9f306` (ancien) et
réécrivait le lock, alors que `git ls-remote` donne bien `f28d6556`. Pour
ré-résoudre : retirer le dossier `vX.Y.Z_<ancien rev>` du cache, puis
relancer `amc package add` — le lock committé est alors reproduit à
l'identique. `build.sh` n'utilise que les revs du lock, donc sans ce
rafraîchissement il s'arrête sur « pkg cache missing ».

### CI Linux réparée

Elle était rouge depuis plusieurs versions (v3.0.19 comprise), mais le
job s'arrêtait avant d'atteindre la vraie cause. Deux problèmes
distincts, tous deux à l'édition de liens :

- `ld: cannot find -lnghttp2` — `amalgame-net-http` v0.26.1 déclare
  `nghttp2` dans ses `libs`, `build.sh` le passe donc en `-lnghttp2`,
  mais le runner ne fournit que la lib runtime, pas le paquet `-dev` ;
  `libnghttp2-dev` est ajouté aux dépendances de build.
- `undefined reference to App_Math_Floor` — la CI compilait avec amc
  **0.8.87** alors que `release.yml` livre avec **0.8.88**, et
  `Math.Floor` (utilisé par `modules/ranking/ranking.am`) n'est pas
  dans la stdlib de 0.8.87. Le C passait avec un simple warning de
  déclaration implicite, seul le link tombait. Les deux versions d'amc
  sont désormais alignées : une CI qui ne compile pas avec la toolchain
  qui produit le binaire livré ne teste pas grand-chose.

### Suppression d'un joueur référencé

`DELETE /api/players/:id` renvoyait un « Suppression impossible
(référencé) » sans issue. Il renvoie désormais un 409 détaillé (quels
tournois, combien d'inscriptions/placements/pénalités, forçage
possible ou non), et l'admin affiche un dialogue qui nomme les tournois
bloquants :

- tournoi pas encore démarré (`draft`/`open`) → bouton **« Supprimer
  quand même »**, qui retire aussi l'équipe du joueur (une équipe Libre
  par 4 amputée d'un joueur n'est plus jouable ; ses coéquipiers
  redeviennent non inscrits mais ne sont pas supprimés) ;
- tournoi `running`/`closed` → refusé même en forçant, avec le nom du
  tournoi à supprimer d'abord. On ne réécrit pas des résultats.

---

## ✅ v3.0.18–v3.0.19 — Retour terrain (beau-père) *(livré, 2026-09-03)*

Analyse d'un mémo écrit après test réel de l'appli (`feedback/` — non
versionné, contient des données personnelles de joueurs) : vocabulaire,
ergonomie de saisie, et un vrai trou fonctionnel (le classement
"Challenge" trimestriel, cœur de `ChallengeLib214.xls`, l'outil Excel
FFT encore utilisé au club).

- Vocabulaire Challenge/Manche (au lieu de Tournoi/Round) dans l'UI
- Ajout d'un joueur directement depuis l'écran d'inscription
- Orientation à la table par joueur (fixe N/S/E/O ou "non Nord") au
  tirage au sort
- Masquage des onglets Ligues/Comités (usage club simple, pas fédéral)
- Saisie du résultat global d'une table (+ vérification somme = 0) en
  plus de la saisie détaillée donne par donne, avec auto-calcul du
  partage preneur/adversaires
- Bouton "Manche suivante" directement depuis l'écran de la manche en
  cours (évite l'aller-retour par les menus)
- Fix fiabilité : régénérer la mise en place d'une manche supprime
  désormais réellement les scores associés (`table_results`), qui
  restaient sinon rattachés au n° de table pour d'autres joueurs
- Suppression d'une manche créée par erreur (admin)
- Message d'erreur explicite quand la mise en place échoue (ex: aucune
  équipe inscrite) au lieu d'un échec silencieux
- Statut "adhérent du club" par joueur + filtre/liste des adhérents
- **Classement Challenge trimestriel** : agrégation du classement final
  de tous les sous-tournois d'un tournoi, points par place ou cumul
  brut au choix (`tournaments.challenge_mode`)
- Import CSV de liste de joueurs (upsert par licence, doublons de
  nom/prénom avec licence différente signalés sans fusion automatique)
- Fix `build.sh` : les chemins d'include des packages venaient d'un
  scan "dernière version installée sur la machine" au lieu
  d'`amalgame.lock` — pouvait compiler contre les headers d'une version
  et linker la lib précompilée d'une autre (décalage ABI silencieux)
  sur un poste ayant accumulé plusieurs versions d'un même package.
  N'affecte pas le pipeline de release (runner CI toujours propre).

**Limite connue de l'appli** *(levée en v3.0.20)* : `db.sql` n'est
appliqué qu'à la première init d'une base — pas de migrations. Passer à
ces versions sur une installation existante demande soit une réinstall
(perte des données), soit un `ALTER TABLE` manuel pour les 2 colonnes
ajoutées (`tournaments.challenge_mode`, `players.club_member`).
→ C'est exactement ce que fait désormais
`migrations/002_reconcile_pre_migration_schema.sql`, automatiquement.

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

### V2.0.2 livré (déploiement clé en main : Windows + Linux + Docker)
Refonte back : toutes les routes API préfixées par `/api/*`, fallback
SPA pour servir le bundle Angular sur la même origine. Le back devient
le seul processus à lancer en production (1 port, 1 service, 1 URL).

Refonte front : `apiUrl: '/api'` et `socketUrl: ''` (même origine),
`proxy.conf.json` pour le dev mode (npm start sur :4200 proxifie /api
et /socket.io vers :3000).

3 méthodes d'install :
- `install.ps1` (Windows, PowerShell admin) : winget pour Node + MariaDB,
  DB + .env avec mots de passe aléatoires, build front, raccourci Bureau,
  start.bat/stop.bat
- `install.sh` (Linux : Debian/Ubuntu/Fedora/RHEL) : apt/dnf, systemd
  unit pabb90.service pour démarrage auto au boot, start.sh/stop.sh
- `docker-compose.yml` + Dockerfile multi-stage : conteneurs MariaDB +
  app, entrypoint qui applique db.sql/seed.sql au premier boot

Documentation centralisée dans `INSTALL.md`. README.md refait.

### V2.0.3 livré (CI/CD GitHub Actions + packages Releases)
- `.github/workflows/ci.yml` : sur chaque push/PR, build front + lint
  back, valide docker-compose et Dockerfile, vérifie scripts shell
- `.github/workflows/release.yml` : sur tag `v*`, génère archives
  Linux/Windows + Docker image
- Installeurs adaptés : skip ng build si front pré-buildé

### V2.0.4 livré (installeur Windows .exe Inno Setup + service NSSM)
- **`installer/setup.iss`** : script Inno Setup 100% Pascal Script
  (pas de PowerShell embarqué). Couvre :
  - winget install Node.js LTS + MariaDB Server (silent)
  - Génération mots de passe DB et JWT aléatoires (Pascal `Random`)
  - Création DB + utilisateur `fft_user` + grants
  - Application de db.sql + seed.sql
  - Écriture .env
  - npm install (back + front si pas pré-buildé)
  - Installation NSSM comme service Windows "PABB90" :
    - démarre automatiquement au boot (SERVICE_AUTO_START)
    - redémarre tout seul en cas de crash (`sc failure`)
    - logs rotatifs (10 Mo) dans logs\server.log
    - démarrage immédiat à l'install
  - Raccourcis Menu Démarrer + Bureau pointant directement sur
    http://localhost:3000 (le service tourne déjà)
  - Désinstalleur propre (stop service + remove + cleanup .env / logs)

- **`install.ps1`** mis à jour : utilise NSSM aussi pour cohérence
  (téléchargement automatique depuis nssm.cc si absent), start.bat /
  stop.bat pilotent le service via `net start`/`net stop` avec
  fallback vers mode standalone si le service n'est pas installé

- **`.github/workflows/release.yml`** :
  - Nouveau job `inno-installer` (windows-latest) : télécharge NSSM
    2.24, build le front, compile setup.iss avec iscc en passant
    `/DAppVersion=$version`, upload le .exe en artifact
  - Synchronisation auto de la version (tag git → environment.ts via
    `sed`/`Get-Content` + package.json via `npm pkg set version`)
  - Le release final attache les 3 archives : `.exe`, `.zip`, `.tar.gz`
    + image Docker GHCR

- **Front** : version affichée dans la sidebar (sous "PABB90") et
  sous le titre du login. Lue depuis `environment.appVersion`,
  injectée par la CI au build pour rester synchro avec le tag.

- **Démarrage automatique** garanti partout :
  - Windows : service NSSM `PABB90` (auto-start)
  - Linux : `systemctl enable pabb90.service`
  - Docker : `restart: unless-stopped` dans docker-compose.yml

### V2.0.5 (à venir)
Tests E2E Playwright. Polish UX (loading states, gestion erreurs sur
tous les écrans, responsive mobile pour la saisie au bord de table).

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
- **V2.0.0** : front Angular MVP — squelette bout-en-bout (livré)
- **V2.0.1** : CRUD admin complet + grille PP + feuille de route (livré)
- **V2.0.2** : packaging déployable (Windows/Linux/Docker, livré)
- **V2.0.3** : CI/CD GitHub Actions + packages Releases (livré)
- **V2.0.4** : tests E2E + polish
- **V3.0.x** : autres disciplines + qualifs fédérales

Numéros internes :
- Back (`package.json` racine) : `1.0.0`
- Front (`frontend/package.json`) : `0.1.0` → passera à `1.0.0` quand
  l'admin CRUD sera complet et le déploiement opérationnel

Format : [SemVer](https://semver.org). Major = changement de périmètre
fonctionnel. Minor = ajout de fonctionnalité. Patch = bugfix / sécurité.
