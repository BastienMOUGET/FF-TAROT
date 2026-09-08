import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { RoundRanking } from '../../core/api.types';
import { ClubLogo } from '../../shared/club-logo';

// Classement d'UNE manche : ce que le club affiche / imprime après chaque
// manche (4 par soirée). Le 1er est mis en relief. Les tables pas encore
// validées apparaissent en fin de liste, sans place.
@Component({
  selector: 'app-round-ranking-page',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ClubLogo,
  ],
  template: `
    <div class="no-print toolbar">
      @if (rk(); as r) {
        <a [routerLink]="['/sub-tournaments', r.sub_tournament_id]" class="back">
          <mat-icon>arrow_back</mat-icon> Retour au tournoi
        </a>
        <a mat-stroked-button [routerLink]="['/rounds', r.round_id]">
          <mat-icon>edit</mat-icon> Saisie des tables
        </a>
        <a mat-stroked-button [routerLink]="['/sub-tournaments', r.sub_tournament_id, 'ranking']">
          <mat-icon>leaderboard</mat-icon> Classement général
        </a>
      }
      <span class="spacer"></span>
      <button mat-flat-button color="primary" (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
      <button mat-stroked-button (click)="pdf()">
        <mat-icon>picture_as_pdf</mat-icon> PDF
      </button>
    </div>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (rk(); as r) {
      <div class="sheet">
        <div class="print-head">
          <app-club-logo [subTournamentId]="r.sub_tournament_id" [size]="56" />
          <h1>Classement de la manche {{ r.round_number }}</h1>
        </div>
        @if (pendingCount() > 0) {
          <p class="warn no-print">
            {{ pendingCount() }} joueur(s) sur une table non validée : le
            classement est provisoire.
          </p>
        }
        <table>
          <thead>
            <tr>
              <th class="num">Place</th>
              <th>Joueur</th>
              <th class="num">Table</th>
              <th class="num">Orient.</th>
              <th class="num">Score</th>
            </tr>
          </thead>
          <tbody>
            @for (e of r.ranking; track e.player_id) {
              <tr
                [class.first]="e.place === 1"
                [class.positive]="e.score !== null && e.score >= 0"
                [class.pending]="e.place === 0"
              >
                <td class="num">{{ e.place > 0 ? e.place : '—' }}</td>
                <td>
                  {{ e.name }} {{ e.firstname }}
                  @if (!e.validated && e.score !== null) {
                    <small class="tag">non validé</small>
                  }
                </td>
                <td class="num">{{ e.table_number }}</td>
                <td class="num"><span class="seat" [attr.data-seat]="e.seat">{{ e.seat }}</span></td>
                <td class="num score">{{ e.score !== null ? e.score : '' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .print-head { display: flex; align-items: center; gap: 16px; margin: 0 0 12px; }
    .print-head h1 { margin: 0; }
    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .back { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; color: #1976d2; }
    .spacer { flex: 1 1 auto; }
    .warn { color: #e65100; font-weight: 500; }
    .sheet { background: #fff; padding: 8px 0; }
    h1 { font-size: 1.5em; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 1.05em; }
    th, td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; text-align: left; }
    th { background: #f5f5f5; }
    .num { text-align: right; width: 70px; }
    .score { font-weight: 600; }
    tr.first td { background: rgba(255, 215, 0, 0.3); font-weight: 700; }
    tr.positive td { background: rgba(129, 199, 132, 0.18); }
    tr.pending td { color: #9e9e9e; font-style: italic; }
    .tag { color: #e65100; margin-left: 6px; }
    .seat {
      display: inline-block; min-width: 22px; padding: 0 4px; border-radius: 4px;
      text-align: center; font-weight: 700; font-size: 0.9em;
    }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    @media print {
      .no-print { display: none !important; }
      table { font-size: 12pt; }
      th, td { padding: 3px 8px; }
      tr.first td { background: #ffe082 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `,
})
export class RoundRankingPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  rk = signal<RoundRanking | null>(null);
  pendingCount = signal(0);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.roundRanking(id).subscribe({
      next: (r) => {
        this.rk.set(r);
        this.pendingCount.set(r.ranking.filter((e) => !e.validated).length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  print(): void {
    window.print();
  }

  pdf(): void {
    this.snack.open(
      'Dans la fenêtre qui s’ouvre, choisissez « Enregistrer au format PDF » comme imprimante.',
      'OK',
      { duration: 6000 }
    );
    setTimeout(() => window.print(), 400);
  }
}
