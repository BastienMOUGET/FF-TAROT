// Types miroirs des modèles back. Mis à jour à la main pour le moment.

export type Role = 'admin' | 'arbitre' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: Role;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Ligue {
  id: number;
  code: string;
  name: string;
  created_at: string;
}

export interface Comite {
  id: number;
  code: string;
  name: string;
  ligue_id: number | null;
  ligue_code?: string | null;
  ligue_name?: string | null;
}

export interface Club {
  id: number;
  code: string;
  name: string;
  comite_id: number | null;
  comite_code?: string | null;
  comite_name?: string | null;
  ligue_id?: number | null;
  // Data URL de l'image du club (détail seulement, jamais dans la liste).
  logo?: string | null;
}

export interface Player {
  is_relais?: boolean;
  id: number;
  licence: string | null;
  name: string;
  firstname: string;
  club_id: number | null;
  club_code?: string | null;
  club_name?: string | null;
  category: string | null;
  gender: 'M' | 'F' | null;
  birth_year: number | null;
  club_member: boolean;
}

// Réponse 409 de DELETE /api/players/:id quand le joueur est engagé quelque
// part. Le back détaille ce qui bloque pour qu'on puisse l'expliquer et, si
// aucun résultat n'est en jeu (can_force), proposer une suppression forcée.
export interface PlayerReferencedError {
  error: string;
  code: 'player_referenced';
  can_force: boolean;
  teams: number;
  seats: number;
  penalties: number;
  rankings: number;
  tournaments: {
    id: number;
    name: string;
    status: 'draft' | 'open' | 'running' | 'closed';
    erasable: boolean;
  }[];
}

export interface PlayerImportRow {
  licence: string | null;
  name: string;
  firstname: string;
}

export interface PlayerImportDuplicate {
  name: string;
  firstname: string;
  new_licence: string | null;
}

export interface PlayerImportResult {
  created: number;
  updated: number;
  unchanged: number;
  potential_duplicates: PlayerImportDuplicate[];
}

export type TournamentStatus = 'draft' | 'open' | 'running' | 'closed';

export interface Tournament {
  id: number;
  code: string;
  name: string;
  date: string | null;
  type: string;
  status: TournamentStatus;
  current_round: number;
  coef_default: string;
  club_id: number | null;
  comite_id: number | null;
  club_code?: string | null;
  club_name?: string | null;
  comite_code?: string | null;
  comite_name?: string | null;
  challenge_mode: 'place' | 'raw';
}

// Détail d'un joueur sur un tournoi du challenge (format Excel du club :
// Points / Pcn / PC). null si le joueur n'y a pas participé.
export interface ChallengeDetail {
  points: number;
  pcn: number;
  pc: number;
}

export interface ChallengeRankingEntry {
  player_id: number;
  licence: string | null;
  name: string;
  firstname: string;
  sub_tournaments_played: number;
  points: number; // points challenge (PC) cumulés
  total_points: number; // points de jeu cumulés
  total_pcn: number;
  place: number;
  details: (ChallengeDetail | null)[]; // même ordre que sub_tournaments
}

export interface ChallengeSubTournament {
  id: number;
  label: string;
  imported: boolean;
  players: number;
}

// Tournoi du challenge pas (encore) compté : non terminé, ou terminé mais
// après un tournoi non terminé.
export interface ChallengePending {
  id: number;
  label: string;
  reason: string;
}

export interface ChallengeRanking {
  challenge_mode: 'place' | 'raw';
  sub_tournaments_count: number;
  // Tournois COMPTÉS (terminés, sans trou), dans l'ordre.
  sub_tournaments: ChallengeSubTournament[];
  pending?: ChallengePending[];
  ranking: ChallengeRankingEntry[];
}

export interface SubTournament {
  id: number;
  tournament_id: number;
  label: string;
  color: string | null;
  color_name: string | null;
  indice_pcn: string | number;
  championnat: 0 | 1 | boolean;
  donne_set_id: number | null;
  tournament_code?: string;
  tournament_name?: string;
  // Classement importé (CSV d'un classeur Excel) : ni équipes ni manches, seulement
  // des lignes de rankings figées.
  imported?: boolean;
  // Nombre de manches prévu (toutes générées après le tirage au sort).
  rounds_planned?: number;
  // Comment les tables sont formées d'une manche à l'autre.
  placement_mode?: PlacementMode;
}

// movement   : mouvement standard Libre par 4 (N fixe, S+1, E+2, O-2)
// level      : dès la manche 2, tables formées par niveau (classement cumulé)
// level_last : mouvement, sauf la dernière manche formée par niveau
export type PlacementMode = 'movement' | 'level' | 'level_last';

// Paramètres globaux (GET/PUT /api/settings), valeurs en chaînes.
export interface Settings {
  rounds_default?: string | null;
  default_club_id?: string | null;
  [key: string]: string | null | undefined;
}

