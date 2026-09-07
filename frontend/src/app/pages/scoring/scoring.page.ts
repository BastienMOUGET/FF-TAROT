import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { from, of } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';

import { ApiService } from '../../core/api.service';
import { Hand, Round, RoundSeat, Seat, TableResult } from '../../core/api.types';

const SEATS: Seat[] = ['N', 'S', 'E', 'O'];
const DEFAULT_DONNES = 6;

// Une ligne de saisie (mode détail : une donne ; mode global : la table).
// Les scores sont des chaînes : vide = pas encore saisi. `auto` marque le
// siège calculé automatiquement pour que la somme fasse 0.
interface Row {
  id: number | null; // hand id existant, null = à créer
  hand_number: number;
  taker: Seat | '';
  scores: Record<Seat, string>;
  auto: Seat | null;
}

@Component({
  selector: 'app-scoring-page',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  template: `
    <div class="topbar">
      <a [routerLink]="['/rounds', roundId()]" class="back">
        <mat-icon>arrow_back</mat-icon> Manche {{ round()?.round_number }}
      </a>
      <!-- Raccourcis : les résultats arrivent dans un ordre aléatoire, on
           passe d'une table à l'autre sans repasser par la manche. -->
      <div class="tables-nav">
        @for (t of allTables(); track t.table_number) {
          <a
            [routerLink]="['/rounds', roundId(), 'tables', t.table_number]"
            class="tab"
            [class.current]="t.table_number === tableNumber()"
            [class.done]="validatedTables().has(t.table_number)"
          >
            @if (validatedTables().has(t.table_number)) {
              <mat-icon>check</mat-icon>
            }
            Table {{ t.table_number }}
          </a>
        }
      </div>
    </div>

    <h1>Saisie — Manche {{ round()?.round_number }}, Table {{ tableNumber() }}</h1>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else {
      <mat-card class="players">
        <mat-card-content>
          <div class="seat-row">
            @for (s of seatsAll; track s) {
              <div class="seat-card" [attr.data-seat]="s" [class.vacant]="!playerAt(s)">
                <div class="seat-letter">{{ seatLabel(s) }}</div>
                <div class="player">{{ playerAt(s) || 'place vide' }}</div>
                @if (table(); as t) {
                  <div class="total-value">{{ playerAt(s) ? scoreFor(t, s) : '' }}</div>
                }
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <div class="mode-bar">
        <mat-button-toggle-group [value]="entryMode()" (change)="switchMode($event.value)">
          <mat-button-toggle value="global">Résultat global de la table</mat-button-toggle>
          <mat-button-toggle value="detail">Détail donne par donne</mat-button-toggle>
        </mat-button-toggle-group>
        <span class="spacer"></span>
        @if (table()?.validated) {
          <mat-chip class="validated-chip"><mat-icon>check</mat-icon> Table validée</mat-chip>
        }
        <button
          mat-flat-button
          color="primary"
          (click)="save()"
          [disabled]="saving() || !canSave()"
        >
          <mat-icon>check</mat-icon>
          {{ table()?.validated ? 'Enregistrer les corrections' : 'Valider le résultat de la table' }}
        </button>
      </div>

      @if (entryMode() === 'global') {
        <mat-card class="entry">
          <mat-card-content>
            <p class="hint">
              Un score par joueur pour toute la manche. Saisis-en
              {{ activeSeats().length - 1 }}, le dernier se calcule pour que la
              somme fasse 0.
            </p>
            <table class="grid">
              <thead>
                <tr>
                  @for (s of seatsAll; track s) {
                    <th [class.vacant]="!playerAt(s)">
                      <span class="seat" [attr.data-seat]="s">{{ s }}</span>
                      <div class="name">{{ playerAt(s) || '—' }}</div>
                    </th>
                  }
                  <th class="sum">Somme</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  @for (s of seatsAll; track s) {
                    <td [class.vacant]="!playerAt(s)">
                      <input
                        class="score"
                        [class.auto]="globalRow().auto === s"
                        type="text"
                        inputmode="numeric"
                        pattern="-?[0-9]*"
                        [value]="globalRow().scores[s]"
                        [disabled]="!playerAt(s)"
                        (input)="onScore(globalRow(), s, $any($event.target).value)"
                      />
                    </td>
                  }
                  <td class="sum" [class.ok]="rowSum(globalRow()) === 0" [class.bad]="rowSum(globalRow()) !== 0">
                    {{ rowSum(globalRow()) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="entry">
          <mat-card-content>
            <p class="hint">
              Toutes les donnes sont visibles d'un coup : corrige une valeur
              directement dans la grille. Le dernier score de chaque donne se
              calcule pour que la somme fasse 0.
            </p>
            <table class="grid detail">
              <thead>
                <tr>
                  <th class="num">Donne</th>
                  <th class="taker">Preneur</th>
                  @for (s of seatsAll; track s) {
                    <th [class.vacant]="!playerAt(s)">
                      <span class="seat" [attr.data-seat]="s">{{ s }}</span>
                      <div class="name">{{ playerAt(s) || '—' }}</div>
                    </th>
                  }
                  <th class="sum">Somme</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.hand_number) {
                  <tr>
                    <td class="num">{{ row.hand_number }}</td>
                    <td class="taker">
                      <select [value]="row.taker" (change)="setTaker(row, $any($event.target).value)">
                        <option value="">—</option>
                        @for (s of activeSeats(); track s) {
                          <option [value]="s">{{ s }}</option>
                        }
                      </select>
                    </td>
                    @for (s of seatsAll; track s) {
                      <td [class.vacant]="!playerAt(s)">
                        <input
                          class="score"
                          [class.auto]="row.auto === s"
                          type="text"
                          inputmode="numeric"
                          pattern="-?[0-9]*"
                          [value]="row.scores[s]"
                          [disabled]="!playerAt(s)"
                          (input)="onScore(row, s, $any($event.target).value)"
                        />
                      </td>
                    }
                    <td class="sum" [class.ok]="rowEmpty(row) || rowSum(row) === 0" [class.bad]="!rowEmpty(row) && rowSum(row) !== 0">
                      {{ rowEmpty(row) ? '' : rowSum(row) }}
                    </td>
                    <td>
                      <button mat-icon-button type="button" (click)="clearRow(row)" title="Effacer la donne">
                        <mat-icon>backspace</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
                <tr class="totals">
                  <td class="num" colspan="2">Total</td>
                  @for (s of seatsAll; track s) {
                    <td [class.vacant]="!playerAt(s)">{{ playerAt(s) ? colTotal(s) : '' }}</td>
                  }
                  <td class="sum" [class.ok]="grandTotal() === 0" [class.bad]="grandTotal() !== 0">{{ grandTotal() }}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            <button mat-button type="button" (click)="addRow()">
              <mat-icon>add</mat-icon> Ajouter une donne
            </button>
          </mat-card-content>
        </mat-card>
      }

      @if (table()?.validated && nextTable(); as n) {
        <div class="next">
          <a mat-stroked-button color="primary" [routerLink]="['/rounds', roundId(), 'tables', n]">
            Table {{ n }} suivante <mat-icon>arrow_forward</mat-icon>
          </a>
          <a mat-button [routerLink]="['/rounds', roundId(), 'ranking']">
            <mat-icon>format_list_numbered</mat-icon> Classement de la manche
          </a>
        </div>
      } @else if (table()?.validated) {
        <div class="next">
          <a mat-flat-button color="primary" [routerLink]="['/rounds', roundId(), 'ranking']">
            <mat-icon>format_list_numbered</mat-icon> Toutes les tables sont validées : classement de la manche
          </a>
        </div>
      }
    }
  `,
  styles: `
    .topbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .back { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; color: #1976d2; }
    .tables-nav { display: flex; gap: 6px; flex-wrap: wrap; }
    .tab {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 4px 10px; border-radius: 16px; border: 1px solid #bdbdbd;
      text-decoration: none; color: #424242; font-size: 0.9em;
    }
    .tab mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tab.done { background: #e8f5e9; border-color: #81c784; color: #2e7d32; }
    .tab.current { background: #1976d2; border-color: #1976d2; color: #fff; font-weight: 600; }
    h1 { margin: 8px 0 16px; }
    .players { margin-bottom: 12px; }
    .seat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .seat-card { padding: 10px; border-radius: 8px; text-align: center; }
    .seat-card[data-seat="N"] { background: #ffb74d; color: #4e342e; }
    .seat-card[data-seat="S"] { background: #4fc3f7; color: #01579b; }
    .seat-card[data-seat="E"] { background: #ff8a65; color: #4e342e; }
    .seat-card[data-seat="O"] { background: #aed581; color: #33691e; }
    .seat-card.vacant { opacity: 0.45; }
    .seat-letter { font-size: 1.1em; font-weight: 700; }
    .player { font-size: 1em; font-weight: 600; }
    .total-value { font-size: 1.5em; font-weight: 700; margin-top: 4px; min-height: 1.2em; }
    .mode-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .spacer { flex: 1 1 auto; }
    .validated-chip { background: #c8e6c9; }
    .entry { margin-bottom: 16px; }
    .hint { color: #616161; margin: 0 0 12px; }
    .grid { border-collapse: collapse; width: 100%; }
    .grid th, .grid td { padding: 6px 8px; text-align: center; border-bottom: 1px solid #eee; }
    .grid th .name { font-weight: 500; font-size: 0.85em; color: #424242; margin-top: 2px; }
    .grid th.vacant, .grid td.vacant { opacity: 0.4; }
    .grid .num { width: 60px; font-weight: 600; }
    .grid .taker { width: 90px; }
    .grid .taker select { font-size: 1.1em; padding: 4px; }
    .grid .sum { width: 80px; font-weight: 700; }
    .sum.ok { color: #2e7d32; }
    .sum.bad { color: #c62828; }
    .totals td { font-weight: 700; background: #fafafa; }
    input.score {
      width: 90px; font-size: 1.25em; text-align: center; padding: 6px 4px;
      border: 1px solid #bdbdbd; border-radius: 6px;
      -moz-appearance: textfield; appearance: textfield;
    }
    input.score:focus { outline: 2px solid #1976d2; border-color: #1976d2; }
    input.score.auto { background: #fff8e1; border-style: dashed; }
    input.score:disabled { background: #f5f5f5; }
    .seat {
      display: inline-block; min-width: 24px; padding: 2px 6px; border-radius: 4px; font-weight: 700;
    }
    .seat[data-seat='N'] { background: #ffb74d; color: #4e342e; }
    .seat[data-seat='S'] { background: #4fc3f7; color: #01579b; }
    .seat[data-seat='E'] { background: #ff8a65; color: #4e342e; }
    .seat[data-seat='O'] { background: #aed581; color: #33691e; }
    .next { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  `,
})
export class ScoringPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);

  seatsAll = SEATS;

  loading = signal(true);
  saving = signal(false);
  roundId = signal(0);
  tableNumber = signal(0);
  round = signal<Round | null>(null);
  seats = signal<RoundSeat[]>([]);
  table = signal<TableResult | null>(null);
  validatedTables = signal<Set<number>>(new Set());
  entryMode = signal<'global' | 'detail'>('global');

  rows = signal<Row[]>([]);
  globalRow = signal<Row>(this.emptyRow(1));

  allTables = computed(() => this.round()?.tables ?? []);
  activeSeats = computed<Seat[]>(() =>
    SEATS.filter((s) => this.seats().some((x) => x.seat === s))
  );

  ngOnInit(): void {
    // La page est réutilisée d'une table à l'autre (raccourcis) : on
    // recharge à chaque changement de paramètre.
    this.route.paramMap.subscribe((pm) => {
      this.roundId.set(Number(pm.get('id')));
      this.tableNumber.set(Number(pm.get('tableNumber')));
      this.loadAll();
    });
  }

  // ---------------------------------------------------------------- chargement

  loadAll(): void {
    this.loading.set(true);
    this.api.round(this.roundId()).subscribe({
      next: (round) => {
        this.round.set(round);
        const tableSeats = (round.tables || []).find(
          (x) => x.table_number === this.tableNumber()
        );
        this.seats.set(tableSeats?.seats || []);
        this.api.tableResults(this.roundId()).subscribe((all) => {
          this.validatedTables.set(
            new Set(all.filter((t) => !!t.validated).map((t) => t.table_number))
          );
        });
        this.api.tableResult(this.roundId(), this.tableNumber()).subscribe({
          next: (tr) => {
            this.table.set(tr);
            this.fillFrom(tr);
            this.loading.set(false);
          },
          error: () => {
            // Pas encore de table_result : grille vierge.
            this.table.set(null);
            this.fillFrom(null);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.snack.open('Manche introuvable', 'Fermer', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  private emptyRow(n: number): Row {
    return { id: null, hand_number: n, taker: '', scores: { N: '', S: '', E: '', O: '' }, auto: null };
  }

  private rowFromHand(h: Hand): Row {
    return {
      id: h.id,
      hand_number: h.hand_number,
      taker: h.taker_seat ?? '',
      scores: {
        N: String(h.score_n), S: String(h.score_s), E: String(h.score_e), O: String(h.score_o),
      },
      auto: null,
    };
  }

  private fillFrom(tr: TableResult | null): void {
    const hands = tr?.hands ?? [];
    if (hands.length > 1) {
      // Saisie détaillée existante → mode détail, toutes les donnes visibles.
      this.entryMode.set('detail');
      const rows = hands.map((h) => this.rowFromHand(h));
      const max = Math.max(DEFAULT_DONNES, ...rows.map((r) => r.hand_number));
      for (let n = 1; n <= max; n++) {
        if (!rows.some((r) => r.hand_number === n)) rows.push(this.emptyRow(n));
      }
      rows.sort((a, b) => a.hand_number - b.hand_number);
      this.rows.set(rows);
      this.globalRow.set(this.emptyRow(1));
    } else {
      this.entryMode.set('global');
      this.globalRow.set(hands.length === 1 ? this.rowFromHand(hands[0]) : this.emptyRow(1));
      this.rows.set(Array.from({ length: DEFAULT_DONNES }, (_, i) => this.emptyRow(i + 1)));
    }
    // Sièges vides (table de 3) : score 0 figé.
    for (const s of SEATS) {
      if (!this.playerAt(s)) {
        this.globalRow().scores[s] = '0';
        for (const r of this.rows()) r.scores[s] = '0';
      }
    }
  }

  switchMode(mode: 'global' | 'detail'): void {
    this.entryMode.set(mode);
  }

  // ---------------------------------------------------------------- helpers

  playerAt(seat: Seat): string {
    const s = this.seats().find((x) => x.seat === seat);
    return s ? `${s.name} ${s.firstname}` : '';
  }

  seatLabel(seat: Seat): string {
    return { N: 'Nord', S: 'Sud', E: 'Est', O: 'Ouest' }[seat];
  }

  scoreFor(t: TableResult, seat: Seat): number {
    const k = `score_${seat.toLowerCase()}` as keyof TableResult;
    return Number(t[k] ?? 0);
  }

  private num(v: string): number {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }

  rowSum(row: Row): number {
    return this.activeSeats().reduce((acc, s) => acc + this.num(row.scores[s]), 0);
  }

  // Ligne "vide" = aucun score saisi à la main (sièges vides ignorés).
  rowEmpty(row: Row): boolean {
    return this.activeSeats().every((s) => row.scores[s] === '' || row.auto === s);
  }

  colTotal(seat: Seat): number {
    return this.rows().reduce((acc, r) => acc + this.num(r.scores[seat]), 0);
  }

  grandTotal(): number {
    return this.activeSeats().reduce((acc, s) => acc + this.colTotal(s), 0);
  }

  nextTable(): number | null {
    const done = this.validatedTables();
    const after = this.allTables()
      .map((t) => t.table_number)
      .filter((n) => !done.has(n) && n !== this.tableNumber());
    if (after.length === 0) return null;
    const next = after.find((n) => n > this.tableNumber());
    return next ?? after[0];
  }

  // ---------------------------------------------------------------- saisie

  // Un score saisi : si tous les autres sièges actifs sont remplis à la
  // main, le dernier vide (ou celui déjà auto) prend l'opposé de la somme.
  onScore(row: Row, seat: Seat, value: string): void {
    const clean = value.replace(/[^0-9-]/g, '');
    row.scores[seat] = clean;
    if (row.auto === seat) row.auto = null; // l'utilisateur reprend la main
    const active = this.activeSeats();
    const manual = active.filter((s) => s !== row.auto && row.scores[s] !== '');
    const free = active.filter((s) => s === row.auto || row.scores[s] === '');
    if (manual.length === active.length - 1 && free.length === 1) {
      const target = free[0];
      const sum = manual.reduce((acc, s) => acc + this.num(row.scores[s]), 0);
      row.scores[target] = String(-sum);
      row.auto = target;
    } else if (row.auto && manual.length < active.length - 1) {
      row.scores[row.auto] = '';
      row.auto = null;
    }
    this.touch();
  }

  setTaker(row: Row, v: string): void {
    row.taker = (v as Seat) || '';
    this.touch();
  }

  clearRow(row: Row): void {
    for (const s of this.activeSeats()) row.scores[s] = '';
    row.taker = '';
    row.auto = null;
    this.touch();
  }

  addRow(): void {
    const n = this.rows().length + 1;
    const r = this.emptyRow(n);
    for (const s of SEATS) if (!this.playerAt(s)) r.scores[s] = '0';
    this.rows.update((rs) => [...rs, r]);
  }

  // Les Row sont mutées en place ; on force le rafraîchissement des signaux.
  private touch(): void {
    this.rows.update((rs) => [...rs]);
    this.globalRow.update((r) => ({ ...r }));
  }

  canSave(): boolean {
    if (this.entryMode() === 'global') {
      const r = this.globalRow();
      return !this.rowEmpty(r) && this.rowSum(r) === 0;
    }
    const filled = this.rows().filter((r) => !this.rowEmpty(r));
    return filled.length > 0 && filled.every((r) => this.rowSum(r) === 0);
  }

  // ---------------------------------------------------------------- sauvegarde

  private handPayload(row: Row): Partial<Hand> {
    return {
      hand_number: row.hand_number,
      taker_seat: row.taker || null,
      score_n: this.num(row.scores.N),
      score_s: this.num(row.scores.S),
      score_e: this.num(row.scores.E),
      score_o: this.num(row.scores.O),
    };
  }

  // Enregistre la grille (création / mise à jour / suppression des donnes)
  // puis valide la table. Une table déjà validée reste validée : c'est le
  // chemin « corriger une erreur de saisie ».
  save(): void {
    if (!this.canSave() || this.saving()) return;
    const existing = this.table()?.hands ?? [];
    const rid = this.roundId();
    const tn = this.tableNumber();

    const wanted: Row[] =
      this.entryMode() === 'global'
        ? [{ ...this.globalRow(), hand_number: 1 }]
        : this.rows().filter((r) => !this.rowEmpty(r));

    const ops: (() => ReturnType<typeof of>)[] = [];
    const byNumber = new Map(existing.map((h) => [h.hand_number, h]));
    for (const row of wanted) {
      const h = byNumber.get(row.hand_number);
      const payload = this.handPayload(row);
      if (h) {
        ops.push(() => this.api.updateHand(h.id, payload) as unknown as ReturnType<typeof of>);
        byNumber.delete(row.hand_number);
      } else {
        ops.push(() => this.api.addHand(rid, tn, payload) as unknown as ReturnType<typeof of>);
      }
    }
    for (const h of byNumber.values()) {
      ops.push(() => this.api.deleteHand(h.id) as unknown as ReturnType<typeof of>);
    }

    this.saving.set(true);
    from(ops)
      .pipe(
        concatMap((op) => op()),
        toArray(),
        concatMap(() => this.api.validateTable(rid, tn))
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snack.open(`Table ${tn} validée`, 'Fermer', { duration: 2000 });
          this.loadAll();
        },
        error: (err) => {
          this.saving.set(false);
          this.snack.open(err?.error?.error || 'Erreur d’enregistrement', 'Fermer', {
            duration: 4000,
          });
          this.loadAll();
        },
      });
  }
}
