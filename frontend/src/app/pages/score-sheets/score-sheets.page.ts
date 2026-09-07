import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api.service';
import { RouteSheet, RouteSheetSeat, Seat } from '../../core/api.types';

// Feuilles de marque : une par table et par manche, remplies à la main par
// le joueur en Nord pendant le jeu, puis recopiées dans la saisie. Imprimées
// en début de tournoi pour toutes les manches déjà générées.
@Component({
  selector: 'app-score-sheets-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="no-print toolbar">
      <button type="button" class="back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Retour
      </button>
      <label class="donnes">
        Donnes par manche :
        <input type="number" min="1" max="12" [value]="nbDonnes()" (input)="setDonnes($any($event.target).value)" />
      </label>
      <span class="spacer"></span>
      <button mat-flat-button color="primary" (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
    </div>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (sheet(); as s) {
      @if (s.rounds.length === 0) {
        <p class="empty">Aucune manche générée : rien à imprimer.</p>
      }
      @for (r of s.rounds; track r.round_number) {
        @for (t of r.tables; track t.table_number) {
          <section class="sheet">
            <header>
              <div class="title">{{ s.tournament.name }} — {{ s.sub_tournament.label }}</div>
              <div class="where">
                <span class="big">Manche {{ r.round_number }}</span>
                <span class="big">Table {{ t.table_number }}</span>
              </div>
            </header>
            <table>
              <thead>
                <tr>
                  <th class="donne">Donne</th>
                  <th class="taker">Preneur</th>
                  @for (seat of seats; track seat) {
                    <th>
                      <div class="seat" [attr.data-seat]="seat">{{ seat }}</div>
                      <div class="name">{{ playerAt(t.seats, seat) }}</div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (d of donneRows(); track d) {
                  <tr>
                    <td class="donne">{{ d }}</td>
                    <td class="taker"></td>
                    @for (seat of seats; track seat) {
                      <td [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                    }
                  </tr>
                }
                <tr class="total">
                  <td class="donne" colspan="2">TOTAL (somme = 0)</td>
                  @for (seat of seats; track seat) {
                    <td [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                  }
                </tr>
              </tbody>
            </table>
            <footer>Nord tient la feuille · PABB90 · {{ now() | date: 'dd/MM/yyyy' }}</footer>
          </section>
        }
      }
    }
  `,
  styles: `
    .toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .back {
      display: inline-flex; align-items: center; gap: 4px; color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .donnes input { width: 60px; margin-left: 6px; }
    .spacer { flex: 1 1 auto; }
    .empty { color: #757575; }
    .sheet {
      background: #fff; border: 1px solid #bdbdbd; border-radius: 6px;
      padding: 16px; margin-bottom: 16px; max-width: 900px;
      page-break-after: always; break-after: page;
    }
    header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .title { font-size: 1.1em; color: #424242; }
    .where { display: flex; gap: 24px; }
    .big { font-size: 1.6em; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #616161; padding: 6px; }
    th { background: #f5f5f5; vertical-align: top; }
    th .name { font-size: 1.05em; font-weight: 700; margin-top: 4px; min-height: 1.2em; }
    td { height: 34px; }
    .donne { width: 60px; text-align: center; font-weight: 600; }
    .taker { width: 80px; }
    .empty-seat { background: repeating-linear-gradient(45deg, #eee, #eee 4px, #fff 4px, #fff 8px); }
    tr.total td { font-weight: 700; background: #fafafa; height: 40px; }
    .seat {
      display: inline-block; min-width: 26px; padding: 2px 6px; border-radius: 4px;
      font-weight: 700;
    }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    footer { margin-top: 8px; color: #757575; font-size: 0.85em; text-align: right; }
    @media print {
      .no-print { display: none !important; }
      .sheet { border: none; margin: 0; max-width: none; padding: 0; }
      td { height: 42px; }
      th, td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `,
})
export class ScoreSheetsPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(true);
  sheet = signal<RouteSheet | null>(null);
  nbDonnes = signal(6);
  seats: Seat[] = ['N', 'S', 'E', 'O'];
  now = () => new Date();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.routeSheet(id).subscribe({
      next: (s) => {
        this.sheet.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  donneRows(): number[] {
    return Array.from({ length: this.nbDonnes() }, (_, i) => i + 1);
  }

  setDonnes(v: string): void {
    const n = Math.max(1, Math.min(12, Number(v) || 6));
    this.nbDonnes.set(n);
  }

  playerAt(seats: RouteSheetSeat[], seat: Seat): string {
    const s = seats.find((x) => x.seat === seat);
    return s ? `${s.name} ${s.firstname}` : '';
  }

  print(): void {
    window.print();
  }

  goBack(): void {
    this.location.back();
  }
}
