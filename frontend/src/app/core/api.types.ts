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
}

export interface Player {
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
}

export type Pair = 'NS' | 'EO';

export interface TeamPlayer {
  team_id?: number;
  player_id: number;
  pair: Pair;
  player_number: number;
  licence: string | null;
  name: string;
  firstname: string;
  club_id: number | null;
  category: string | null;
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
  total: string;
  total_general: string;
  place: number;
  pcn: string;
  pp: string;
  eliminated: 0 | 1 | boolean;
  updated_at: string;
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
