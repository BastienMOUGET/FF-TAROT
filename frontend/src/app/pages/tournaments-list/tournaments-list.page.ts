import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { Tournament, TournamentStatus } from '../../core/api.types';
import { TournamentDialog } from './tournament-dialog';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-tournaments-list',
  imports: [
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="header">
      <h1>Tournois</h1>
      @if (auth.isAuthenticated()) {
        <button mat-flat-button color="primary" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          Nouveau tournoi
        </button>
      }
    </div>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (tournaments().length === 0) {
      <p class="empty">Aucun tournoi pour le moment.</p>
    } @else {
      <table mat-table [dataSource]="tournaments()" class="mat-elevation-z2">
        <ng-container matColumnDef="code">
          <th mat-header-cell *matHeaderCellDef>Code</th>
          <td mat-cell *matCellDef="let t">{{ t.code }}</td>
        </ng-container>
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nom</th>
          <td mat-cell *matCellDef="let t">{{ t.name }}</td>
        </ng-container>
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let t">
            {{ t.date | date: 'dd/MM/yyyy' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Statut</th>
          <td mat-cell *matCellDef="let t">
            <mat-chip [color]="statusColor(t.status)">{{ t.status }}</mat-chip>
          </td>
        </ng-container>
        <ng-container matColumnDef="club">
          <th mat-header-cell *matHeaderCellDef>Club</th>
          <td mat-cell *matCellDef="let t">{{ t.club_name || '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let t">
            <button
              mat-icon-button
              color="primary"
              (click)="open(t.id)"
              title="Ouvrir"
            >
              <mat-icon>arrow_forward</mat-icon>
            </button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr
          mat-row
          *matRowDef="let row; columns: cols"
          class="clickable"
          (click)="open(row.id)"
        ></tr>
      </table>
    }
  `,
  styles: `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    h1 { margin: 0; }
    .empty { color: #757575; }
    table { width: 100%; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: #f5f5f5; }
    mat-chip { text-transform: capitalize; }
  `,
})
export class TournamentsListPage implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  protected auth = inject(AuthService);

  tournaments = signal<Tournament[]>([]);
  loading = signal(true);

  cols = ['code', 'name', 'date', 'status', 'club', 'actions'];

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.tournaments().subscribe({
      next: (list) => {
        this.tournaments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Erreur de chargement', 'Fermer', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  open(id: number): void {
    this.router.navigate(['/tournaments', id]);
  }

  openCreate(): void {
    const ref = this.dialog.open(TournamentDialog, { width: '500px' });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.snack.open('Tournoi créé', 'Fermer', { duration: 2000 });
        this.refresh();
      }
    });
  }

  statusColor(s: TournamentStatus): 'primary' | 'accent' | 'warn' | undefined {
    switch (s) {
      case 'open':
      case 'running':
        return 'primary';
      case 'closed':
        return 'accent';
      default:
        return undefined;
    }
  }
}
