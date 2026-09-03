import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api.service';
import { RouteSheet } from '../../core/api.types';

@Component({
  selector: 'app-route-sheet-page',
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="no-print toolbar">
      <button type="button" class="back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Retour
      </button>
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
          <h1>{{ s.tournament.name }}</h1>
          <p class="meta">
            <strong>{{ s.tournament.code }}</strong>
            @if (s.tournament.date) {
              · {{ s.tournament.date | date: 'dd/MM/yyyy' }}
            }
            · Sous-tournoi : <strong>{{ s.sub_tournament.label }}</strong>
            @if (s.sub_tournament.color_name) {
              ({{ s.sub_tournament.color_name }})
            }
          </p>
        </header>

        @if (s.rounds.length === 0) {
          <p class="empty">Aucune manche générée pour le moment.</p>
        }

        @for (r of s.rounds; track r.round_number) {
          <section class="round">
            <h2>Manche {{ r.round_number }}</h2>
            @if (r.tables.length === 0) {
              <p class="empty">Pas de mise en place sur cette manche.</p>
            } @else {
              <div class="tables">
                @for (t of r.tables; track t.table_number) {
                  <div class="table-card">
                    <div class="table-header">Table {{ t.table_number }}</div>
                    <table>
                      <tbody>
                        @for (seat of t.seats; track seat.seat) {
                          <tr>
                            <td class="seat" [attr.data-seat]="seat.seat">
                              {{ seat.seat }}
                            </td>
                            <td class="player">
                              {{ seat.name }} {{ seat.firstname }}
                              @if (seat.licence) {
                                <small class="licence">({{ seat.licence }})</small>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </section>
        }

        <footer class="no-print">
          <small>
            Imprimé le {{ now() | date: 'dd/MM/yyyy à HH:mm' }} via PABB90
          </small>
        </footer>
      </div>
    }
  `,
  styles: `
    .toolbar {
      display: flex; align-items: center; gap: 16px; margin-bottom: 24px;
    }
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      text-decoration: none; color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .spacer { flex: 1 1 auto; }
    .empty { color: #757575; }

    .sheet {
      background: #fff;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    header h1 {
      margin: 0 0 4px;
      font-size: 1.6em;
      color: #0d47a1;
    }
    header .meta { margin: 0 0 24px; color: #424242; }

    .round h2 {
      margin: 24px 0 12px;
      padding-bottom: 4px;
      border-bottom: 2px solid #1976d2;
      color: #0d47a1;
    }

    .tables {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .table-card {
      border: 1px solid #bdbdbd;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .table-header {
      background: #1976d2;
      color: #fff;
      padding: 6px 12px;
      font-weight: 600;
    }
    .table-card table {
      width: 100%;
      border-collapse: collapse;
    }
    .table-card td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
    }
    .table-card tr:last-child td { border-bottom: none; }
    .seat {
      width: 30px;
      text-align: center;
      font-weight: 700;
      color: #fff;
    }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    .player .licence { color: #757575; }

    @media print {
      .no-print { display: none !important; }
      .sheet { padding: 0; }
      .round { page-break-inside: avoid; }
      .tables { gap: 8px; }
    }
  `,
})
export class RouteSheetPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  loading = signal(true);
  sheet = signal<RouteSheet | null>(null);
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

  print(): void {
    window.print();
  }

  goBack(): void {
    this.location.back();
  }
}
