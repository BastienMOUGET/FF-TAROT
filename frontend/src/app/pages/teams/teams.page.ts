import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ApiService } from '../../core/api.service';
import { Pair, Player, Seat, Team } from '../../core/api.types';

type Orientation = 'random' | Seat | 'not_north';
import { PlayerDialog } from '../admin/dialogs/player-dialog';

@Component({
  selector: 'app-teams-page',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <button type="button" class="back" (click)="goBack()">
      <mat-icon>arrow_back</mat-icon> Retour
    </button>
    <h1>Joueurs présents</h1>

    <mat-card class="form-card draw-card">
      <mat-card-header>
        <mat-card-title>Tirage au sort — Manche 1</mat-card-title>
        <mat-card-subtitle>
          Sélectionne les joueurs présents, l'appli forme des tables de 4 (et
          de 3 si besoin, avec un « Relais » fixe en Nord) au hasard et génère
          la mise en place de la manche 1.
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (registeredPlayers().length > 0) {
          <!-- Une fois le tirage fait, les inscrits sortent de la liste à
               cocher : on les rappelle ici pour vérifier le pointage. -->
          <div class="registered">
            <div class="registered-head">
              {{ registeredPlayers().length }} joueur(s) déjà inscrit(s) dans ce tournoi
            </div>
            <div class="registered-list">
              @for (p of registeredPlayers(); track p.id) {
                <span class="chip-name">{{ p.name }} {{ p.firstname }}</span>
              }
            </div>
          </div>
        }
        @if (availablePlayers().length === 0) {
          <p class="empty">
            Tous les joueurs connus sont déjà inscrits dans ce tournoi. Pour
            en ajouter un, « Nouveau joueur » ; pour corriger un pointage,
            « Remplacer un joueur » plus bas.
          </p>
          <button mat-button type="button" (click)="openNewPlayer()">
            <mat-icon>person_add</mat-icon> Nouveau joueur
          </button>
        } @else {
          <mat-form-field appearance="outline" class="full search">
            <mat-label>Filtrer</mat-label>
            <input
              matInput
              [value]="drawFilter()"
              (input)="drawFilter.set($any($event.target).value)"
              placeholder="nom, prénom, licence…"
            />
          </mat-form-field>

          <div class="draw-toolbar">
            <button mat-button type="button" (click)="selectAllDraw()">
              Tout sélectionner
            </button>
            <button mat-button type="button" (click)="clearDrawSelection()">
              Tout désélectionner
            </button>
            <button mat-button type="button" (click)="openNewPlayer()">
              <mat-icon>person_add</mat-icon> Nouveau joueur
            </button>
            <span class="spacer"></span>
            <span
              class="draw-count"
              [class.warn]="drawCount() > 0 && !canDraw()"
            >
              {{ drawCount() }} joueur(s) sélectionné(s)
              @if (drawCount() > 0) {
                @if (drawPlan(); as plan) {
                  →
                  @if (plan.fours > 0) {
                    {{ plan.fours }} table(s) de 4
                  }
                  @if (plan.fours > 0 && plan.threes > 0) {
                    +
                  }
                  @if (plan.threes > 0) {
                    {{ plan.threes }} table(s) de 3
                  }
                } @else {
                  (nombre impossible à répartir en tables de 3 ou 4 — ajoute
                  ou retire un joueur)
                }
              }
            </span>
          </div>

          <div class="draw-list">
            @for (p of filteredAvailablePlayers(); track p.id) {
              <div class="draw-row">
                <mat-checkbox
                  [checked]="drawSelection().has(p.id)"
                  (change)="toggleDraw(p.id)"
                >
                  {{ p.name }} {{ p.firstname }}
                  @if (p.licence) {
                    <small>({{ p.licence }})</small>
                  }
                </mat-checkbox>
                <button
                  mat-icon-button
                  type="button"
                  class="edit-player"
                  (click)="editPlayer(p)"
                  title="Corriger le nom de ce joueur"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                @if (drawSelection().has(p.id)) {
                  <mat-select
                    class="orientation-select"
                    [value]="orientationFor(p.id)"
                    (selectionChange)="setOrientation(p.id, $event.value)"
                  >
                    <mat-option value="random">Position aléatoire</mat-option>
                    <mat-option value="N">Nord fixe</mat-option>
                    <mat-option value="S">Sud fixe</mat-option>
                    <mat-option value="E">Est fixe</mat-option>
                    <mat-option value="O">Ouest fixe</mat-option>
                    <mat-option value="not_north">Non Nord</mat-option>
                  </mat-select>
                }
              </div>
            }
          </div>
        }
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          mat-flat-button
          color="primary"
          [disabled]="!canDraw() || drawing()"
          (click)="randomDraw()"
        >
          <mat-icon>shuffle</mat-icon> Tirer au sort et générer la manche 1
        </button>
      </mat-card-actions>
    </mat-card>

    @if (registeredPlayers().length > 0) {
      <mat-card class="form-card swap-card">
        <mat-card-header>
          <mat-card-title>Remplacer un joueur</mat-card-title>
          <mat-card-subtitle>
            Une case cochée à côté de la bonne au pointage ? Le remplacement
            reprend la place et les points déjà saisis, sur toutes les manches.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="swap-row">
            <mat-form-field appearance="outline">
              <mat-label>Joueur inscrit par erreur</mat-label>
              <mat-select [value]="swapFrom()" (selectionChange)="swapFrom.set($event.value)">
                @for (p of registeredPlayers(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-icon class="swap-arrow">arrow_forward</mat-icon>
            <mat-form-field appearance="outline">
              <mat-label>Joueur réellement présent</mat-label>
              <mat-select [value]="swapTo()" (selectionChange)="swapTo.set($event.value)">
                @for (p of availablePlayers(); track p.id) {
                  <mat-option [value]="p.id">{{ p.name }} {{ p.firstname }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <button
              mat-flat-button
              color="primary"
              [disabled]="!swapFrom() || !swapTo() || swapping()"
              (click)="doSubstitute()"
            >
              <mat-icon>swap_horiz</mat-icon> Remplacer
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    }

    <mat-card class="form-card">
      <mat-card-header>
        <mat-card-title>Nouvelle équipe (Libre par 3 ou 4)</mat-card-title>
        <mat-card-subtitle>
          @if (teamSize() === 4) {
            2 joueurs NS + 2 joueurs EO
          } @else {
            2 joueurs NS + 1 joueur EO
          }
        </mat-card-subtitle>
        <button
          mat-icon-button
          type="button"
          (click)="openNewPlayer()"
          title="Nouveau joueur"
        >
          <mat-icon>person_add</mat-icon>
        </button>
      </mat-card-header>
      <mat-card-content>
        <mat-button-toggle-group
          class="size-toggle"
          [value]="teamSize()"
          (change)="setTeamSize($event.value)"
        >
          <mat-button-toggle [value]="4">4 joueurs</mat-button-toggle>
          <mat-button-toggle [value]="3">3 joueurs</mat-button-toggle>
        </mat-button-toggle-group>
        <form [formGroup]="form" (ngSubmit)="add()">
          <div class="grid">
            @for (slot of slots(); track slot.idx) {
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
      background: none; border: none; font: inherit; cursor: pointer; padding: 0;
    }
    .form-card { margin-bottom: 24px; }
    .draw-card mat-card-subtitle { margin-top: 4px; }
    .search.full { width: 100%; margin-top: 12px; }
    .draw-toolbar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .draw-toolbar .spacer { flex: 1 1 auto; }
    .draw-count { color: #757575; font-size: 0.9em; }
    .draw-count.warn { color: #c62828; }
    .draw-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 4px 12px;
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 4px;
      padding: 8px 12px;
    }
    .draw-list small { color: #757575; }
    .draw-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 0; }
    .draw-row mat-checkbox { flex: 1 1 auto; }
    .registered { margin: 4px 0 16px; padding: 10px 12px; background: #f1f8e9; border-radius: 8px; }
    .registered-head { font-weight: 600; margin-bottom: 6px; }
    .registered-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip-name {
      background: #fff; border: 1px solid #c5e1a5; border-radius: 12px;
      padding: 2px 10px; font-size: 0.9em;
    }
    .swap-card mat-card-content { padding-top: 16px; }
    .swap-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .swap-row mat-form-field { min-width: 240px; }
    .swap-arrow { color: #757575; }
    .edit-player { opacity: 0.5; }
    .draw-row:hover .edit-player { opacity: 1; }
    .orientation-select { width: 150px; font-size: 0.85em; }
    .size-toggle { margin-bottom: 16px; }
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
  private router = inject(Router);
  private location = inject(Location);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  subTournamentId = signal(0);
  players = signal<Player[]>([]);
  teams = signal<Team[]>([]);
  saving = signal(false);

  drawSelection = signal<Set<number>>(new Set());
  drawFilter = signal('');
  drawing = signal(false);
  drawOrientation = signal<Map<number, Orientation>>(new Map());

  orientationFor(playerId: number): Orientation {
    return this.drawOrientation().get(playerId) ?? 'random';
  }

  setOrientation(playerId: number, o: Orientation): void {
    this.drawOrientation.update((m) => {
      const next = new Map(m);
      if (o === 'random') next.delete(playerId);
      else next.set(playerId, o);
      return next;
    });
    this.persistDraw();
  }

  registeredPlayerIds = computed(
    () => new Set(this.teams().flatMap((t) => t.players.map((p) => p.player_id)))
  );
  // Inscrits de ce tournoi, hors Relais (un Relais ne se remplace pas).
  registeredPlayers = computed(() =>
    this.players()
      .filter((p) => this.registeredPlayerIds().has(p.id) && !p.is_relais)
      .sort((a, b) => `${a.name} ${a.firstname}`.localeCompare(`${b.name} ${b.firstname}`))
  );
  swapFrom = signal<number | null>(null);
  swapTo = signal<number | null>(null);
  swapping = signal(false);
  availablePlayers = computed(() =>
    this.players().filter((p) => !this.registeredPlayerIds().has(p.id))
  );
  filteredAvailablePlayers = computed(() => {
    const q = this.drawFilter().trim().toLowerCase();
    if (!q) return this.availablePlayers();
    return this.availablePlayers().filter((p) =>
      `${p.name} ${p.firstname} ${p.licence ?? ''}`.toLowerCase().includes(q)
    );
  });
  drawCount = computed(() => this.drawSelection().size);
  drawPlan = computed(() => this.decompose(this.drawCount()));
  canDraw = computed(() => this.drawPlan() !== null);

  teamSize = signal<3 | 4>(4);
  slots = computed(() => {
    const base = [
      { idx: 1, label: 'Joueur 1', pair: 'NS' as const },
      { idx: 2, label: 'Joueur 2', pair: 'NS' as const },
      { idx: 3, label: 'Joueur 3', pair: 'EO' as const },
    ];
    if (this.teamSize() === 4) {
      base.push({ idx: 4, label: 'Joueur 4', pair: 'EO' as const });
    }
    return base;
  });

  form = this.fb.nonNullable.group({
    p1: [null as number | null, Validators.required],
    p2: [null as number | null, Validators.required],
    p3: [null as number | null, Validators.required],
    p4: [null as number | null, Validators.required],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.subTournamentId.set(id);
    this.restoreDraw();
    this.api.players().subscribe((p) => this.players.set(p));
    this.refreshTeams();
  }

  // Le pointage des présents survit à un aller-retour vers l'administration
  // (corriger un nom, ajouter un joueur) : la sélection et les orientations
  // sont gardées dans le navigateur, par tournoi, jusqu'au tirage au sort.
  private drawKey(): string {
    return `pabb90.draw.${this.subTournamentId()}`;
  }

  private restoreDraw(): void {
    try {
      const raw = localStorage.getItem(this.drawKey());
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        ids?: number[];
        orientations?: [number, Orientation][];
      };
      if (saved.ids?.length) this.drawSelection.set(new Set(saved.ids));
      if (saved.orientations?.length) {
        this.drawOrientation.set(new Map(saved.orientations));
      }
    } catch {
      /* stockage indisponible ou contenu illisible : on repart à vide */
    }
  }

  private persistDraw(): void {
    try {
      const ids = Array.from(this.drawSelection());
      if (ids.length === 0 && this.drawOrientation().size === 0) {
        localStorage.removeItem(this.drawKey());
        return;
      }
      localStorage.setItem(
        this.drawKey(),
        JSON.stringify({
          ids,
          orientations: Array.from(this.drawOrientation().entries()),
        })
      );
    } catch {
      /* pas de stockage : la sélection reste valable pour la page en cours */
    }
  }

  refreshTeams(): void {
    this.api.teams(this.subTournamentId()).subscribe((t) => this.teams.set(t));
  }

  setTeamSize(size: 3 | 4): void {
    this.teamSize.set(size);
    const p4 = this.form.controls.p4;
    if (size === 3) {
      p4.clearValidators();
      p4.setValue(null);
    } else {
      p4.setValidators(Validators.required);
    }
    p4.updateValueAndValidity();
  }

  add(): void {
    const v = this.form.getRawValue();
    const size = this.teamSize();
    const ids = size === 4 ? [v.p1, v.p2, v.p3, v.p4] : [v.p1, v.p2, v.p3];
    if (ids.some((id) => !id)) return;
    if (new Set(ids).size !== ids.length) {
      this.snack.open('Doublon : un joueur est sélectionné plusieurs fois', 'Fermer', { duration: 3000 });
      return;
    }
    const players =
      size === 4
        ? [
            { player_id: v.p1!, pair: 'NS' as Pair },
            { player_id: v.p2!, pair: 'NS' as Pair },
            { player_id: v.p3!, pair: 'EO' as Pair },
            { player_id: v.p4!, pair: 'EO' as Pair },
          ]
        : [
            { player_id: v.p1!, pair: 'NS' as Pair },
            { player_id: v.p2!, pair: 'NS' as Pair },
            { player_id: v.p3!, pair: 'EO' as Pair },
          ];
    this.saving.set(true);
    this.api
      .createTeam(this.subTournamentId(), players)
      .subscribe({
        next: () => {
          this.snack.open('Équipe inscrite', 'Fermer', { duration: 2000 });
          this.form.reset();
          this.setTeamSize(this.teamSize());
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

  goBack(): void {
    this.location.back();
  }

  openNewPlayer(): void {
    const ref = this.dialog.open(PlayerDialog, { data: {} });
    ref.afterClosed().subscribe((created: Player | undefined) => {
      if (!created) return;
      this.players.update((list) => [...list, created]);
      this.drawSelection.update((s) => new Set(s).add(created.id));
      this.persistDraw();
      this.snack.open(`${created.name} ${created.firstname} ajouté(e)`, 'Fermer', {
        duration: 2000,
      });
    });
  }

  toggleDraw(playerId: number): void {
    this.drawSelection.update((s) => {
      const next = new Set(s);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
    this.persistDraw();
  }

  selectAllDraw(): void {
    this.drawSelection.set(new Set(this.filteredAvailablePlayers().map((p) => p.id)));
    this.persistDraw();
  }

  clearDrawSelection(): void {
    this.drawSelection.set(new Set());
    this.persistDraw();
  }

  // Remplacement d'un joueur : le serveur reprend l'inscription, les places
  // de chaque manche et refait le classement. Les scores restent à la table,
  // ils changent simplement de titulaire.
  doSubstitute(): void {
    const from = this.swapFrom();
    const to = this.swapTo();
    if (!from || !to) return;
    const fromP = this.players().find((p) => p.id === from);
    const toP = this.players().find((p) => p.id === to);
    const label = (p?: Player) => (p ? `${p.name} ${p.firstname}` : '');
    if (
      !confirm(
        `Remplacer ${label(fromP)} par ${label(toP)} dans tout ce tournoi ?\n\n` +
          `${label(toP)} reprend sa place à la table et les points déjà ` +
          `saisis. Le classement est recalculé.`
      )
    ) {
      return;
    }
    this.swapping.set(true);
    this.api.substitutePlayer(this.subTournamentId(), from, to).subscribe({
      next: (r) => {
        this.swapping.set(false);
        this.swapFrom.set(null);
        this.swapTo.set(null);
        this.snack.open(
          `${r.to} remplace ${r.from} (${r.seats_changed} place(s) mise(s) à jour)`,
          'Fermer',
          { duration: 5000 }
        );
        this.refreshTeams();
      },
      error: (err) => {
        this.swapping.set(false);
        this.snack.open(err?.error?.error || 'Remplacement impossible', 'Fermer', {
          duration: 6000,
        });
      },
    });
  }

  // Corriger un nom sans quitter le pointage (faute de frappe repérée en
  // cochant les présents).
  editPlayer(player: Player): void {
    const ref = this.dialog.open(PlayerDialog, { data: { player } });
    ref.afterClosed().subscribe((updated: Player | undefined) => {
      if (!updated) return;
      this.players.update((list) =>
        list.map((p) => (p.id === updated.id ? updated : p))
      );
      this.snack.open('Joueur modifié', 'Fermer', { duration: 2000 });
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Décompose n joueurs en tables de 4 (prioritaire) + tables de 3 pour
  // finir correctement quand n n'est pas un multiple de 4. Infaisable
  // seulement pour n < 3 ou n === 5.
  private decompose(n: number): { fours: number; threes: number } | null {
    if (n < 3) return null;
    const r = n % 4;
    const threes = r === 0 ? 0 : r === 1 ? 3 : r === 2 ? 2 : 1;
    const remaining = n - threes * 3;
    if (remaining < 0 || remaining % 4 !== 0) return null;
    return { fours: remaining / 4, threes };
  }

  // Répartit un groupe de joueurs sur les sièges disponibles en respectant
  // au mieux les orientations demandées (fixe N/S/E/O, ou non-Nord) :
  // 1) préférences fixes, 2) non-Nord sur un siège != N si possible,
  // 3) le reste au hasard sur les sièges restants. `unmet` compte les
  // préférences qui n'ont pas pu être honorées (conflit à la même table).
  private assignSeats(
    group: number[],
    seatPool: Seat[]
  ): { assigned: { id: number; seat: Seat }[]; unmet: number } {
    const orient = this.drawOrientation();
    const remaining = new Set<Seat>(seatPool);
    const result: { id: number; seat: Seat }[] = [];
    let unmet = 0;

    for (const id of group) {
      const o = orient.get(id);
      if (o && o !== 'random' && o !== 'not_north' && remaining.has(o)) {
        result.push({ id, seat: o });
        remaining.delete(o);
      } else if (o && o !== 'random' && o !== 'not_north') {
        unmet++;
      }
    }

    for (const id of group) {
      if (result.some((r) => r.id === id)) continue;
      if (orient.get(id) !== 'not_north') continue;
      const choice =
        [...remaining].find((s) => s !== 'N') ?? [...remaining][0];
      if (choice === undefined) continue;
      if (choice === 'N') unmet++;
      result.push({ id, seat: choice });
      remaining.delete(choice);
    }

    const rest = this.shuffle(group.filter((id) => !result.some((r) => r.id === id)));
    const seatsLeft = this.shuffle([...remaining]);
    rest.forEach((id, i) => result.push({ id, seat: seatsLeft[i] }));

    return { assigned: result, unmet };
  }

  // Reconstruit le tableau player_id/pair attendu par l'API dans l'ordre
  // N,S,E,O — cet ordre détermine le player_number (1..4) donc le siège
  // final (cf modules/teams/teams.am : NS d'abord, EO ensuite).
  // Le siège est aussi envoyé explicitement (team_players.seat, v3.0.22) :
  // la mise en place de la manche 1 le respecte tel quel, y compris la
  // place vide d'une table de 3.
  private toPayload(
    assigned: { id: number; seat: Seat }[]
  ): { player_id: number; pair: Pair; seat: Seat }[] {
    const bySeat = new Map(assigned.map((a) => [a.seat, a.id]));
    const payload: { player_id: number; pair: Pair; seat: Seat }[] = [];
    for (const seat of ['N', 'S', 'E', 'O'] as Seat[]) {
      const id = bySeat.get(seat);
      if (id === undefined) continue;
      payload.push({ player_id: id, pair: seat === 'N' || seat === 'S' ? 'NS' : 'EO', seat });
    }
    return payload;
  }

  randomDraw(): void {
    const plan = this.drawPlan();
    if (!plan || this.drawing()) return;
    const nbTeams = plan.fours + plan.threes;
    const detail =
      plan.threes > 0
        ? `${plan.fours} de 4 + ${plan.threes} de 3`
        : `${plan.fours} de 4`;
    if (
      !confirm(
        `Tirer au sort ${this.drawCount()} joueurs en ${nbTeams} équipe(s) (${detail}) et générer la mise en place de la manche 1 ?`
      )
    ) {
      return;
    }

    const ids = this.shuffle(Array.from(this.drawSelection()));
    const payloads: { player_id: number; pair: Pair; seat: Seat }[][] = [];
    let cursor = 0;
    let unmetOrientations = 0;
    for (let i = 0; i < plan.fours; i++) {
      const group = ids.slice(cursor, cursor + 4);
      cursor += 4;
      const { assigned, unmet } = this.assignSeats(group, ['N', 'S', 'E', 'O']);
      unmetOrientations += unmet;
      payloads.push(this.toPayload(assigned));
    }
    for (let i = 0; i < plan.threes; i++) {
      const group = ids.slice(cursor, cursor + 3);
      cursor += 3;
      // Table de 3 : Nord est occupé par le joueur virtuel « Relais », fixe
      // à sa table toute la soirée (règle du club, retour terrain n°4). Les
      // 3 vrais joueurs se répartissent S, E, O ; le back pose le relais.
      const { assigned, unmet } = this.assignSeats(group, ['S', 'E', 'O']);
      unmetOrientations += unmet;
      payloads.push(this.toPayload(assigned));
    }

    this.drawing.set(true);
    from(payloads)
      .pipe(
        concatMap((players) => this.api.createTeam(this.subTournamentId(), players)),
        toArray()
      )
      .subscribe({
        next: () => {
          this.drawSelection.set(new Set());
          this.drawOrientation.set(new Map());
          this.persistDraw();
          this.refreshTeams();
          const msg =
            `${nbTeams} équipe(s) tirée(s) au sort` +
            (unmetOrientations > 0
              ? ` — ${unmetOrientations} orientation(s) demandée(s) non respectée(s) (conflit à la même table)`
              : '');
          this.snack.open(msg, 'Fermer', { duration: unmetOrientations > 0 ? 5000 : 2000 });
          this.generateFirstRound();
        },
        error: (err) => {
          this.drawing.set(false);
          this.refreshTeams();
          this.snack.open(
            err?.error?.error || 'Erreur pendant le tirage au sort',
            'Fermer',
            { duration: 3000 }
          );
        },
      });
  }

  private generateFirstRound(): void {
    this.api.rounds(this.subTournamentId()).subscribe({
      next: (rounds) => {
        const existing = rounds.find((r) => r.round_number === 1);
        if (existing) {
          this.applyPlacement(existing.id);
        } else {
          this.api.createRound(this.subTournamentId()).subscribe({
            next: (round) => this.applyPlacement(round.id),
            error: (err) => {
              this.drawing.set(false);
              this.snack.open(
                err?.error?.error || 'Erreur création de la manche 1',
                'Fermer',
                { duration: 3000 }
              );
            },
          });
        }
      },
      error: () => this.drawing.set(false),
    });
  }

  // Après la manche 1, les manches 2..N prévues sur le tournoi sont créées
  // et placées tout de suite (mouvement déterministe) : les feuilles de
  // marque de toute la soirée s'impriment dès le début.
  private generatePlannedRounds(firstRoundId: number): void {
    const subId = this.subTournamentId();
    this.api.subTournament(subId).subscribe({
      next: (sub) => {
        const asked = Math.max(1, Number(sub.rounds_planned ?? 1));
        // En placement par niveau, une manche dépend du classement de la
        // précédente : on ne peut pas les générer d'avance. Seul le mode
        // « mouvement » permet de tout sortir dès le tirage au sort.
        const mode = sub.placement_mode ?? 'movement';
        const planned =
          mode === 'level' ? 1 : mode === 'level_last' ? Math.max(1, asked - 1) : asked;
        this.api.rounds(subId).subscribe((rounds) => {
          const missing = planned - rounds.length;
          const done = () => {
            this.drawing.set(false);
            this.snack.open(
              planned > 1
                ? `Mise en place générée pour les ${planned} premières manches`
                : 'Mise en place de la manche 1 générée',
              'Fermer',
              { duration: 2500 }
            );
            this.router.navigate(['/rounds', firstRoundId]);
          };
          if (missing <= 0) return done();
          from(Array.from({ length: missing }))
            .pipe(
              concatMap(() =>
                this.api.createRound(subId).pipe(concatMap((r) => this.api.generatePlacement(r.id)))
              ),
              toArray()
            )
            .subscribe({ next: done, error: done });
        });
      },
      error: () => {
        this.drawing.set(false);
        this.router.navigate(['/rounds', firstRoundId]);
      },
    });
  }

  private applyPlacement(roundId: number): void {
    this.api.generatePlacement(roundId).subscribe({
      next: () => this.generatePlannedRounds(roundId),
      error: (err) => {
        this.drawing.set(false);
        this.snack.open(
          err?.error?.error || 'Erreur génération de la mise en place',
          'Fermer',
          { duration: 3000 }
        );
      },
    });
  }
}
