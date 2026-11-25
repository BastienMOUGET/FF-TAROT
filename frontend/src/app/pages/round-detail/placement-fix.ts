import { Component, OnChanges, computed, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../core/api.service';
import { Player, Round, RoundSeat, Team } from '../../core/api.types';
import { PlayerDialog } from '../admin/dialogs/player-dialog';

// Corriger le placement juste après le tirage, AVANT d'imprimer et de jouer :
// ajouter un retardataire, remplacer un joueur pointé par erreur, retirer un
// joueur. Affiché sur la manche 1 tant qu'aucun score n'est saisi.
// Réutilise les opérations du serveur déjà en place (substitution, retrait)
// et, quand il n'y a plus de table de 3, le « refaire les tables » de la
// page Joueurs présents.
@Component({
  selector: 'app-placement-fix',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatSelectModule, MatFormFieldModule],
  template: `
    <mat-card class="fix no-print">
      <mat-card-header>
        <mat-icon mat-card-avatar class="fix-avatar">tune</mat-icon>
        <mat-card-title>Corriger le placement avant impression</mat-card-title>
        <mat-card-subtitle>
          Tant qu'aucun score n'est saisi. Chaque correction s'applique à toutes
          les manches déjà générées : réimprimez ensuite placement et feuilles.
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <!-- 1. Ajouter -->
        <section class="action">
          <h3><mat-icon>person_add</mat-icon> Ajouter un joueur <small>(oubli, arrivée tardive)</small></h3>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Joueur à ajouter</mat-label>
              <mat-select [value]="addId()" (selectionChange)="addId.set($event.value)">
                @for (p of available(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button type="button" (click)="newPlayer()">
              <mat-icon>person_add_alt</mat-icon> Nouveau joueur
            </button>
            <button mat-flat-button color="primary" type="button" [disabled]="!addId() || busy()" (click)="add()">
              {{ relaisSeat() ? 'Ajouter' : 'Ajouter et refaire les tables' }}
            </button>
          </div>
          <p class="hint">
            @if (relaisSeat(); as r) {
              Il prendra la place de <strong>{{ r.name }} {{ r.firstname }}</strong>
              (table {{ r.table_number }}, Nord) : cette table passe à 4 joueurs,
              rien d'autre ne bouge.
            } @else {
              Plus aucune table de 3 : les tables seront <strong>entièrement
              refaites</strong> avec ce joueur (les consignes de position sont
              conservées).
            }
          </p>
        </section>

        <!-- 2. Remplacer -->
        <section class="action">
          <h3><mat-icon>swap_horiz</mat-icon> Remplacer un joueur <small>(erreur de pointage)</small></h3>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Joueur placé par erreur</mat-label>
              <mat-select [value]="fromId()" (selectionChange)="fromId.set($event.value)">
                @for (p of registered(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-icon class="arrow">arrow_forward</mat-icon>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Joueur réellement présent</mat-label>
              <mat-select [value]="toId()" (selectionChange)="toId.set($event.value)">
                @for (p of available(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-flat-button color="primary" type="button" [disabled]="!fromId() || !toId() || busy()" (click)="replace()">
              Remplacer
            </button>
          </div>
          <p class="hint">Le joueur réellement présent prend exactement sa place, à toutes les manches.</p>
        </section>

        <!-- 3. Retirer -->
        <section class="action">
          <h3><mat-icon>person_remove</mat-icon> Retirer un joueur <small>(parti, inscrit à tort)</small></h3>
          <div class="row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Joueur à retirer</mat-label>
              <mat-select [value]="removeId()" (selectionChange)="removeId.set($event.value)">
                @for (p of registered(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button mat-stroked-button color="warn" type="button" [disabled]="!removeId() || busy()" (click)="remove()">
              Retirer
            </button>
          </div>
          <p class="hint">Un « Relais » reprend sa place : sa table passe de 4 à 3 joueurs.</p>
        </section>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .fix { margin-bottom: 24px; }
    .fix-avatar {
      display: flex; align-items: center; justify-content: center;
      background: #e8f0fe; color: #1565c0; border-radius: 12px;
    }
    .action { padding: 12px 0; border-top: 1px solid #eef0f4; }
    .action:first-child { border-top: none; padding-top: 4px; }
    h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 1em; font-weight: 600; }
    h3 small { font-weight: 400; color: #6b7280; }
    h3 mat-icon { color: #1976d2; }
    .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .row mat-form-field { width: 280px; }
    .arrow { color: #9aa4b5; }
    .hint { margin: 8px 0 0; color: #5b6478; font-size: 0.88em; }
  `,
})
export class PlacementFix implements OnChanges {
  round = input.required<Round>();
  // Prévient la page que le placement a changé (elle le recharge).
  changed = output<void>();

