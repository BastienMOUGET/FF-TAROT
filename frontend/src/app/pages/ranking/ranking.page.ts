import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { SocketService } from '../../core/socket.service';
import { RankingDetailEntry, RankingEntry } from '../../core/api.types';
import { ClubLogo } from '../../shared/club-logo';

@Component({
  selector: 'app-ranking-page',
  imports: [
    DatePipe,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    RouterLink,
    ClubLogo,
  ],
  template: `
    <div class="toolbar no-print">
      <button type="button" class="back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Retour
      </button>
      <!-- Consulter un classement au milieu d'une soirée ne doit pas coûter
           un détour par la page du tournoi : on repart droit sur la manche
           en cours de saisie (retour terrain n°15). -->
      @if (resumeRound(); as r) {
        <a
          mat-flat-button
          color="primary"
          [routerLink]="['/rounds', r.id]"
          class="resume"
        >
          <mat-icon>edit_note</mat-icon> Reprendre la manche {{ r.round_number }}
        </a>
      }
      <span class="spacer"></span>
      <button mat-flat-button color="primary" (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
      <button mat-stroked-button (click)="pdf()">
        <mat-icon>picture_as_pdf</mat-icon> PDF
      </button>
      <button mat-stroked-button (click)="mail()" title="Ouvre un brouillon Gmail, à compléter avec le PDF enregistré">
        <mat-icon>mail</mat-icon> Envoyer
      </button>
      <button
        mat-stroked-button
        (click)="exportPcn()"
        title="Fichier CSV au format du masque fédéral (licence, nom, prénom, PCN, PP)"
      >
        <mat-icon>table_view</mat-icon> Export FFT
      </button>
    </div>

    <mat-card class="head">
      <mat-card-header>
        <mat-card-title>Classement général du tournoi</mat-card-title>
        <mat-card-subtitle>
          <!-- Statut de la mise à jour automatique du classement, pas un
               bouton de connexion : le libellé le disait mal. -->
          <mat-chip
            [color]="socket.connected() ? 'primary' : undefined"
            [title]="
              socket.connected()
                ? 'Le classement se met à jour tout seul quand une table est validée'
                : 'Mise à jour automatique indisponible : rechargez la page après avoir validé une table'
            "
          >
            <mat-icon>{{ socket.connected() ? 'sync' : 'sync_disabled' }}</mat-icon>
            {{ socket.connected() ? 'Mise à jour automatique' : 'Rafraîchir à la main' }}
          </mat-chip>
          @if (lastUpdate()) {
            <span class="updated">
              MAJ : {{ lastUpdate() | date: 'HH:mm:ss' }}
            </span>
          }
        </mat-card-subtitle>
      </mat-card-header>
    </mat-card>

    <div class="print-head">
      <app-club-logo [subTournamentId]="subTournamentId()" [size]="56" />
      <h1>
        Classement général
        @if (throughRound()) {
          après la manche {{ throughRound() }}
        }
        du tournoi
      </h1>
    </div>

    @if (!loading() && ranking().length > 0 && noPcn()) {
      <p class="warn no-print">
        PCN non calculés : l'indice PCN de ce tournoi est à 0. Il se règle à
        la création du tournoi (ou dans ses réglages) ; le classement se
        recalcule ensuite tout seul.
      </p>
    }

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (ranking().length === 0) {
      <p class="empty">Aucun joueur classé pour l'instant.</p>
    } @else {
      <table mat-table [dataSource]="ranking()" class="mat-elevation-z2">
        <ng-container matColumnDef="place">
          <th mat-header-cell *matHeaderCellDef>Place</th>
          <td mat-cell *matCellDef="let r" class="place">{{ r.place }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Joueur</th>
          <td mat-cell *matCellDef="let r">
            {{ r.name }} {{ r.firstname }}
            @if (r.licence) {
              <small class="lic">({{ r.licence }})</small>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="rounds">
          <th mat-header-cell *matHeaderCellDef class="num">Manches</th>
          <td mat-cell *matCellDef="let r" class="num">{{ r.rounds_played }}</td>
        </ng-container>
        <!-- Une colonne par manche : le récapitulatif que le club lisait
             sur son tableur (retour terrain n°10). -->
        @for (rd of detailRounds(); track rd.round_number) {
          <ng-container [matColumnDef]="'m' + rd.round_number">
            <th mat-header-cell *matHeaderCellDef class="num">M{{ rd.round_number }}</th>
            <td mat-cell *matCellDef="let r" class="num manche">
              {{ scoreOf(r, $index) }}
            </td>
          </ng-container>
        }
        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef class="num">Total</th>
          <td mat-cell *matCellDef="let r" class="num">{{ r.total }}</td>
        </ng-container>
        <ng-container matColumnDef="general">
          <th mat-header-cell *matHeaderCellDef class="num">
            {{ hasPenalties() ? 'Général' : 'Total' }}
          </th>
          <td mat-cell *matCellDef="let r" class="num strong">
            {{ r.total_general }}
          </td>
        </ng-container>
        <ng-container matColumnDef="pcn">
          <th mat-header-cell *matHeaderCellDef class="num">PCN</th>
          <td mat-cell *matCellDef="let r" class="num">{{ r.pcn }}</td>
        </ng-container>
        <ng-container matColumnDef="pp">
          <th mat-header-cell *matHeaderCellDef class="num">PP</th>
          <td mat-cell *matCellDef="let r" class="num">{{ r.pp }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols()"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: cols()"
          [class.podium-1]="row.place === 1"
          [class.positive]="row.place !== 1 && +row.total_general >= 0"
        ></tr>
      </table>
    }
  `,
  styles: `
    .print-head { display: flex; align-items: center; gap: 16px; margin: 0 0 12px; }
    .print-head h1 { margin: 0; }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 16px;
      text-decoration: none;
      color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .spacer { flex: 1 1 auto; }
    .resume { margin-left: 8px; }
    .head { margin-bottom: 24px; }
    .updated { margin-left: 12px; color: #757575; font-size: 0.85em; }
    table { width: 100%; }
    .num { text-align: right; }
    .place { font-weight: 600; }
    .strong { font-weight: 600; }
    .manche { color: #424242; }
    .lic { color: #757575; }
    .empty { color: #757575; }
    .warn { color: #e65100; font-weight: 500; margin: 0 0 12px; }
    /* Retour terrain : le 1er en couleur, et tous les scores >= 0. */
    .podium-1 { background: rgba(255, 215, 0, 0.35) !important; font-weight: 700; }
    .positive { background: rgba(129, 199, 132, 0.18) !important; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      .back, .head, .toolbar { display: none !important; }
      /* 37 joueurs tenaient sur 4 pages : lignes resserrées. */
      table { font-size: 9pt; }
      th, td { padding: 1px 6px !important; line-height: 1.15; }
      .print-head h1 { font-size: 14pt; margin: 0 0 4px; }
      .print-head { gap: 10px; margin-bottom: 6px; }
      .lic { display: none; }
      tr { page-break-inside: avoid; }
      .podium-1 { background: #ffe082 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .positive { background: #dcedc8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `,
})
export class RankingPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  protected socket = inject(SocketService);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  ranking = signal<RankingEntry[]>([]);
  subTournamentId = signal<number>(0);
  throughRound = signal<number | null>(null);
  lastUpdate = signal<Date | null>(null);

  // Manche encore en saisie : la première dont toutes les tables ne sont pas
  // validées. Si tout est validé, la dernière — c'est là qu'on revient.
  resumeRound = signal<{ id: number; round_number: number } | null>(null);

  detailRounds = signal<{ id: number; round_number: number }[]>([]);
  // Les colonnes de manches se glissent entre « Manches » et « Total ».
  // « Total » et « Général » ne diffèrent que si une pénalité s'applique :
  // sans pénalité, les deux colonnes affichaient la même chose.
  // Aucun PCN attribué alors que des joueurs sont classés : l'indice PCN du
  // tournoi vaut 0 (retour terrain n°13 : « les PCN ne sont pas calculés »).
  noPcn = computed(
    () => !this.throughRound() && this.ranking().every((r) => Number(r.pcn) === 0)
  );
  hasPenalties = computed(() =>
    this.ranking().some((r) => Number(r.total) !== Number(r.total_general))
  );
  cols = computed(() => [
    'place',
    'name',
    'rounds',
    ...this.detailRounds().map((r) => 'm' + r.round_number),
    ...(this.hasPenalties() ? ['total'] : []),
    'general',
    'pcn',
    'pp',
  ]);

  // Score du joueur sur la i-ème manche affichée.
  scoreOf(row: RankingEntry, i: number): string {
    const rounds = (row as RankingDetailEntry).rounds;
    const v = rounds?.[i];
    return v === null || v === undefined ? '' : String(v);
  }

  constructor() {
    // React to live ranking updates from socket
    effect(() => {
      const ev = this.socket.lastRanking();
      if (ev && !this.throughRound() && ev.sub_tournament_id === this.subTournamentId()) {
        this.ranking.set(ev.ranking);
        this.lastUpdate.set(new Date());
      }
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.subTournamentId.set(id);
    const through = Number(this.route.snapshot.queryParamMap.get('through'));
    this.throughRound.set(through > 0 ? through : null);
    // Un classement arrêté à une manche est figé : pas de suivi live.
    if (!this.throughRound()) this.socket.connect();

    this.api.subTournament(id).subscribe({
      next: (sub) => {
        document.title = `Classement ${sub.label} — PABB90`;
      },
      error: () => {},
    });
    this.findResumeRound(id);
    // Le détail par manche vaut aussi pour un classement arrêté à la manche
    // N : il ne montre alors que les manches 1..N (retour terrain n°13).
    this.api.rankingDetail(id, this.throughRound() ?? undefined).subscribe({
      next: (d) => {
        this.detailRounds.set(d.rounds);
        this.ranking.set(d.ranking);
        this.lastUpdate.set(new Date());
        this.loading.set(false);
      },
      // Serveur plus ancien ou erreur : on retombe sur le classement simple.
      error: () =>
        this.api.ranking(id, this.throughRound() ?? undefined).subscribe({
          next: (r) => {
            this.ranking.set(r);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        }),
    });
  }

  ngOnDestroy(): void {
    // Keep socket alive for other pages — don't disconnect here.
  }

  print(): void {
    window.print();
  }

  // PDF via la fenêtre d'impression du navigateur (« Enregistrer au format PDF »).
  pdf(): void {
    this.snack.open(
      'Dans la fenêtre qui s’ouvre, choisissez « Enregistrer au format PDF » comme imprimante.',
      'OK',
      { duration: 6000 }
    );
    setTimeout(() => window.print(), 400);
  }

  // Aucun navigateur ne sait joindre un fichier à un brouillon Gmail : on
  // ouvre le brouillon avec l'objet et le texte déjà écrits, l'utilisateur
  // y glisse le PDF qu'il vient d'enregistrer (retour terrain n°11).
  mail(): void {
    const sujet = document.title || 'Classement PABB90';
    const corps =
      'Bonjour,\n\nVous trouverez ci-joint le classement.\n\n' +
      '(PDF à joindre : celui enregistré depuis le bouton PDF.)\n';
    const url =
      'https://mail.google.com/mail/?view=cm&fs=1&su=' +
      encodeURIComponent(sujet) +
      '&body=' +
      encodeURIComponent(corps);
    this.snack.open(
      'Brouillon Gmail ouvert : joignez-y le PDF enregistré depuis le bouton PDF.',
      'OK',
      { duration: 7000 }
    );
    window.open(url, '_blank', 'noopener');
  }

  private findResumeRound(subTournamentId: number): void {
    this.api.rounds(subTournamentId).subscribe({
      next: (rounds) => {
        if (rounds.length === 0) return;
        const ordered = [...rounds].sort(
          (a, b) => a.round_number - b.round_number
        );
        // On interroge les manches une à une et on garde la première
        // incomplète ; à défaut, la dernière.
        let pending = ordered.length;
        const open: { id: number; round_number: number }[] = [];
        const settle = () => {
          if (--pending > 0) return;
          open.sort((a, b) => a.round_number - b.round_number);
          const last = ordered[ordered.length - 1];
          const pick = open.length > 0 ? open[0] : last;
          this.resumeRound.set({
            id: pick.id,
            round_number: pick.round_number,
          });
        };
        for (const r of ordered) {
          this.api.tableResults(r.id).subscribe({
            next: (results) => {
              const done =
                results.length > 0 && results.every((t) => !!t.validated);
              if (!done) open.push(r);
              settle();
            },
            error: () => settle(),
          });
        }
      },
      error: () => {},
    });
  }

  // Le CSV au masque fédéral existait côté serveur depuis la v3.0.30 mais
  // aucun bouton ne l'appelait : il était inatteignable.
  exportPcn(): void {
    this.api.exportPcn(this.subTournamentId()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `classement-fft-${this.subTournamentId()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.snack.open(
          'Fichier CSV enregistré : à coller dans la feuille « Masque » du classeur fédéral.',
          'OK',
          { duration: 6000 }
        );
      },
      error: () =>
        this.snack.open("L'export a échoué", 'Fermer', { duration: 4000 }),
    });
  }

  goBack(): void {
    this.location.back();
  }
}
