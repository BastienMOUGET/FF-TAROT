import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api.service';
import { RouteSheet, RouteSheetSeat, Seat } from '../../core/api.types';

// Feuille de placement : affichée / imprimée en début de tournoi pour que
// chaque joueur trouve sa table et son orientation de départ. Une seule
// page, un tableau dense « Table | Nord | Sud | Est | Ouest », noms en gros
// et en gras (retour terrain).
@Component({
  selector: 'app-route-sheet-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="no-print toolbar">
      <button type="button" class="back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Retour
      </button>
      @if (sheet()?.rounds?.length ?? 0 > 1) {
        <label class="pick">
          Manche :
          <select [value]="roundFilter()" (change)="roundFilter.set(+$any($event.target).value)">
            <option [value]="0">toutes</option>
            @for (r of sheet()!.rounds; track r.round_number) {
              <option [value]="r.round_number">{{ r.round_number }}</option>
            }
          </select>
        </label>
      }
      <span class="spacer"></span>
      <button mat-flat-button color="primary" (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
    </div>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (sheet(); as s) {
      <div class="sheet">
        <header>
          <h1>{{ s.tournament.name }} — {{ s.sub_tournament.label }}</h1>
          <p class="meta">
            Placement de départ
            @if (s.tournament.date) {
              · {{ s.tournament.date | date: 'dd/MM/yyyy' }}
            }
          </p>
        </header>

        @if (s.rounds.length === 0) {
          <p class="empty">Aucune manche générée pour le moment.</p>
        }

        @for (r of visibleRounds(); track r.round_number) {
          <section class="round">
            <h2>Manche {{ r.round_number }}</h2>
            @if (r.tables.length === 0) {
              <p class="empty">Pas de mise en place sur cette manche.</p>
            } @else {
              <table>
                <thead>
                  <tr>
                    <th class="tnum">Table</th>
                    @for (seat of seats; track seat) {
                      <th><span class="seat" [attr.data-seat]="seat">{{ seatLabel(seat) }}</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (t of r.tables; track t.table_number) {
                    <tr>
                      <td class="tnum">{{ t.table_number }}</td>
                      @for (seat of seats; track seat) {
                        <td class="player" [class.empty-seat]="!playerAt(t.seats, seat)">
                          {{ playerAt(t.seats, seat) || '—' }}
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>
        }

        <footer class="no-print">
          <small>Imprimé le {{ now() | date: 'dd/MM/yyyy à HH:mm' }} via PABB90</small>
        </footer>
      </div>
    }
  `,
  styles: `
    .toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .back {
      display: inline-flex; align-items: center; gap: 4px; color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .pick select { margin-left: 6px; font-size: 1em; }
    .spacer { flex: 1 1 auto; }
    .empty { color: #757575; }
    .sheet { background: #fff; max-width: 1100px; margin: 0 auto; padding: 16px 24px; }
    header h1 { margin: 0 0 2px; font-size: 1.5em; color: #0d47a1; }
    header .meta { margin: 0 0 12px; color: #424242; }
    .round h2 {
      margin: 16px 0 8px; padding-bottom: 2px;
      border-bottom: 2px solid #1976d2; color: #0d47a1; font-size: 1.2em;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #9e9e9e; padding: 5px 8px; text-align: left; }
    th { background: #f5f5f5; }
    .tnum { width: 60px; text-align: center; font-weight: 700; font-size: 1.2em; }
    .player { font-weight: 700; font-size: 1.15em; }
    .empty-seat { color: #9e9e9e; font-weight: 400; text-align: center; }
    .seat { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    @media print {
      .no-print { display: none !important; }
      .sheet { padding: 0; max-width: none; }
      header h1 { font-size: 16pt; }
      .round h2 { font-size: 13pt; margin-top: 10px; }
      table { font-size: 12pt; }
      .player { font-size: 13pt; }
      th, td { padding: 3px 6px; }
      .round { page-break-inside: avoid; }
      .seat { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `,
})
export class RouteSheetPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(true);
  sheet = signal<RouteSheet | null>(null);
  // 0 = toutes les manches ; par défaut la 1re (placement de départ).
  roundFilter = signal(1);
  seats: Seat[] = ['N', 'S', 'E', 'O'];
  now = () => new Date();

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.routeSheet(id).subscribe({
      next: (s) => {
        this.sheet.set(s);
        if (!s.rounds.some((r) => r.round_number === 1)) this.roundFilter.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  visibleRounds() {
    const s = this.sheet();
    if (!s) return [];
    const f = this.roundFilter();
    return f === 0 ? s.rounds : s.rounds.filter((r) => r.round_number === f);
  }

  seatLabel(seat: Seat): string {
    return { N: 'Nord', S: 'Sud', E: 'Est', O: 'Ouest' }[seat];
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
