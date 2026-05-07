import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { Player, Team } from '../../core/api.types';

@Component({
  selector: 'app-teams-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <a routerLink="/tournaments" class="back">
      <mat-icon>arrow_back</mat-icon> Retour
    </a>
    <h1>Inscriptions</h1>

    <mat-card class="form-card">
      <mat-card-header>
        <mat-card-title>Nouvelle équipe (Libre par 4)</mat-card-title>
        <mat-card-subtitle>2 joueurs NS + 2 joueurs EO</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="add()">
          <div class="grid">
            @for (slot of slots; track slot.idx) {
              <mat-form-field appearance="outline">
                <mat-label
                  >{{ slot.label }} ({{ slot.pair }})</mat-label
                >
                <mat-select [formControlName]="'p' + slot.idx">
                  @for (p of players(); track p.id) {
                    <mat-option [value]="p.id">
                      {{ p.name }} {{ p.firstname }}
                      @if (p.licence) {
                        ({{ p.licence }})
                      }
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }
          </div>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || saving()"
          >
            <mat-icon>person_add</mat-icon>
            Inscrire l'équipe
          </button>
        </form>
      </mat-card-content>
    </mat-card>

    <h2>Équipes inscrites ({{ teams().length }})</h2>
    @if (teams().length === 0) {
      <p class="empty">Aucune équipe pour l'instant.</p>
    } @else {
      <div class="teams">
        @for (t of teams(); track t.id) {
          <mat-card class="team">
            <mat-card-header>
              <mat-card-title>Équipe {{ t.team_number }}</mat-card-title>
              <button
                mat-icon-button
                color="warn"
                (click)="remove(t.id)"
                title="Supprimer"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-header>
            <mat-card-content>
              <ul>
                @for (p of t.players; track p.player_id) {
                  <li>
                    <strong>{{ p.pair }}</strong>
                    {{ p.name }} {{ p.firstname }}
                  </li>
                }
              </ul>
            </mat-card-content>
          </mat-card>
        }
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      margin-bottom: 16px; text-decoration: none; color: #1976d2;
    }
    .form-card { margin-bottom: 24px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
    .empty { color: #757575; }
    .teams {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .team mat-card-header { justify-content: space-between; }
    .team ul { list-style: none; padding: 0; margin: 0; }
    .team li { padding: 4px 0; }
  `,
})
export class TeamsPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  subTournamentId = signal(0);
  players = signal<Player[]>([]);
  teams = signal<Team[]>([]);
  saving = signal(false);

  slots = [
    { idx: 1, label: 'Joueur 1', pair: 'NS' as const },
    { idx: 2, label: 'Joueur 2', pair: 'NS' as const },
    { idx: 3, label: 'Joueur 3', pair: 'EO' as const },
    { idx: 4, label: 'Joueur 4', pair: 'EO' as const },
  ];

  form = this.fb.nonNullable.group({
    p1: [null as number | null, Validators.required],
    p2: [null as number | null, Validators.required],
    p3: [null as number | null, Validators.required],
    p4: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.subTournamentId.set(id);
    this.api.players().subscribe((p) => this.players.set(p));
    this.refreshTeams();
  }

  refreshTeams(): void {
    this.api.teams(this.subTournamentId()).subscribe((t) => this.teams.set(t));
  }

  add(): void {
    const v = this.form.getRawValue();
    if (!v.p1 || !v.p2 || !v.p3 || !v.p4) return;
    const ids = [v.p1, v.p2, v.p3, v.p4];
    if (new Set(ids).size !== 4) {
      this.snack.open('Doublon : un joueur est sélectionné plusieurs fois', 'Fermer', { duration: 3000 });
      return;
    }
    this.saving.set(true);
    this.api
      .createTeam(this.subTournamentId(), [
        { player_id: v.p1, pair: 'NS' },
        { player_id: v.p2, pair: 'NS' },
        { player_id: v.p3, pair: 'EO' },
        { player_id: v.p4, pair: 'EO' },
      ])
      .subscribe({
        next: () => {
          this.snack.open('Équipe inscrite', 'Fermer', { duration: 2000 });
          this.form.reset();
          this.refreshTeams();
          this.saving.set(false);
        },
        error: (err) => {
          this.snack.open(
            err?.error?.error || 'Erreur',
            'Fermer',
            { duration: 3000 }
          );
          this.saving.set(false);
        },
      });
  }

  remove(id: number): void {
    if (!confirm("Supprimer cette équipe ?")) return;
    this.api.deleteTeam(id).subscribe(() => this.refreshTeams());
  }
}
