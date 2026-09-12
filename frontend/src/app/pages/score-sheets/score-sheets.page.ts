import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api.service';
import { RouteSheet, RouteSheetSeat, Seat } from '../../core/api.types';

// Feuilles de marque : une par table et par manche, remplies à la main par
// le joueur en Nord pendant le jeu, puis recopiées dans la saisie.
// Format du club : bandeau « NOSE » pour suivre le donneur, colonne
// « Preneur & Contrat », deux colonnes par orientation (« + » et « − »),
// une ligne Total puis le total général. Deux feuilles par page A4 pour ne
// pas imprimer 32 pages une soirée de 8 tables.
@Component({
  selector: 'app-score-sheets-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="no-print toolbar">
      <button type="button" class="back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Retour
      </button>
      <label class="pick">
        Manche :
        <select [value]="roundFilter()" (change)="roundFilter.set(+$any($event.target).value)">
          <option [value]="0">toutes</option>
          @for (r of sheet()?.rounds || []; track r.round_number) {
            <option [value]="r.round_number">{{ r.round_number }}</option>
          }
        </select>
      </label>
      <label class="pick">
        Donnes par manche :
        <input type="number" min="1" max="12" [value]="nbDonnes()" (input)="setDonnes($any($event.target).value)" />
      </label>
      <span class="spacer"></span>
      <span class="count">{{ sheetCount() }} feuille(s) · {{ pageCount() }} page(s)</span>
      <button mat-flat-button color="primary" (click)="print()">
        <mat-icon>print</mat-icon> Imprimer
      </button>
    </div>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (sheet(); as s) {
      @if (sheetCount() === 0) {
        <p class="empty">Aucune manche générée : rien à imprimer.</p>
      }
      <div class="sheets">
        @for (r of visibleRounds(); track r.round_number) {
          @for (t of r.tables; track t.table_number) {
            <section class="sheet">
              <header>
                <div class="title">{{ s.tournament.name }} — {{ s.sub_tournament.label }}</div>
                <div class="where">
                  <span class="big">Manche {{ r.round_number }}</span>
                  <span class="big">Table {{ t.table_number }}</span>
                </div>
              </header>
              <!-- Suite des orientations : le responsable de table y marque
                   le prochain donneur (usage du club). -->
              <div class="nose">{{ noseLine }}</div>
              <table>
                <thead>
                  <tr>
                    <th class="donne" rowspan="2">Donne</th>
                    <th class="taker" rowspan="2">Preneur &amp; Contrat</th>
                    @for (seat of seats; track seat) {
                      <th class="orient" colspan="2" [class.empty-seat]="!playerAt(t.seats, seat)">
                        <span class="seat" [attr.data-seat]="seat">{{ seat }}</span>
                        <span class="name">{{ playerAt(t.seats, seat) || '—' }}</span>
                      </th>
                    }
                  </tr>
                  <tr>
                    @for (seat of seats; track seat) {
                      <th class="sign" [class.empty-seat]="!playerAt(t.seats, seat)">+</th>
                      <th class="sign" [class.empty-seat]="!playerAt(t.seats, seat)">−</th>
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
                        <td [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                      }
                    </tr>
                  }
                  <tr class="sub">
                    <td class="donne" colspan="2">Total</td>
                    @for (seat of seats; track seat) {
                      <td [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                      <td [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                    }
                  </tr>
                  <tr class="total">
                    <td class="donne" colspan="2">TOTAL GÉNÉRAL</td>
                    @for (seat of seats; track seat) {
                      <td colspan="2" [class.empty-seat]="!playerAt(t.seats, seat)"></td>
                    }
                  </tr>
                </tbody>
              </table>
              <footer>
                Nord tient la feuille · la somme des totaux généraux doit faire 0 ·
                {{ now() | date: 'dd/MM/yyyy' }}
              </footer>
            </section>
          }
        }
      </div>
    }
  `,
  styles: `
    .toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .back {
      display: inline-flex; align-items: center; gap: 4px; color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .pick input { width: 60px; margin-left: 6px; }
    .pick select { margin-left: 6px; font-size: 1em; }
    .spacer { flex: 1 1 auto; }
    .count { color: #757575; font-size: 0.9em; }
    .empty { color: #757575; }

    .sheet {
      background: #fff; border: 1px solid #bdbdbd; border-radius: 6px;
      padding: 12px 16px; margin-bottom: 16px; max-width: 900px;
    }
    header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
    .title { font-size: 1em; color: #424242; }
    .where { display: flex; gap: 20px; }
    .big { font-size: 1.4em; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #616161; padding: 4px; }
    th { background: #f5f5f5; }
    th.orient { text-align: center; }
    th.orient .name { display: block; font-size: 1em; font-weight: 700; margin-top: 2px; min-height: 1.1em; }
    th.sign { text-align: center; font-size: 0.95em; width: 11%; }
    td { height: 30px; }
    .donne { width: 58px; text-align: center; font-weight: 600; }
    .taker { width: 74px; }
    .empty-seat { background: repeating-linear-gradient(45deg, #eee, #eee 4px, #fff 4px, #fff 8px); }
    .nose {
      font-family: monospace; font-size: 0.95em; letter-spacing: 1px;
      border: 1px solid #616161; border-bottom: none; padding: 3px 6px;
      overflow: hidden; white-space: nowrap; color: #424242;
    }
    tr.sub td { background: #fafafa; font-weight: 600; }
    tr.total td { font-weight: 700; background: #f0f0f0; height: 36px; }
    .seat {
      display: inline-block; min-width: 24px; padding: 1px 6px; border-radius: 4px; font-weight: 700;
    }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    footer { margin-top: 4px; color: #757575; font-size: 0.8em; text-align: right; }

    /* Impression : deux feuilles par page A4. Chaque feuille tient dans une
       demi-page ; la coupure de page tombe après la seconde. */
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      .no-print { display: none !important; }
      .sheet {
        border: none; margin: 0; max-width: none; padding: 0 0 4mm;
        height: 138mm; box-sizing: border-box; overflow: hidden;
        page-break-inside: avoid; break-inside: avoid;
      }
      .sheet:nth-child(even) {
        border-top: 1px dashed #9e9e9e; padding-top: 4mm;
        page-break-after: always; break-after: page;
      }
      .sheet:last-child { page-break-after: auto; break-after: auto; }
      table { font-size: 10pt; }
      td { height: 7.5mm; }
      tr.total td { height: 9mm; }
      th, td { padding: 1px 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .big { font-size: 12pt; }
      .title { font-size: 9pt; }
      footer { font-size: 7pt; }
      .nose { font-size: 8pt; letter-spacing: 0.5px; padding: 1px 3px; }
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
  // 0 = toutes les manches. Par défaut la manche 1 : en placement par
  // niveau, les suivantes ne sont connues qu'après coup.
  roundFilter = signal(1);
  seats: Seat[] = ['N', 'S', 'E', 'O'];
  // Bandeau « NOSE » répété : le joueur en charge de la table entoure la
  // lettre du prochain donneur, donne après donne.
  noseLine = 'NOSE'.repeat(14);
  now = () => new Date();

  visibleRounds = computed(() => {
    const s = this.sheet();
    if (!s) return [];
    const f = this.roundFilter();
    return f === 0 ? s.rounds : s.rounds.filter((r) => r.round_number === f);
  });
  sheetCount = computed(() =>
    this.visibleRounds().reduce((n, r) => n + r.tables.length, 0)
  );
  pageCount = computed(() => Math.ceil(this.sheetCount() / 2));

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