  private api = inject(ApiService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  private players = signal<Player[]>([]);
  private teams = signal<Team[]>([]);
  busy = signal(false);
  addId = signal<number | null>(null);
  fromId = signal<number | null>(null);
  toId = signal<number | null>(null);
  removeId = signal<number | null>(null);

  private byName = (a: Player, b: Player) =>
    `${a.name} ${a.firstname}`.localeCompare(`${b.name} ${b.firstname}`);
  private registeredIds = computed(
    () => new Set(this.teams().flatMap((t) => t.players.map((p) => p.player_id)))
  );
  registered = computed(() =>
    this.players().filter((p) => this.registeredIds().has(p.id) && !p.is_relais).sort(this.byName)
  );
  available = computed(() =>
    this.players().filter((p) => !this.registeredIds().has(p.id) && !p.is_relais).sort(this.byName)
  );
  // Première place « Relais » libre de la manche 1 (tables de 3).
  relaisSeat = computed<RoundSeat | null>(() => {
    for (const t of this.round().tables ?? []) {
      for (const s of t.seats) if (s.is_relais) return s;
    }
    return null;
  });

  ngOnChanges(): void {
    this.load();
  }

  private load(): void {
    forkJoin([this.api.players(), this.api.teams(this.round().sub_tournament_id)]).subscribe({
      next: ([p, t]) => {
        this.players.set(p);
        this.teams.set(t);
      },
    });
  }

  private name(id: number | null): string {
    const p = this.players().find((x) => x.id === id);
    return p ? `${p.name} ${p.firstname}` : 'ce joueur';
  }

  private done(msg: string): void {
    this.busy.set(false);
    this.addId.set(null);
    this.fromId.set(null);
    this.toId.set(null);
    this.removeId.set(null);
    this.snack.open(msg + ' — pensez à réimprimer placement et feuilles de marque.', 'Fermer', { duration: 6000 });
    this.changed.emit();
  }

  private failed(err: { error?: { error?: string } }): void {
    this.busy.set(false);
    alert(err?.error?.error || 'Opération impossible');
  }

  newPlayer(): void {
    const ref = this.dialog.open(PlayerDialog, { data: {} });
    ref.afterClosed().subscribe((created?: Player) => {
      if (!created) return;
      this.api.players().subscribe((p) => {
        this.players.set(p);
        this.addId.set(created.id);
      });
    });
  }

  add(): void {
    const id = this.addId();
    if (!id) return;
    const who = this.name(id);
    const subId = this.round().sub_tournament_id;
    const r = this.relaisSeat();
    if (r) {
      if (!confirm(`Ajouter ${who} à la place de ${r.name} ${r.firstname} (table ${r.table_number}, Nord), à toutes les manches ?`)) return;
      this.busy.set(true);
      this.api.substitutePlayer(subId, r.player_id, id).subscribe({
        next: () => this.done(`${who} ajouté à la table ${r.table_number}`),
        error: (e) => this.failed(e),
      });
      return;
    }
    if (!confirm(`Il n'y a plus de table de 3 : pour ajouter ${who}, les tables seront entièrement refaites (nouveau tirage).\n\nContinuer ?`)) return;
    // Le tirage complet se fait sur la page Joueurs présents, qui sait
    // refaire les tables (mêmes gardes et double confirmation).
    this.router.navigate(['/sub-tournaments', subId, 'teams'], { queryParams: { ajouter: id } });
  }

  replace(): void {
    const from = this.fromId();
    const to = this.toId();
    if (!from || !to) return;
    if (!confirm(`Remplacer ${this.name(from)} par ${this.name(to)}, à sa place, à toutes les manches ?`)) return;
    this.busy.set(true);
    this.api.substitutePlayer(this.round().sub_tournament_id, from, to).subscribe({
      next: () => this.done(`${this.name(from)} remplacé par ${this.name(to)}`),
      error: (e) => this.failed(e),
    });
  }

  remove(): void {
    const id = this.removeId();
    if (!id) return;
    const who = this.name(id);
    if (!confirm(`Retirer ${who} du placement ?\n\nUn « Relais » reprend sa place à toutes les manches. ${who} reste dans la liste des joueurs du club.`)) return;
    this.busy.set(true);
    const subId = this.round().sub_tournament_id;
    this.api.removePlacedPlayer(subId, id).subscribe({
      next: () => this.done(`${who} retiré du placement`),
      error: (e) => {
        this.busy.set(false);
        // Retrait refusé (une de ses tables passerait à 2 joueurs) : même
        // issue que pour un ajout sans table de 3, refaire les tables.
        const why = e?.error?.error || 'Retrait impossible sans refaire les tables.';
        if (!confirm(`${why}\n\nRefaire les tables sans ${who} (nouveau tirage, consignes de position conservées) ?`)) return;
        this.router.navigate(['/sub-tournaments', subId, 'teams'], { queryParams: { retirer: id } });
      },
    });
  }
}
