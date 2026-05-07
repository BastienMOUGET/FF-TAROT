import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import {
  Round,
  SubTournament,
  Tournament,
} from '../../core/api.types';

@Component({
  selector: 'app-sub-tournament-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Nouveau sous-tournoi</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Libellé</mat-label>
          <input matInput formControlName="label" placeholder="ex: Open" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Indice PCN (0 = pas de PCN)</mat-label>
          <input matInput type="number" formControlName="indice_pcn" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-flat-button color="primary" (click)="submit()">Créer</button>
    </mat-dialog-actions>
  `,
  styles: `.form { display: flex; flex-direction: column; } .full { width: 100%; }`,
})
export class SubTournamentDialog {
  private fb = inject(FormBuilder);
  data = inject<{ tournamentId: number }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<SubTournamentDialog>>(MatDialogRef);
  api = inject(ApiService);

  form = this.fb.nonNullable.group({
    label: ['Open', Validators.required],
    indice_pcn: [0],
  });

  submit() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.api
      .createSubTournament(this.data.tournamentId, {
        label: v.label,
        indice_pcn: v.indice_pcn,
      })
      .subscribe({
        next: (created) => this.ref.close(created),
        error: () => {},
      });
  }
}

@Component({
  selector: 'app-tournament-detail-page',
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <a routerLink="/tournaments" class="back">
      <mat-icon>arrow_back</mat-icon> Retour
    </a>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (tournament(); as t) {
      <mat-card class="head">
        <mat-card-header>
          <mat-card-title>{{ t.name }}</mat-card-title>
          <mat-card-subtitle>
            {{ t.code }} ·
            @if (t.date) {
              {{ t.date | date: 'dd/MM/yyyy' }}
            } @else {
              date à définir
            }
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="meta">
            <mat-chip>statut : {{ t.status }}</mat-chip>
            <mat-chip>round courant : {{ t.current_round }}</mat-chip>
            <mat-chip>coef : {{ t.coef_default }}</mat-chip>
            @if (t.club_name) {
              <mat-chip>{{ t.club_name }}</mat-chip>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <div class="section-head">
        <h2>Sous-tournois</h2>
        <button mat-flat-button color="primary" (click)="addSub()">
          <mat-icon>add</mat-icon> Ajouter
        </button>
      </div>

      @if (subs().length === 0) {
        <p class="empty">Aucun sous-tournoi. Ajoute un "Open" pour commencer.</p>
      } @else {
        <mat-accordion>
          @for (sub of subs(); track sub.id) {
            <mat-expansion-panel (opened)="loadRoundsFor(sub.id)">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  {{ sub.label }}
                  @if (+sub.indice_pcn > 0) {
                    <mat-chip class="ml">PCN {{ sub.indice_pcn }}</mat-chip>
                  }
                </mat-panel-title>
              </mat-expansion-panel-header>

              <div class="actions">
                <a
                  mat-stroked-button
                  [routerLink]="['/sub-tournaments', sub.id, 'teams']"
                >
                  <mat-icon>groups</mat-icon> Équipes
                </a>
                <a
                  mat-stroked-button
                  [routerLink]="['/sub-tournaments', sub.id, 'ranking']"
                >
                  <mat-icon>leaderboard</mat-icon> Classement
                </a>
                <a
                  mat-stroked-button
                  [routerLink]="['/sub-tournaments', sub.id, 'route-sheet']"
                >
                  <mat-icon>description</mat-icon> Feuille de route
                </a>
                <a
                  mat-stroked-button
                  [routerLink]="['/sub-tournaments', sub.id, 'pp-grid']"
                >
                  <mat-icon>military_tech</mat-icon> Grille PP
                </a>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="newRound(sub.id)"
                >
                  <mat-icon>add</mat-icon> Nouveau round
                </button>
              </div>

              <h3>Rounds</h3>
              @if (roundsBySub()[sub.id]; as rounds) {
                @if (rounds.length === 0) {
                  <p class="empty">Pas encore de round.</p>
                } @else {
                  <div class="rounds">
                    @for (r of rounds; track r.id) {
                      <a
                        mat-stroked-button
                        [routerLink]="['/rounds', r.id]"
                        class="round-btn"
                      >
                        Round {{ r.round_number }}
                      </a>
                    }
                  </div>
                }
              } @else {
                <em>Chargement…</em>
              }
            </mat-expansion-panel>
          }
        </mat-accordion>
      }
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
    }
    .head { margin-bottom: 24px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; }
    .ml { margin-left: 8px; }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 24px 0 12px;
    }
    .empty { color: #757575; }
    .actions {
      display: flex;
      gap: 12px;
      margin: 8px 0 16px;
      flex-wrap: wrap;
    }
    .rounds { display: flex; gap: 8px; flex-wrap: wrap; }
  `,
})
export class TournamentDetailPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  loading = signal(true);
  tournament = signal<Tournament | null>(null);
  subs = signal<SubTournament[]>([]);
  roundsBySub = signal<Record<number, Round[]>>({});

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.tournament(id).subscribe({
      next: (t) => {
        this.tournament.set(t);
        this.api.subTournaments(id).subscribe((subs) => {
          this.subs.set(subs);
          this.loading.set(false);
        });
      },
      error: () => {
        this.snack.open('Tournoi introuvable', 'Fermer', { duration: 3000 });
        this.loading.set(false);
        this.router.navigate(['/tournaments']);
      },
    });
  }

  loadRoundsFor(subId: number) {
    if (this.roundsBySub()[subId]) return;
    this.api.rounds(subId).subscribe((rounds) => {
      this.roundsBySub.update((m) => ({ ...m, [subId]: rounds }));
    });
  }

  newRound(subId: number) {
    this.api.createRound(subId).subscribe({
      next: (round) => {
        // Generate placement automatically
        this.api.generatePlacement(round.id).subscribe(() => {
          this.snack.open(
            `Round ${round.round_number} créé + mise en place générée`,
            'Fermer',
            { duration: 3000 }
          );
          this.api.rounds(subId).subscribe((rounds) => {
            this.roundsBySub.update((m) => ({ ...m, [subId]: rounds }));
          });
        });
      },
      error: (err) =>
        this.snack.open(
          err?.error?.error || 'Erreur création round',
          'Fermer',
          { duration: 3000 }
        ),
    });
  }

  addSub() {
    const t = this.tournament();
    if (!t) return;
    const ref = this.dialog.open(SubTournamentDialog, {
      width: '450px',
      data: { tournamentId: t.id },
    });
    ref.afterClosed().subscribe((created) => {
      if (created) {
        this.api.subTournaments(t.id).subscribe((subs) => this.subs.set(subs));
      }
    });
  }
}
