import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { PlacementFix } from './placement-fix';

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
    PlacementFix,
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
      <!-- Accès direct à chaque table : les résultats arrivent dans le
           désordre, inutile de faire défiler jusqu'à la table 10. -->
      @if (r.tables && r.tables.length > 0) {
        <nav class="tables-nav no-print" aria-label="Saisir une table">
          @for (t of r.tables; track t.table_number) {
            <a
              class="tab"
              [routerLink]="['/rounds', r.id, 'tables', t.table_number]"
              [class.done]="tableState().get(t.table_number) === 'done'"
              [class.started]="tableState().get(t.table_number) === 'started'"
              [title]="tableState().get(t.table_number) === 'done' ? 'Table validée' : tableState().get(t.table_number) === 'started' ? 'Saisie commencée' : 'À saisir'"
            >
              @if (tableState().get(t.table_number) === 'done') {
                <mat-icon>check</mat-icon>
              } @else if (tableState().get(t.table_number) === 'started') {
                <mat-icon>edit</mat-icon>
              }
              Table {{ t.table_number }}
            </a>
          }
          <span class="tables-count">{{ doneCount() }}/{{ r.tables.length }} validée{{ doneCount() > 1 ? 's' : '' }}</span>
        </nav>
      }
      <div class="actions">
        <a mat-flat-button color="primary" [routerLink]="['/rounds', r.id, 'ranking']">
          <mat-icon>format_list_numbered</mat-icon> Classement de la manche
        </a>
        <a mat-stroked-button [routerLink]="['/sub-tournaments', r.sub_tournament_id, 'route-sheet']">
          <mat-icon>print</mat-icon> Placement
        </a>
        @if (auth.isAdmin()) {
          <button
            mat-stroked-button
            color="primary"
            (click)="regenerate(r.id)"
            [disabled]="busy() || hasScores()"
            [title]="
              hasScores()
                ? 'Impossible : des scores sont déjà saisis sur cette manche'
                : 'Refait le tirage des places de cette manche, avant de jouer'
            "
          >
            <mat-icon>shuffle</mat-icon> Refaire le tirage des places
          </button>
        }
        @if (r.tables && r.tables.length > 0) {
          <button
            mat-flat-button
            color="primary"
            (click)="nextRound(r)"
            [disabled]="busy()"
          >
            <mat-icon>skip_next</mat-icon>
            {{ nextRoundId() ? 'Manche ' + (r.round_number + 1) : 'Créer la manche ' + (r.round_number + 1) }}
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

      <!-- Juste après le tirage : corriger le placement avant d'imprimer et
           de jouer (retardataire, erreur de pointage, retrait). -->
      @if (auth.isAdmin() && r.round_number === 1 && scoresChecked() && !hasScores() && r.tables && r.tables.length > 0) {
        <app-placement-fix [round]="r" (changed)="refresh(r.id)" />
      }

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
                      <!-- Consigne du tirage, pour vérifier qu'elle est tenue
                           à chaque manche (écran seulement). -->
                      @if (s.orientation) {
                        <span
                          class="consigne no-print"
                          [class.ko]="!consigneTenue(s)"
                          [title]="consigneTenue(s) ? 'Consigne respectée' : 'Consigne impossible à respecter à cette table'"
                        >
                          @if (!consigneTenue(s)) {<mat-icon>warning</mat-icon>}
                          {{ consigneLabel(s.orientation) }}
                        </span>
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
    .pname { flex: 1 1 auto; }
    .tables-nav { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin: -4px 0 16px; }
    .tab {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 4px 10px; border-radius: 16px; border: 1px solid #bdbdbd;
      text-decoration: none; color: #424242; font-size: 0.9em; background: #fff;
    }
    .tab:hover { border-color: #1976d2; color: #1565c0; }
    .tab mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tab.done { background: #e8f5e9; border-color: #2e7d32; color: #1b5e20; font-weight: 700; }
    .tab.started { background: #fff3e0; border-color: #ef6c00; color: #8a4b00; font-weight: 600; }
    .tables-count { margin-left: 6px; color: #5b6478; font-size: 0.85em; }
    .consigne {
      display: inline-flex; align-items: center; gap: 2px;
      font-size: 0.72em; font-weight: 600; white-space: nowrap;
      padding: 2px 8px; border-radius: 10px;
      background: #e8f0fe; color: #1565c0;
    }
    .consigne.ko { background: #fdecea; color: #c62828; }
    .consigne mat-icon { font-size: 14px; width: 14px; height: 14px; }
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
  // Manche suivante déjà générée (cas normal : toutes le sont au tirage au
  // sort) et présence de scores, qui interdit de refaire le tirage.
  nextRoundId = signal<number | null>(null);
  hasScores = signal(false);
  // Vrai une fois les scores relus : évite d'afficher un instant le bloc
  // de correction sur une manche déjà jouée.
  scoresChecked = signal(false);
  // État de saisie de chaque table : validée, commencée, ou rien.
  tableState = signal<Map<number, 'done' | 'started'>>(new Map());
  doneCount = computed(() => [...this.tableState().values()].filter((v) => v === 'done').length);

  ngOnInit(): void {
    // Angular réutilise ce composant quand on passe de /rounds/5 à /rounds/6 :
    // avec un `snapshot` lu une seule fois, le bouton « Manche N+1 » changeait
    // l'adresse sans changer l'écran, et passait pour inactif (retour terrain
    // n°14). On suit donc le paramètre plutôt que de le photographier.
    this.route.paramMap.subscribe((pm) => {
      const id = Number(pm.get('id'));
      if (id) this.refresh(id);
    });
  }

  refresh(id: number): void {
    this.loading.set(true);
    this.scoresChecked.set(false);
    this.api.round(id).subscribe({
      next: (r) => {
        this.round.set(r);
        this.loading.set(false);
        this.api.rounds(r.sub_tournament_id).subscribe((rounds) => {
          const next = rounds.find((x) => x.round_number === r.round_number + 1);
          this.nextRoundId.set(next ? next.id : null);
        });
        this.api.tableResults(id).subscribe((results) => {
          const st = new Map<number, 'done' | 'started'>();
          for (const t of results) {
            if (t.validated) st.set(t.table_number, 'done');
            else if ((t.hands?.length ?? 0) > 0) st.set(t.table_number, 'started');
          }
          this.tableState.set(st);
          this.hasScores.set(
            results.some(
              (t) => !!t.validated || (t.hands?.length ?? 0) > 0
            )
          );
          this.scoresChecked.set(true);
        });
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
    // Les manches sont générées d'avance (sauf en placement par niveau) :
    // on va simplement à la suivante, sans rien régénérer ni risquer de
    // perdre des scores.
    const existing = this.nextRoundId();
    if (existing) {
      this.router.navigate(['/rounds', existing]);
      return;
    }
    if (
      !confirm(
        `La manche ${r.round_number + 1} n'existe pas encore. La créer et tirer ses places ?`
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
  consigneLabel(o: string): string {
    const labels: Record<string, string> = {
      N: 'Nord fixe', S: 'Sud fixe', E: 'Est fixe', O: 'Ouest fixe', not_north: 'Non Nord',
    };
    return labels[o] ?? o;
  }

  consigneTenue(s: RoundSeat): boolean {
    if (!s.orientation) return true;
    if (s.orientation === 'not_north') return s.seat !== 'N';
    return s.seat === s.orientation;
  }

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
