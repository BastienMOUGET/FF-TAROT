import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Round, SubTournament, TableResult } from '../../core/api.types';

// Page d'un tournoi hebdomadaire (sub_tournament). C'est l'écran de pilotage
// de la soirée : joueurs présents → mise en place → saisie par manche →
// classement de la manche → classement général.
@Component({
  selector: 'app-sub-tournament-detail-page',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    @if (sub(); as s) {
      <a [routerLink]="['/tournaments', s.tournament_id]" class="back">
        <mat-icon>arrow_back</mat-icon> Retour au challenge
        @if (s.tournament_name) {
          <span>{{ s.tournament_name }}</span>
        }
      </a>
    }

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (sub(); as s) {
      <h1>
        Tournoi {{ s.label }}
        @if (+s.indice_pcn > 0) {
          <mat-chip class="ml">PCN {{ s.indice_pcn }}</mat-chip>
        }
      </h1>

      @if (s.imported) {
        <mat-card class="steps">
          <mat-card-content>
            <p class="imported">
              Tournoi importé depuis un classement externe : pas de manches ni
              de saisie ici, seulement son classement, qui compte dans le
              Challenge.
            </p>
            <a mat-flat-button color="primary" [routerLink]="['/sub-tournaments', s.id, 'ranking']">
              <mat-icon>leaderboard</mat-icon> Voir le classement
            </a>
          </mat-card-content>
        </mat-card>
      } @else {
      <mat-card class="steps">
        <mat-card-content>
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-body">
              <div class="step-title">Joueurs présents</div>
              <div class="step-help">
                Pointer les joueurs, l'appli forme les tables de 4 (et de 3)
                et tire la mise en place de la manche 1.
              </div>
            </div>
            <a mat-flat-button color="primary" [routerLink]="['/sub-tournaments', s.id, 'teams']">
              <mat-icon>how_to_reg</mat-icon> Joueurs
            </a>
          </div>

          <div class="step">
            <div class="step-num">2</div>
            <div class="step-body">
              <div class="step-title">Impressions de début de tournoi</div>
              <div class="step-help">
                Placement de départ (une page) et feuilles de marque par table et
                par manche.
              </div>
            </div>
            <div class="step-actions">
              <a mat-stroked-button [routerLink]="['/sub-tournaments', s.id, 'route-sheet']">
                <mat-icon>print</mat-icon> Placement
              </a>
              <a mat-stroked-button [routerLink]="['/sub-tournaments', s.id, 'score-sheets']">
                <mat-icon>grid_on</mat-icon> Feuilles de marque
              </a>
            </div>
          </div>

          <div class="step">
            <div class="step-num">3</div>
            <div class="step-body">
              <div class="step-title">Manches</div>
              <div class="step-help">
                Saisir les scores de chaque table, puis consulter le classement
                de la manche.
              </div>
            </div>
            @if (auth.isAdmin()) {
              <div class="step-actions">
                @if (rounds().length > 0 && rounds().length < (s.rounds_planned ?? 0)) {
                  <button mat-stroked-button color="primary" (click)="generateMissing(s)" [disabled]="busy()">
                    <mat-icon>playlist_add</mat-icon>
                    Générer les manches {{ rounds().length + 1 }} à {{ s.rounds_planned }}
                  </button>
                }
                <button mat-flat-button color="primary" (click)="newRound()" [disabled]="busy()">
                  <mat-icon>add</mat-icon>
                  {{ rounds().length === 0 ? 'Manche 1' : 'Manche ' + (rounds().length + 1) }}
                </button>
              </div>
            }
          </div>

          @if (rounds().length === 0) {
            <p class="empty">
              Pas encore de manche. Le tirage au sort des joueurs présents crée
              la manche 1 automatiquement.
            </p>
          } @else {
            <div class="rounds">
              @for (r of rounds(); track r.id) {
                <div class="round-row">
                  <div class="round-name">Manche {{ r.round_number }}</div>
                  <div class="round-progress">
                    @if (progress()[r.id]; as p) {
                      <mat-chip [class.done]="p.validated === p.tables && p.tables > 0">
                        {{ p.validated }}/{{ p.tables }} tables validées
                      </mat-chip>
                    }
                  </div>
                  <div class="round-actions">
                    <a mat-stroked-button [routerLink]="['/rounds', r.id]">
                      <mat-icon>table_restaurant</mat-icon> Tables &amp; saisie
                    </a>
                    <a mat-stroked-button [routerLink]="['/rounds', r.id, 'ranking']">
                      <mat-icon>format_list_numbered</mat-icon> Classement de la manche
                    </a>
                  </div>
                </div>
              }
            </div>
          }

          <div class="step">
            <div class="step-num">4</div>
            <div class="step-body">
              <div class="step-title">Classement général du tournoi</div>
              <div class="step-help">
                Cumul de toutes les manches validées. Il alimente le classement
                du Challenge.
              </div>
            </div>
            <div class="step-actions">
              <a mat-flat-button color="primary" [routerLink]="['/sub-tournaments', s.id, 'ranking']">
                <mat-icon>leaderboard</mat-icon> Classement général
              </a>
              <a mat-button [routerLink]="['/sub-tournaments', s.id, 'pp-grid']">
                <mat-icon>military_tech</mat-icon> Grille PP
              </a>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
      }
    }
  `,
  styles: `
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      margin-bottom: 16px; text-decoration: none; color: #1976d2;
    }
    h1 { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .ml { margin-left: 4px; }
    .empty { color: #757575; margin: 0 0 8px 56px; }
    .imported { color: #616161; margin: 0 0 12px; }
    .steps mat-card-content { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; }
    .step {
      display: flex; align-items: center; gap: 16px;
      padding: 12px 0; border-top: 1px solid #eee;
    }
    .step:first-child { border-top: none; }
    .step-num {
      width: 36px; height: 36px; border-radius: 50%; flex: 0 0 36px;
      background: #1976d2; color: #fff; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .step-body { flex: 1 1 auto; }
    .step-title { font-weight: 600; font-size: 1.05em; }
    .step-help { color: #757575; font-size: 0.9em; }
    .step-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .rounds { display: flex; flex-direction: column; gap: 6px; margin: 0 0 8px 52px; }
    .round-row {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 8px 12px; background: #f5f7fa; border-radius: 8px;
    }
    .round-name { font-weight: 600; min-width: 90px; }
    .round-progress { flex: 1 1 auto; }
    .round-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    mat-chip.done { background: #c8e6c9; }
  `,
})
export class SubTournamentDetailPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  protected auth = inject(AuthService);

  loading = signal(true);
  busy = signal(false);
  sub = signal<SubTournament | null>(null);
  rounds = signal<Round[]>([]);
  progress = signal<Record<number, { tables: number; validated: number }>>({});

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.subTournament(id).subscribe({
      next: (s) => {
        this.sub.set(s);
        this.loadRounds(id);
      },
      error: () => {
        this.snack.open('Tournoi introuvable', 'Fermer', { duration: 3000 });
        this.loading.set(false);
        this.router.navigate(['/tournaments']);
      },
    });
  }

  loadRounds(subId: number): void {
    this.api.rounds(subId).subscribe({
      next: (rounds) => {
        this.rounds.set(rounds);
        this.loading.set(false);
        for (const r of rounds) this.loadProgress(r.id);
      },
      error: () => this.loading.set(false),
    });
  }

  // Avancement de la saisie : nb de tables mises en place vs validées.
  private loadProgress(roundId: number): void {
    this.api.round(roundId).subscribe((round) => {
      const tables = round.tables?.length ?? 0;
      this.api.tableResults(roundId).subscribe({
        next: (results: TableResult[]) => {
          const validated = results.filter((t) => !!t.validated).length;
          this.progress.update((m) => ({ ...m, [roundId]: { tables, validated } }));
        },
        error: () =>
          this.progress.update((m) => ({ ...m, [roundId]: { tables, validated: 0 } })),
      });
    });
  }

  // Manches 2..N prévues, créées et placées à la suite (mouvement
  // déterministe à partir de la manche précédente).
  generateMissing(s: SubTournament): void {
    const planned = Number(s.rounds_planned ?? 0);
    const missing = planned - this.rounds().length;
    if (missing <= 0) return;
    this.busy.set(true);
    const step = (left: number): void => {
      if (left === 0) {
        this.busy.set(false);
        this.snack.open(`${planned} manches générées`, 'Fermer', { duration: 2500 });
        this.loadRounds(s.id);
        return;
      }
      this.api.createRound(s.id).subscribe({
        next: (r) =>
          this.api.generatePlacement(r.id).subscribe({
            next: () => step(left - 1),
            error: (err) => {
              this.busy.set(false);
              this.snack.open(err?.error?.error || 'Mise en place impossible', 'Fermer', { duration: 4000 });
              this.loadRounds(s.id);
            },
          }),
        error: (err) => {
          this.busy.set(false);
          this.snack.open(err?.error?.error || 'Erreur création manche', 'Fermer', { duration: 3000 });
          this.loadRounds(s.id);
        },
      });
    };
    step(missing);
  }

  newRound(): void {
    const s = this.sub();
    if (!s) return;
    const n = this.rounds().length + 1;
    if (n === 1) {
      // La manche 1 se crée depuis le tirage au sort (elle a besoin des équipes).
      this.router.navigate(['/sub-tournaments', s.id, 'teams']);
      return;
    }
    if (!confirm(`Créer la manche ${n} et générer sa mise en place ?`)) return;
    this.busy.set(true);
    this.api.createRound(s.id).subscribe({
      next: (round) => {
        this.api.generatePlacement(round.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snack.open(`Manche ${round.round_number} créée`, 'Fermer', { duration: 2000 });
            this.loadRounds(s.id);
          },
          error: (err) => {
            this.busy.set(false);
            this.snack.open(
              `Manche ${round.round_number} créée, mais mise en place impossible : ` +
                (err?.error?.error || 'erreur inconnue'),
              'Fermer',
              { duration: 5000 }
            );
            this.loadRounds(s.id);
          },
        });
      },
      error: (err) => {
        this.busy.set(false);
        this.snack.open(err?.error?.error || 'Erreur création manche', 'Fermer', {
          duration: 3000,
        });
      },
    });
  }
}
