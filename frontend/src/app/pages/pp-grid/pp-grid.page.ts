import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { PpEntry } from '../../core/api.types';

@Component({
  selector: 'app-pp-grid-page',
  imports: [
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <a routerLink="/tournaments" class="back">
      <mat-icon>arrow_back</mat-icon> Retour
    </a>
    <h1>Grille PP (Palmarès des Points)</h1>
    <p class="hint">
      <mat-icon>info</mat-icon>
      Définit le nombre de PP attribués à chaque place du sous-tournoi.
      Le classement est recalculé après l'enregistrement.
    </p>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else {
      <mat-card>
        <mat-card-content>
          <table mat-table [dataSource]="entries()">
            <ng-container matColumnDef="place">
              <th mat-header-cell *matHeaderCellDef>Place</th>
              <td mat-cell *matCellDef="let e">{{ e.place }}</td>
            </ng-container>
            <ng-container matColumnDef="pp">
              <th mat-header-cell *matHeaderCellDef>PP</th>
              <td mat-cell *matCellDef="let e; let i = index">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <input
                    matInput
                    type="number"
                    step="0.5"
                    [(ngModel)]="e.pp"
                  />
                </mat-form-field>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions"></th>
              <td mat-cell *matCellDef="let e; let i = index" class="actions">
                <button mat-icon-button color="warn" (click)="removeRow(i)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="['place', 'pp', 'actions']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['place', 'pp', 'actions']"></tr>
          </table>

          <div class="row-actions">
            <button mat-stroked-button (click)="addRow()">
              <mat-icon>add</mat-icon> Ajouter une place
            </button>
            <button mat-stroked-button (click)="presetTop3()">
              <mat-icon>looks_3</mat-icon> Préréglage top 3 (3/2/1)
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="bottom-actions">
        <button
          mat-flat-button
          color="primary"
          (click)="save()"
          [disabled]="saving()"
        >
          <mat-icon>save</mat-icon> Enregistrer la grille
        </button>
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      margin-bottom: 16px; text-decoration: none; color: #1976d2;
    }
    .hint {
      display: flex; align-items: center; gap: 8px;
      background: #e3f2fd; border: 1px solid #90caf9;
      border-radius: 4px; padding: 12px; margin-bottom: 16px;
    }
    table { width: 100%; }
    .actions { width: 60px; text-align: right; }
    .row-actions {
      display: flex; gap: 12px; margin-top: 16px;
    }
    .bottom-actions {
      margin-top: 24px; display: flex; justify-content: flex-end;
    }
    mat-form-field { width: 80px; }
  `,
})
export class PpGridPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  saving = signal(false);
  subTournamentId = signal(0);
  entries = signal<{ place: number; pp: number }[]>([]);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.subTournamentId.set(id);
    this.api.ppGrid(id).subscribe({
      next: (g) => {
        this.entries.set(g.map((e) => ({ place: e.place, pp: Number(e.pp) })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addRow(): void {
    const next = this.entries().length
      ? Math.max(...this.entries().map((e) => e.place)) + 1
      : 1;
    this.entries.update((arr) => [...arr, { place: next, pp: 0 }]);
  }

  removeRow(i: number): void {
    this.entries.update((arr) => arr.filter((_, idx) => idx !== i));
  }

  presetTop3(): void {
    this.entries.set([
      { place: 1, pp: 3 },
      { place: 2, pp: 2 },
      { place: 3, pp: 1 },
    ]);
  }

  save(): void {
    this.saving.set(true);
    const payload: PpEntry[] = this.entries().map((e) => ({
      place: e.place,
      pp: String(e.pp),
    }));
    this.api.setPpGrid(this.subTournamentId(), payload).subscribe({
      next: () => {
        this.snack.open('Grille PP enregistrée', 'Fermer', { duration: 2000 });
        this.saving.set(false);
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur', 'Fermer', {
          duration: 3000,
        });
        this.saving.set(false);
      },
    });
  }
}
