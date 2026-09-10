import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Player, Round, RoundSeat } from '../../core/api.types';
import { PlayerDialog } from '../admin/dialogs/player-dialog';

@Component({
  selector: 'app-round-detail-page',
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
    @if (round(); as r0) {
      <a class="back" [routerLink]="['/sub-tournaments', r0.sub_tournament_id]">
        <mat-icon>arrow_back</mat-icon> Retour au tournoi
      </a>
    }

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else if (round(); as r) {
      <h1>Manche {{ r.round_number }}</h1>
      <div class="actions">
        <a mat-flat-button color="primary" [routerLink]="['/rounds', r.id, 'ranking']">
          <mat-icon>format_list_numbered</mat-icon> Classement de la manche
        </a>
        <a mat-stroked-button [routerLink]="['/sub-tournaments', r.sub_tournament_id, 'route-sheet']">
          <mat-icon>print</mat-icon> Placement
        </a>
        <button
          mat-stroked-button
          color="primary"
          (click)="regenerate(r.id)"
          [disabled]="busy()"
        >
          <mat-icon>shuffle</mat-icon> Régénérer la mise en place
        </button>
        @if (auth.isAdmin() && r.tables && r.tables.length > 0) {
          <button
            mat-flat-button
            color="primary"
            (click)="nextRound(r)"
            [disabled]="busy()"
          >
            <mat-icon>skip_next</mat-icon> Manche suivante
          </button>
        }
        @if (auth.isAdmin()) {
          <button
            mat-stroked-button
            color="warn"
            (click)="remove(r.id)"
            [disabled]="busy()"
          >
            <mat-icon>delete</mat-icon> Supprimer cette manche
          </button>
        }
      </div>

      @if (!r.tables || r.tables.length === 0) {
        <p class="empty">Aucune mise en place. Clique sur Régénérer.</p>
      } @else {
        <div class="tables">
          @for (t of r.tables; track t.table_number) {
            <mat-card class="table">
              <mat-card-header>
                <mat-card-title>Table {{ t.table_number }}</mat-card-title>
                <button
                  mat-flat-button
                  color="primary"
                  (click)="goSaisie(r.id, t.table_number)"
                >
                  <mat-icon>edit</mat-icon> Saisir
                </button>
              </mat-card-header>
              <mat-card-content>
                <ul>
                  @for (s of t.seats; track s.seat) {
                    <li>
                      <span class="seat" [attr.data-seat]="s.seat">{{ s.seat }}</span>
                      <span class="pname">{{ s.name }} {{ s.firstname }}</span>
                      @if (s.team_number) {
                        <small class="team">éq.{{ s.team_number }}</small>
                      }
                      @if (auth.isAdmin()) {
                        <button
                          mat-icon-button
                          class="edit-player"
                          (click)="editPlayer(s)"
                          title="Corriger le nom de ce joueur"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                      }
                    </li>
                  }
                </ul>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    }
  `,
  styles: `
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      margin-bottom: 16px; text-decoration: none; color: #1976d2;
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .actions { margin-bottom: 24px; display: flex; gap: 8px; flex-wrap: wrap; }
    .empty { color: #757575; }
    .tables {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    .table mat-card-header {
      display: flex; justify-content: space-between; align-items: center;
    }
    .table ul { list-style: none; padding: 0; margin: 0; }
    .table li {
      display: flex; align-items: center; gap: 8px; padding: 6px 0;
      border-bottom: 1px solid #eee;
    }
    .seat {
      display: inline-block; width: 28px; height: 28px;
      line-height: 28px; text-align: center;
      border-radius: 50%; font-weight: 600; font-size: 0.85em;
      color: #fff;
    }
    .seat[data-seat="N"] { background: #ffb74d; color: #5d4037; }
    .seat[data-seat="S"] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat="E"] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat="O"] { background: #aed581; color: #33691e; }
    .team { color: #757575; font-size: 0.8em; }
    .pname { flex: 1 1 auto; }
    .edit-player { opacity: 0.45; }
    .table li:hover .edit-player { opacity: 1; }
  `,
})
export class RoundDetailPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  protected auth = inject(AuthService);

  loading = signal(true);
  busy = signal(false);
  round = signal<Round | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.refresh(id);
  }

  refresh(id: number): void {
    this.loading.set(true);
    this.api.round(id).subscribe({
      next: (r) => {
        this.round.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Manche introuvable', 'Fermer', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  remove(id: number): void {
    if (
      !confirm(
        'Supprimer cette manche ? Les places et scores éventuellement saisis seront perdus.'
      )
    ) {
      return;
    }
    this.busy.set(true);
    this.api.deleteRound(id).subscribe({
      next: () => {
        this.snack.open('Manche supprimée', 'Fermer', { duration: 2000 });
        this.goBack();
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur suppression', 'Fermer', {
          duration: 3000,
        });
        this.busy.set(false);
      },
    });
  }

  regenerate(id: number): void {
    if (!confirm('Régénérer la mise en place ? Les scores éventuels seront perdus.')) {
      return;
    }
    this.busy.set(true);
    this.api.generatePlacement(id).subscribe({
      next: (r) => {
        this.round.set(r);
        this.busy.set(false);
        this.snack.open('Mise en place régénérée', 'Fermer', { duration: 2000 });
      },
      error: (err) => {
        this.snack.open(err?.error?.error || 'Erreur', 'Fermer', {
          duration: 3000,
        });
        this.busy.set(false);
      },
    });
  }

  nextRound(r: Round): void {
    if (
      !confirm(
        `Créer et générer la mise en place de la manche ${r.round_number + 1} ?`
      )
    ) {
      return;
    }
    this.busy.set(true);
    this.api.createRound(r.sub_tournament_id).subscribe({
      next: (created) => {
        this.api.generatePlacement(created.id).subscribe({
          next: () => {
            this.busy.set(false);
            this.snack.open(`Manche ${created.round_number} créée`, 'Fermer', {
              duration: 2000,
            });
            this.router.navigate(['/rounds', created.id]);
          },
          error: (err) => {
            this.busy.set(false);
            this.snack.open(
              `Manche ${created.round_number} créée, mais mise en place impossible : ` +
                (err?.error?.error || 'erreur inconnue'),
              'Fermer',
              { duration: 5000 }
            );
            this.router.navigate(['/rounds', created.id]);
          },
        });
      },
      error: (err) => {
        this.busy.set(false);
        this.snack.open(
          err?.error?.error || 'Erreur création de la manche suivante',
          'Fermer',
          { duration: 3000 }
        );
      },
    });
  }

  // Une faute de frappe sur un nom se corrige même une fois la mise en
  // place faite : on modifie la fiche du joueur, les places ne bougent pas.
  editPlayer(seat: RoundSeat): void {
    this.api.player(seat.player_id).subscribe({
      next: (player) => {
        const ref = this.dialog.open(PlayerDialog, { data: { player } });
        ref.afterClosed().subscribe((updated: Player | undefined) => {
          if (!updated) return;
          this.snack.open('Joueur modifié', 'Fermer', { duration: 2000 });
          const r = this.round();
          if (r) this.refresh(r.id);
        });
      },
      error: () =>
        this.snack.open('Joueur introuvable', 'Fermer', { duration: 3000 }),
    });
  }

  goSaisie(roundId: number, tableNumber: number): void {
    this.router.navigate(['/rounds', roundId, 'tables', tableNumber]);
  }

  goBack(): void {
    this.location.back();
  }
}
