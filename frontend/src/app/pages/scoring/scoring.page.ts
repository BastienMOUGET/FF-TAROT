import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';

import { ApiService } from '../../core/api.service';
import { Hand, Round, RoundSeat, Seat, TableResult } from '../../core/api.types';

@Component({
  selector: 'app-scoring-page',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatButtonToggleModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  template: `
    <a [routerLink]="['/rounds', roundId()]" class="back">
      <mat-icon>arrow_back</mat-icon> Retour à la manche
    </a>
    <h1>
      Saisie — Manche {{ round()?.round_number }}, Table {{ tableNumber() }}
    </h1>

    @if (loading()) {
      <mat-progress-spinner mode="indeterminate" diameter="40" />
    } @else {
      <mat-card class="players">
        <mat-card-header>
          <mat-card-title>Joueurs à la table</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="seat-row">
            @for (seat of seats(); track seat.seat) {
              <div class="seat-card" [attr.data-seat]="seat.seat">
                <div class="seat-letter">{{ seat.seat }}</div>
                <div class="player">
                  {{ seat.name }} {{ seat.firstname }}
                </div>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>

      @if (table(); as t) {
        <mat-card class="totals">
          <mat-card-header>
            <mat-card-title>Totaux</mat-card-title>
            @if (t.validated) {
              <mat-chip color="primary">Validée</mat-chip>
            }
          </mat-card-header>
          <mat-card-content>
            <div class="totals-grid">
              @for (s of ['N','S','E','O']; track s) {
                <div class="total" [attr.data-seat]="s">
                  <div class="total-letter">{{ s }}</div>
                  <div class="total-value">{{ scoreFor(t, s) }}</div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }

      <mat-card class="mode-card">
        <mat-card-content>
          <mat-button-toggle-group
            [value]="entryMode()"
            (change)="entryMode.set($event.value)"
          >
            <mat-button-toggle value="global">
              Résultat global de la table
            </mat-button-toggle>
            <mat-button-toggle value="detail">
              Détail donne par donne
            </mat-button-toggle>
          </mat-button-toggle-group>
        </mat-card-content>
      </mat-card>

      @if (entryMode() === 'global') {
        <mat-card class="global-form">
          <mat-card-header>
            <mat-card-title>Résultat global de la table</mat-card-title>
            <mat-card-subtitle>
              Un seul résultat par joueur pour toute la manche — la somme
              doit être égale à 0.
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="globalForm" (ngSubmit)="submitGlobal()">
              <div class="grid">
                @for (s of ['N','S','E','O']; track s) {
                  <mat-form-field appearance="outline">
                    <mat-label>Score {{ s }}</mat-label>
                    <input
                      matInput
                      type="number"
                      [formControlName]="'score_' + s.toLowerCase()"
                    />
                  </mat-form-field>
                }
              </div>
              <p
                class="sum-check"
                [class.ok]="globalSum() === 0"
                [class.bad]="globalSum() !== 0"
              >
                Somme : {{ globalSum() }}
                @if (globalSum() !== 0) {
                  (doit être égale à 0)
                }
              </p>
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="globalForm.invalid || globalSum() !== 0 || saving()"
              >
                <mat-icon>check</mat-icon> Valider le résultat de la table
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      }

      @if (entryMode() === 'detail') {
        <mat-card class="hand-form">
          <mat-card-header>
            <mat-card-title>Nouvelle donne</mat-card-title>
            <mat-card-subtitle>
              Donne n° {{ nextHandNumber() }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="form" (ngSubmit)="addHand()">
              <div class="row">
                <label class="row-label">Preneur</label>
                <mat-radio-group
                  formControlName="taker_seat"
                  class="radios"
                  (change)="applyAutoCalc()"
                >
                  @for (s of ['N','S','E','O']; track s) {
                    <mat-radio-button [value]="s">{{ s }}</mat-radio-button>
                  }
                </mat-radio-group>
              </div>
              <div class="row">
                <label class="row-label">Résultat</label>
                <mat-form-field appearance="outline" class="donne-result">
                  <mat-label>Perdu/gagné par le preneur (ex: -50)</mat-label>
                  <input
                    matInput
                    type="number"
                    [formControlName]="'donne_result'"
                    (input)="applyAutoCalc()"
                  />
                </mat-form-field>
              </div>
              <div class="grid">
                @for (s of ['N','S','E','O']; track s) {
                  <mat-form-field appearance="outline">
                    <mat-label>Score {{ s }}</mat-label>
                    <input
                      matInput
                      type="number"
                      [formControlName]="'score_' + s.toLowerCase()"
                    />
                  </mat-form-field>
                }
              </div>
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="form.invalid || saving()"
              >
                <mat-icon>add</mat-icon> Ajouter la donne
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      }

      @if (table()?.hands?.length) {
        <mat-card class="hands-list">
          <mat-card-header>
            <mat-card-title>Donnes saisies</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="table()?.hands || []">
              <ng-container matColumnDef="num">
                <th mat-header-cell *matHeaderCellDef>#</th>
                <td mat-cell *matCellDef="let h">{{ h.hand_number }}</td>
              </ng-container>
              <ng-container matColumnDef="taker">
                <th mat-header-cell *matHeaderCellDef>Preneur</th>
                <td mat-cell *matCellDef="let h">{{ h.taker_seat || '—' }}</td>
              </ng-container>
              @for (s of ['N','S','E','O']; track s) {
                <ng-container [matColumnDef]="'s' + s.toLowerCase()">
                  <th mat-header-cell *matHeaderCellDef class="num">{{ s }}</th>
                  <td mat-cell *matCellDef="let h" class="num">
                    {{ h['score_' + s.toLowerCase()] }}
                  </td>
                </ng-container>
              }
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let h">
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="deleteHand(h.id)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="handCols"></tr>
              <tr mat-row *matRowDef="let row; columns: handCols"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }

      <div class="bottom-actions">
        @if (table() && !table()!.validated) {
          <button mat-flat-button color="primary" (click)="validateTable()">
            <mat-icon>check</mat-icon> Valider la table
          </button>
        } @else if (table()) {
          <button mat-stroked-button (click)="unvalidateTable()">
            <mat-icon>undo</mat-icon> Dévalider
          </button>
        }
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex; align-items: center; gap: 4px;
      margin-bottom: 16px; text-decoration: none; color: #1976d2;
    }
    h1 { margin-bottom: 24px; }
    .players, .totals, .hand-form, .hands-list { margin-bottom: 16px; }
    .seat-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .seat-card {
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      color: white;
    }
    .seat-card[data-seat="N"] { background: #ffb74d; color: #4e342e; }
    .seat-card[data-seat="S"] { background: #4fc3f7; color: #01579b; }
    .seat-card[data-seat="E"] { background: #ff8a65; color: #4e342e; }
    .seat-card[data-seat="O"] { background: #aed581; color: #33691e; }
    .seat-letter { font-size: 1.4em; font-weight: 700; }
    .player { font-size: 0.95em; }
    .totals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .total {
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      background: #f5f5f5;
    }
    .total-letter { font-size: 1em; font-weight: 600; color: #757575; }
    .total-value { font-size: 1.6em; font-weight: 700; }
    .row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .row-label { width: 80px; font-weight: 500; }
    .radios { display: flex; gap: 16px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    table { width: 100%; }
    .num { text-align: right; }
    .bottom-actions { margin-top: 24px; display: flex; justify-content: flex-end; }
    mat-card-header { justify-content: space-between; }
    .mode-card, .global-form { margin-bottom: 16px; }
    .sum-check { font-weight: 600; margin: 0 0 16px; }
    .sum-check.ok { color: #2e7d32; }
    .sum-check.bad { color: #c62828; }
    .donne-result { width: 260px; }
  `,
})
export class ScoringPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  saving = signal(false);
  roundId = signal(0);
  tableNumber = signal(0);
  round = signal<Round | null>(null);
  seats = signal<RoundSeat[]>([]);
  table = signal<TableResult | null>(null);

  handCols = ['num', 'taker', 'sn', 'ss', 'se', 'so', 'actions'];

  entryMode = signal<'global' | 'detail'>('global');

  form = this.fb.nonNullable.group({
    taker_seat: ['' as Seat | '', Validators.required],
    donne_result: [null as number | null],
    score_n: [0, Validators.required],
    score_s: [0, Validators.required],
    score_e: [0, Validators.required],
    score_o: [0, Validators.required],
  });

  globalForm = this.fb.nonNullable.group({
    score_n: [0, Validators.required],
    score_s: [0, Validators.required],
    score_e: [0, Validators.required],
    score_o: [0, Validators.required],
  });

  ngOnInit(): void {
    const r = Number(this.route.snapshot.paramMap.get('id'));
    const t = Number(this.route.snapshot.paramMap.get('tableNumber'));
    this.roundId.set(r);
    this.tableNumber.set(t);
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.api.round(this.roundId()).subscribe({
      next: (round) => {
        this.round.set(round);
        const tableSeats = (round.tables || []).find(
          (x) => x.table_number === this.tableNumber()
        );
        this.seats.set(tableSeats?.seats || []);
        this.api
          .tableResult(this.roundId(), this.tableNumber())
          .subscribe({
            next: (tr) => {
              this.table.set(tr);
              this.entryMode.set((tr.hands?.length || 0) > 1 ? 'detail' : 'global');
              this.globalForm.patchValue({
                score_n: tr.score_n,
                score_s: tr.score_s,
                score_e: tr.score_e,
                score_o: tr.score_o,
              });
              this.loading.set(false);
            },
            error: () => {
              // Pas de table_result encore : c'est normal
              this.table.set(null);
              this.entryMode.set('global');
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

  nextHandNumber(): number {
    const hands = this.table()?.hands || [];
    return hands.length === 0
      ? 1
      : Math.max(...hands.map((h) => h.hand_number)) + 1;
  }

  scoreFor(t: TableResult, seat: string): number {
    const k = `score_${seat.toLowerCase()}` as keyof TableResult;
    return Number(t[k] ?? 0);
  }

  addHand(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .addHand(this.roundId(), this.tableNumber(), {
        hand_number: this.nextHandNumber(),
        taker_seat: v.taker_seat as Seat,
        score_n: Number(v.score_n),
        score_s: Number(v.score_s),
        score_e: Number(v.score_e),
        score_o: Number(v.score_o),
      })
      .subscribe({
        next: () => {
          this.form.reset({
            taker_seat: '',
            donne_result: null,
            score_n: 0,
            score_s: 0,
            score_e: 0,
            score_o: 0,
          });
          this.loadAll();
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

  // Auto-calcul (facultatif) du partage de la donne : preneur seul contre
  // les 3 autres, résultat = perte/gain du preneur par adversaire.
  // preneur = 3×résultat, chaque adversaire = -résultat (somme = 0).
  applyAutoCalc(): void {
    const v = this.form.getRawValue();
    const taker = v.taker_seat;
    const result = v.donne_result;
    if (!taker || result === null || result === undefined) return;
    const seats: Seat[] = ['N', 'S', 'E', 'O'];
    const patch: Record<string, number> = {};
    for (const s of seats) {
      const key = `score_${s.toLowerCase()}`;
      patch[key] = s === taker ? result * 3 : -result;
    }
    this.form.patchValue(patch);
  }

  globalSum(): number {
    const v = this.globalForm.getRawValue();
    return (
      Number(v.score_n) + Number(v.score_s) + Number(v.score_e) + Number(v.score_o)
    );
  }

  submitGlobal(): void {
    if (this.globalForm.invalid || this.globalSum() !== 0) return;
    const v = this.globalForm.getRawValue();
    const scores = {
      score_n: Number(v.score_n),
      score_s: Number(v.score_s),
      score_e: Number(v.score_e),
      score_o: Number(v.score_o),
    };
    const hands = this.table()?.hands || [];
    if (hands.length > 1) {
      if (
        !confirm(
          `${hands.length} donnes détaillées sont déjà saisies pour cette table. ` +
            'Les remplacer par ce résultat global unique ?'
        )
      ) {
        return;
      }
    }
    this.saving.set(true);
    if (hands.length === 0) {
      this.api
        .addHand(this.roundId(), this.tableNumber(), {
          hand_number: 1,
          taker_seat: null,
          ...scores,
        })
        .subscribe(() => this.afterGlobalSave());
    } else if (hands.length === 1) {
      this.api
        .updateHand(hands[0].id, scores)
        .subscribe(() => this.afterGlobalSave());
    } else {
      from(hands)
        .pipe(
          concatMap((h) => this.api.deleteHand(h.id)),
          toArray(),
          concatMap(() =>
            this.api.addHand(this.roundId(), this.tableNumber(), {
              hand_number: 1,
              taker_seat: null,
              ...scores,
            })
          )
        )
        .subscribe(() => this.afterGlobalSave());
    }
  }

  private afterGlobalSave(): void {
    this.saving.set(false);
    this.snack.open('Résultat de la table enregistré', 'Fermer', {
      duration: 2000,
    });
    this.loadAll();
  }

  deleteHand(id: number): void {
    if (!confirm('Supprimer cette donne ?')) return;
    this.api.deleteHand(id).subscribe(() => this.loadAll());
  }

  validateTable(): void {
    this.api
      .validateTable(this.roundId(), this.tableNumber())
      .subscribe(() => {
        this.snack.open('Table validée', 'Fermer', { duration: 2000 });
        this.loadAll();
      });
  }

  unvalidateTable(): void {
    this.api
      .unvalidateTable(this.roundId(), this.tableNumber())
      .subscribe(() => this.loadAll());
  }
}
