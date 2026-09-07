import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe, Location } from '@angular/common';

import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api.service';
import { SocketService } from '../../core/socket.service';
import { RankingEntry } from '../../core/api.types';

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
  ],
  template: `
    <button type="button" class="back" (click)="goBack()">
      <mat-icon>arrow_back</mat-icon> Retour
    </button>

    <mat-card class="head">
      <mat-card-header>
        <mat-card-title>Classement général du tournoi</mat-card-title>
        <mat-card-subtitle>
          <mat-chip [color]="socket.connected() ? 'primary' : 'warn'">
            <mat-icon>{{
              socket.connected() ? 'wifi' : 'wifi_off'
            }}</mat-icon>
            {{ socket.connected() ? 'Connecté' : 'Déconnecté' }}
          </mat-chip>
          @if (lastUpdate()) {
            <span class="updated">
              MAJ : {{ lastUpdate() | date: 'HH:mm:ss' }}
            </span>
          }
        </mat-card-subtitle>
      </mat-card-header>
    </mat-card>

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
        <ng-container matColumnDef="total">
          <th mat-header-cell *matHeaderCellDef class="num">Total</th>
          <td mat-cell *matCellDef="let r" class="num">{{ r.total }}</td>
        </ng-container>
        <ng-container matColumnDef="general">
          <th mat-header-cell *matHeaderCellDef class="num">Général</th>
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
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: cols"
          [class.podium-1]="row.place === 1"
          [class.positive]="row.place !== 1 && +row.total_general > 0"
        ></tr>
      </table>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 16px;
      text-decoration: none;
      color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .head { margin-bottom: 24px; }
    .updated { margin-left: 12px; color: #757575; font-size: 0.85em; }
    table { width: 100%; }
    .num { text-align: right; }
    .place { font-weight: 600; }
    .strong { font-weight: 600; }
    .lic { color: #757575; }
    .empty { color: #757575; }
    /* Retour terrain : le 1er en couleur, et tous les scores positifs. */
    .podium-1 { background: rgba(255, 215, 0, 0.35) !important; font-weight: 700; }
    .positive { background: rgba(129, 199, 132, 0.18) !important; }
    @media print {
      .back, .head { display: none !important; }
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

  loading = signal(true);
  ranking = signal<RankingEntry[]>([]);
  subTournamentId = signal<number>(0);
  lastUpdate = signal<Date | null>(null);

  cols = ['place', 'name', 'rounds', 'total', 'general', 'pcn', 'pp'];

  constructor() {
    // React to live ranking updates from socket
    effect(() => {
      const ev = this.socket.lastRanking();
      if (ev && ev.sub_tournament_id === this.subTournamentId()) {
        this.ranking.set(ev.ranking);
        this.lastUpdate.set(new Date());
      }
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.subTournamentId.set(id);
    this.socket.connect();

    this.api.ranking(id).subscribe({
      next: (r) => {
        this.ranking.set(r);
        this.lastUpdate.set(new Date());
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    // Keep socket alive for other pages — don't disconnect here.
  }

  goBack(): void {
    this.location.back();
  }
}
