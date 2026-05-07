import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  Club, Comite, DonneSet, Hand, Ligue, MovementPattern, Pair, Penalty,
  PenaltyType, Player, PpEntry, RankingEntry, Round, Seat, SubTournament,
  TableResult, Team, Tournament, User,
} from './api.types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  /* ----- Référentiel ----- */
  ligues = (): Observable<Ligue[]> =>
    this.http.get<Ligue[]>(`${this.base}/ligues`);
  comites = (): Observable<Comite[]> =>
    this.http.get<Comite[]>(`${this.base}/comites`);
  clubs = (): Observable<Club[]> =>
    this.http.get<Club[]>(`${this.base}/clubs`);
  players = (q?: { search?: string; club_id?: number }): Observable<Player[]> => {
    const params: Record<string, string> = {};
    if (q?.search) params['search'] = q.search;
    if (q?.club_id) params['club_id'] = String(q.club_id);
    return this.http.get<Player[]>(`${this.base}/players`, { params });
  };
  createPlayer = (data: Partial<Player>): Observable<Player> =>
    this.http.post<Player>(`${this.base}/players`, data);

  /* ----- Tournois ----- */
  tournaments = (): Observable<Tournament[]> =>
    this.http.get<Tournament[]>(`${this.base}/tournaments`);
  tournament = (id: number): Observable<Tournament> =>
    this.http.get<Tournament>(`${this.base}/tournaments/${id}`);
  createTournament = (data: Partial<Tournament>): Observable<Tournament> =>
    this.http.post<Tournament>(`${this.base}/tournaments`, data);
  updateTournament = (id: number, data: Partial<Tournament>): Observable<Tournament> =>
    this.http.put<Tournament>(`${this.base}/tournaments/${id}`, data);
  deleteTournament = (id: number): Observable<void> =>
    this.http.delete<void>(`${this.base}/tournaments/${id}`);

  /* ----- Sub-tournois ----- */
  subTournaments = (tournamentId: number): Observable<SubTournament[]> =>
    this.http.get<SubTournament[]>(
      `${this.base}/tournaments/${tournamentId}/sub-tournaments`
    );
  createSubTournament = (
    tournamentId: number,
    data: Partial<SubTournament>
  ): Observable<SubTournament> =>
    this.http.post<SubTournament>(
      `${this.base}/tournaments/${tournamentId}/sub-tournaments`,
      data
    );

  /* ----- Équipes ----- */
  teams = (subTournamentId: number): Observable<Team[]> =>
    this.http.get<Team[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/teams`
    );
  createTeam = (
    subTournamentId: number,
    players: { player_id: number; pair: Pair }[]
  ): Observable<Team> =>
    this.http.post<Team>(
      `${this.base}/sub-tournaments/${subTournamentId}/teams`,
      { players }
    );
  deleteTeam = (id: number): Observable<void> =>
    this.http.delete<void>(`${this.base}/teams/${id}`);

  /* ----- Rounds ----- */
  rounds = (subTournamentId: number): Observable<Round[]> =>
    this.http.get<Round[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/rounds`
    );
  round = (id: number): Observable<Round> =>
    this.http.get<Round>(`${this.base}/rounds/${id}`);
  createRound = (subTournamentId: number, coef?: number): Observable<Round> =>
    this.http.post<Round>(
      `${this.base}/sub-tournaments/${subTournamentId}/rounds`,
      coef !== undefined ? { coef } : {}
    );
  generatePlacement = (roundId: number): Observable<Round> =>
    this.http.post<Round>(`${this.base}/rounds/${roundId}/generate`, {});
  deleteRound = (id: number): Observable<void> =>
    this.http.delete<void>(`${this.base}/rounds/${id}`);

  /* ----- Scoring ----- */
  tableResults = (roundId: number): Observable<TableResult[]> =>
    this.http.get<TableResult[]>(
      `${this.base}/rounds/${roundId}/table-results`
    );
  tableResult = (roundId: number, tableNumber: number): Observable<TableResult> =>
    this.http.get<TableResult>(
      `${this.base}/rounds/${roundId}/tables/${tableNumber}`
    );
  addHand = (
    roundId: number,
    tableNumber: number,
    hand: Partial<Hand>
  ): Observable<Hand> =>
    this.http.post<Hand>(
      `${this.base}/rounds/${roundId}/tables/${tableNumber}/hands`,
      hand
    );
  updateHand = (id: number, hand: Partial<Hand>): Observable<Hand> =>
    this.http.put<Hand>(`${this.base}/hands/${id}`, hand);
  deleteHand = (id: number): Observable<void> =>
    this.http.delete<void>(`${this.base}/hands/${id}`);
  validateTable = (roundId: number, tableNumber: number): Observable<TableResult> =>
    this.http.post<TableResult>(
      `${this.base}/rounds/${roundId}/tables/${tableNumber}/validate`,
      {}
    );
  unvalidateTable = (roundId: number, tableNumber: number): Observable<TableResult> =>
    this.http.post<TableResult>(
      `${this.base}/rounds/${roundId}/tables/${tableNumber}/unvalidate`,
      {}
    );
  setCodifs = (
    roundId: number,
    tableNumber: number,
    codifs: { codif_n?: string | null; codif_s?: string | null;
              codif_e?: string | null; codif_o?: string | null }
  ): Observable<TableResult> =>
    this.http.put<TableResult>(
      `${this.base}/rounds/${roundId}/tables/${tableNumber}/codifs`,
      codifs
    );

  /* ----- Classement ----- */
  ranking = (subTournamentId: number): Observable<RankingEntry[]> =>
    this.http.get<RankingEntry[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/ranking`
    );
  recomputeRanking = (subTournamentId: number): Observable<RankingEntry[]> =>
    this.http.post<RankingEntry[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/ranking/recompute`,
      {}
    );

  /* ----- Pénalités ----- */
  penaltyTypes = (): Observable<PenaltyType[]> =>
    this.http.get<PenaltyType[]>(`${this.base}/penalty-types`);
  penalties = (tournamentId: number): Observable<Penalty[]> =>
    this.http.get<Penalty[]>(
      `${this.base}/tournaments/${tournamentId}/penalties`
    );
  createPenalty = (tournamentId: number, data: Partial<Penalty>): Observable<Penalty> =>
    this.http.post<Penalty>(
      `${this.base}/tournaments/${tournamentId}/penalties`,
      data
    );
  deletePenalty = (id: number): Observable<void> =>
    this.http.delete<void>(`${this.base}/penalties/${id}`);

  /* ----- Mouvements / PP ----- */
  movementPatterns = (): Observable<MovementPattern[]> =>
    this.http.get<MovementPattern[]>(`${this.base}/movement-patterns`);
  ppGrid = (subTournamentId: number): Observable<PpEntry[]> =>
    this.http.get<PpEntry[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/pp-grid`
    );
  setPpGrid = (subTournamentId: number, entries: PpEntry[]): Observable<PpEntry[]> =>
    this.http.put<PpEntry[]>(
      `${this.base}/sub-tournaments/${subTournamentId}/pp-grid`,
      { entries }
    );

  /* ----- Donnes ----- */
  donneSets = (): Observable<DonneSet[]> =>
    this.http.get<DonneSet[]>(`${this.base}/donne-sets`);
  createDonneSet = (name: string, nbDonne: number): Observable<DonneSet> =>
    this.http.post<DonneSet>(`${this.base}/donne-sets`, {
      name,
      nb_donne: nbDonne,
    });
  donneSet = (id: number, donneNumber: number): Observable<unknown> =>
    this.http.get(`${this.base}/donne-sets/${id}/donnes/${donneNumber}`);

  /* ----- Users (admin) ----- */
  users = (): Observable<User[]> =>
    this.http.get<User[]>(`${this.base}/users`);
  createUser = (data: {
    username: string;
    password: string;
    role: string;
    full_name?: string;
    email?: string;
  }): Observable<User> => this.http.post<User>(`${this.base}/users`, data);

  /* ----- Feuille de route ----- */
  routeSheet = (subTournamentId: number): Observable<unknown> =>
    this.http.get(
      `${this.base}/sub-tournaments/${subTournamentId}/route-sheet`
    );

  /* ----- Export PCN ----- */
  exportPcn = (subTournamentId: number): Observable<Blob> =>
    this.http.get(
      `${this.base}/sub-tournaments/${subTournamentId}/ranking/export-pcn.csv`,
      { responseType: 'blob' }
    );
}