export interface RankingImportRow {
  place: number;
  licence: string | null;
  name: string;
  firstname: string;
  points: number;
  pcn: number;
}

export interface RankingImportResult {
  sub_tournament_id: number;
  label: string;
  imported: number;
  created_players: number;
}

export type Pair = 'NS' | 'EO';

export interface TeamPlayer {
  seat?: Seat | null;
  team_id?: number;
  player_id: number;
  pair: Pair;
  player_number: number;
  licence: string | null;
  name: string;
  firstname: string;
  club_id: number | null;
  category: string | null;
  // Consigne de position du tirage (migration 011), null = aléatoire.
  orientation?: string | null;
}

export interface Team {
  id: number;
  sub_tournament_id: number;
  team_number: number;
  players: TeamPlayer[];
}

export type Seat = 'N' | 'S' | 'E' | 'O';

export interface RoundSeat {
  table_number: number;
  seat: Seat;
  player_id: number;
  team_id: number | null;
  team_number?: number;
  licence: string | null;
  name: string;
  firstname: string;
  // Place tenue par un joueur virtuel « Relais » (table de 3).
  is_relais?: boolean;
  // Consigne de position donnée au tirage (migration 011) :
  // 'N' | 'S' | 'E' | 'O' | 'not_north', null = aléatoire.
  orientation?: string | null;
}

export interface RoundTable {
  table_number: number;
  seats: RoundSeat[];
}

export interface Round {
  id: number;
  sub_tournament_id: number;
  round_number: number;
  coef: string;
  started_at: string | null;
  closed_at: string | null;
  tables?: RoundTable[];
}

export interface Hand {
  id: number;
  table_result_id: number;
  hand_number: number;
  taker_seat: Seat | null;
  score_n: number;
  score_s: number;
  score_e: number;
  score_o: number;
  round_id?: number;
  table_number?: number;
}

export interface TableResult {
  id: number;
  round_id: number;
  table_number: number;
  score_n: number;
  score_s: number;
  score_e: number;
  score_o: number;
  codif_n: string | null;
  codif_s: string | null;
  codif_e: string | null;
  codif_o: string | null;
  validated: 0 | 1 | boolean;
  validated_at: string | null;
  hands: Hand[];
}

export interface RankingEntry {
  player_id: number;
  licence: string | null;
  name: string;
  firstname: string;
  rounds_played: number;
  total: string | number;
  total_general: string | number;
  place: number;
  pcn: string | number;
  pp: string | number;
  eliminated?: 0 | 1 | boolean;
  updated_at?: string | null;
}

// Classement général avec le détail manche par manche
// (GET /api/sub-tournaments/:id/ranking-detail)
export interface RankingDetailEntry extends RankingEntry {
  // Un score par manche, dans l'ordre de `rounds` ; null = pas joué.
  rounds: (number | null)[];
}

export interface RankingDetail {
  rounds: { id: number; round_number: number }[];
  ranking: RankingDetailEntry[];
}

// Classement d'une manche (GET /api/rounds/:id/ranking)
export interface RoundRankingEntry {
  player_id: number;
  licence: string | null;
  name: string;
  firstname: string;
  table_number: number;
  seat: Seat;
  score: number | null; // null = table pas encore saisie
  place: number; // 0 = pas encore classé
  validated: boolean;
}

export interface RoundRanking {
  round_id: number;
  sub_tournament_id: number;
  round_number: number;
  coef: number;
  ranking: RoundRankingEntry[];
}

export interface PenaltyType {
  id: number;
  code: string;
  label: string;
  default_points: string;
}

export interface Penalty {
  id: number;
  tournament_id: number;
  player_id: number;
  type_id: number | null;
  points: string;
  reason: string | null;
  applied_round_id: number | null;
  created_at: string;
  player_name?: string;
  player_firstname?: string;
  type_code?: string | null;
  type_label?: string | null;
}

export interface MovementPattern {
  id: number;
  table_count: number;
  offset_n: number;
  offset_s: number;
  offset_e: number;
  offset_o: number;
  label: string | null;
}

export interface PpEntry {
  place: number;
  pp: string;
}

export interface DonneSet {
  id: number;
  name: string;
  nb_donne: number;
  created_at: string;
}

export interface CardRef {
  id: number;
  code: string;
  suit: string;
  rank: string;
  display_order: number;
}

export interface RouteSheetSeat {
  seat: Seat;
  player_id: number;
  team_id: number | null;
  team_number: number | null;
  licence: string | null;
  name: string;
  firstname: string;
}

export interface RouteSheetTable {
  table_number: number;
  seats: RouteSheetSeat[];
}

export interface RouteSheetRound {
  round_number: number;
  coef: string | number;
  tables: RouteSheetTable[];
}

export interface RouteSheet {
  tournament: {
    id: number;
    code: string;
    name: string;
    date: string | null;
  };
  sub_tournament: {
    id: number;
    label: string;
    color: string | null;
    color_name: string | null;
  };
  rounds: RouteSheetRound[];
}
