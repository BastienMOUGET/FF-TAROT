import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { ChallengeRanking, SubTournament, Tournament } from '../../core/api.types';

// Vocabulaire du club (retour terrain) : un "Challenge" (tournament) regroupe
// des "Tournois" hebdomadaires (sub_tournaments). Le libellé par défaut d'un
// tournoi est la date du jour, c'est ainsi que le club les nomme.
function todayLabel(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

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
    <h2 mat-dialog-title>Nouveau tournoi</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nom du tournoi (ex : date de la soirée)</mat-label>
          <input matInput formControlName="label" />
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
    label: [todayLabel(), Validators.required],
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
    MatButtonToggleModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <a routerLink="/tournaments" class="back">
      <mat-icon>arrow_back</mat-icon> Retour aux challenges
    </a>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (tournament(); as t) {
      <mat-card class="head">
        <mat-card-header>
          <mat-card-title>Challenge {{ t.name }}</mat-card-title>
          <mat-card-subtitle>
            {{ t.code }} ·
            @if (t.date) {
              {{ t.date | date: 'dd/MM/yyyy' }}
            } @else {
              date à définir
            }
            @if (t.club_name) {
              · {{ t.club_name }}
            }
          </mat-card-subtitle>
        </mat-card-header>
      </mat-card>

      <!-- 1. Les tournois hebdomadaires : c'est ce qu'on gère le soir même,
           donc en haut, avec le bouton d'ajout. -->
      <div class="section-head">
        <h2>Tournois ({{ subs().length }})</h2>
        <button mat-flat-button color="primary" (click)="addSub()">
          <mat-icon>add</mat-icon> Ajouter un tournoi
        </button>
      </div>

      @if (subs().length === 0) {
        <p class="empty">
          Aucun tournoi pour l'instant. Clique sur « Ajouter un tournoi » pour
          créer la soirée du jour.
        </p>
      } @else {
        <div class="subs">
          @for (sub of subs(); track sub.id) {
            <a class="sub-card" [routerLink]="['/sub-tournaments', sub.id]">
              <mat-card>
                <mat-card-content>
                  <div class="sub-title">
                    <mat-icon>event</mat-icon>
                    <span>{{ sub.label }}</span>
                    @if (+sub.indice_pcn > 0) {
                      <mat-chip class="ml">PCN {{ sub.indice_pcn }}</mat-chip>
                    }
                  </div>
                  <div class="sub-open">Ouvrir <mat-icon>chevron_right</mat-icon></div>
                </mat-card-content>
              </mat-card>
            </a>
          }
        </div>
      }

      <!-- 2. Le classement trimestriel, en bas : on le consulte, on ne le
           manipule pas pendant la soirée. -->
      <mat-card class="challenge-card">
        <mat-card-header>
          <mat-card-title>Classement du Challenge</mat-card-title>
          <mat-card-subtitle>
            Cumul sur {{ challengeRanking()?.sub_tournaments_count ?? 0 }}
            tournoi(s)
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-button-toggle-group
            [value]="t.challenge_mode"
            (change)="setChallengeMode(t.id, $event.value)"
          >
            <mat-button-toggle value="place">Par place</mat-button-toggle>
            <mat-button-toggle value="raw">Par points</mat-button-toggle>
          </mat-button-toggle-group>

          @if (challengeLoading()) {
            <mat-progress-spinner mode="indeterminate" diameter="30" />
          } @else if (
            !challengeRanking() || challengeRanking()!.ranking.length === 0
          ) {
            <p class="empty">
              Pas encore de classement (aucun résultat de tournoi validé).
            </p>
          } @else {
            <table class="challenge-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Joueur</th>
                  <th>Tournois joués</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                @for (e of challengeRanking()!.ranking; track e.player_id) {
                  <tr [class.first]="e.place === 1">
                    <td>{{ e.place }}</td>
                    <td>{{ e.name }} {{ e.firstname }}</td>
                    <td>{{ e.sub_tournaments_played }}</td>
                    <td>{{ e.points }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </mat-card-content>
      </mat-card>
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
    .ml { margin-left: 8px; }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 24px 0 12px;
    }
    .empty { color: #757575; }
    .subs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }
    .sub-card { text-decoration: none; color: inherit; }
    .sub-card mat-card { cursor: pointer; transition: box-shadow 0.15s; }
    .sub-card mat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    .sub-card mat-card-content {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 16px;
    }
    .sub-title { display: flex; align-items: center; gap: 8px; font-size: 1.15em; font-weight: 500; }
    .sub-open { display: flex; align-items: center; color: #1976d2; font-size: 0.9em; }
    .challenge-card mat-card-content { display: flex; flex-direction: column; gap: 12px; }
    .challenge-table { width: 100%; border-collapse: collapse; }
    .challenge-table th, .challenge-table td {
      text-align: left; padding: 6px 12px; border-bottom: 1px solid #eee;
    }
    .challenge-table tr.first td { background: rgba(255, 215, 0, 0.18); font-weight: 600; }
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
  challengeRanking = signal<ChallengeRanking | null>(null);
  challengeLoading = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.tournament(id).subscribe({
      next: (t) => {
        this.tournament.set(t);
        this.api.subTournaments(id).subscribe((subs) => {
          // Le plus récent en premier : c'est celui de la soirée.
          this.subs.set([...subs].sort((a, b) => b.id - a.id));
          this.loading.set(false);
        });
        this.loadChallengeRanking(id);
      },
      error: () => {
        this.snack.open('Challenge introuvable', 'Fermer', { duration: 3000 });
        this.loading.set(false);
        this.router.navigate(['/tournaments']);
      },
    });
  }

  loadChallengeRanking(id: number): void {
    this.challengeLoading.set(true);
    this.api.challengeRanking(id).subscribe({
      next: (r) => {
        this.challengeRanking.set(r);
        this.challengeLoading.set(false);
      },
      error: () => this.challengeLoading.set(false),
    });
  }

  setChallengeMode(id: number, mode: 'place' | 'raw'): void {
    const t = this.tournament();
    if (!t || t.challenge_mode === mode) return;
    this.api.updateTournament(id, { ...t, challenge_mode: mode }).subscribe({
      next: (updated) => {
        this.tournament.set(updated);
        this.loadChallengeRanking(id);
      },
      error: () =>
        this.snack.open('Erreur changement de mode', 'Fermer', {
          duration: 3000,
        }),
    });
  }

  addSub() {
    const t = this.tournament();
    if (!t) return;
    const ref = this.dialog.open(SubTournamentDialog, {
      width: '450px',
      data: { tournamentId: t.id },
    });
    ref.afterClosed().subscribe((created: SubTournament | undefined) => {
      // Un tournoi créé s'ouvre directement sur sa page : la suite
      // (joueurs présents, tirage au sort) se fait là.
      if (created) this.router.navigate(['/sub-tournaments', created.id]);
    });
  }
}
