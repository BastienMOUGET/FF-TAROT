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
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { ClubLogo } from '../../shared/club-logo';
import { RankingImportDialog } from './ranking-import-dialog';

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
    ClubLogo,
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
        <div class="section-actions">
          <button mat-stroked-button (click)="importSub()">
            <mat-icon>upload</mat-icon> Importer un tournoi (CSV)
          </button>
          <button mat-flat-button color="primary" (click)="addSub()">
            <mat-icon>add</mat-icon> Ajouter un tournoi
          </button>
        </div>
      </div>

      @if (subs().length === 0) {
        <p class="empty">
          Aucun tournoi pour l'instant. Clique sur « Ajouter un tournoi » pour
          créer la soirée du jour.
        </p>
      } @else {
        <div class="subs">
          @for (sub of subs(); track sub.id) {
            <mat-card class="sub-card">
              <mat-card-content>
                <a class="sub-link" [routerLink]="subLink(sub)">
                  <div class="sub-title">
                    <mat-icon>{{ sub.imported ? 'upload_file' : 'event' }}</mat-icon>
                    <span>{{ sub.label }}</span>
                    @if (sub.imported) {
                      <mat-chip class="ml">importé</mat-chip>
                    }
                    @if (+sub.indice_pcn > 0) {
                      <mat-chip class="ml">PCN {{ sub.indice_pcn }}</mat-chip>
                    }
                  </div>
                  <div class="sub-open">{{ sub.imported ? 'Classement' : 'Ouvrir' }} <mat-icon>chevron_right</mat-icon></div>
                </a>
                <button mat-icon-button color="warn" class="sub-delete" (click)="removeSub(sub)" title="Retirer ce tournoi du challenge">
                  <mat-icon>delete</mat-icon>
                </button>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }

      <!-- 2. Le classement trimestriel, en bas : on le consulte, on ne le
           manipule pas pendant la soirée. -->
      <mat-card class="challenge-card">
        <mat-card-header>
          <app-club-logo [clubId]="t.club_id" [size]="48" class="head-logo" />
          <mat-card-title>Classement du Challenge {{ t.name }}</mat-card-title>
          <mat-card-subtitle>
            @if (t.club_name) { {{ t.club_name }} · }
            Cumul sur {{ challengeRanking()?.sub_tournaments_count ?? 0 }}
            tournoi(s) · PC = points Challenge
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="challenge-bar no-print">
            <mat-button-toggle-group
              [value]="t.challenge_mode"
              (change)="setChallengeMode(t.id, $event.value)"
            >
              <mat-button-toggle value="place">Par place</mat-button-toggle>
              <mat-button-toggle value="raw">Par points</mat-button-toggle>
            </mat-button-toggle-group>
            <mat-button-toggle-group [value]="detailMode()" (change)="detailMode.set($event.value)">
              <mat-button-toggle value="pc">PC par tournoi</mat-button-toggle>
              <mat-button-toggle value="full">Points / Pcn / PC</mat-button-toggle>
            </mat-button-toggle-group>
            <span class="spacer"></span>
            <button mat-stroked-button (click)="print()">
              <mat-icon>print</mat-icon> Imprimer le classement
            </button>
          </div>

          @if (challengeLoading()) {
            <mat-progress-spinner mode="indeterminate" diameter="30" />
          } @else if (
            !challengeRanking() || challengeRanking()!.ranking.length === 0
          ) {
            <p class="empty">
              Pas encore de classement (aucun résultat de tournoi validé).
            </p>
          } @else {
            <!-- Format du classeur Excel du club (feuille « Général ») : une
                 colonne par tournoi, puis les totaux et le nombre de
                 participations. -->
            <div class="table-wrap">
            <table class="challenge-table" [class.full]="detailMode() === 'full'">
              <thead>
                <tr>
                  <th rowspan="2" class="num">Place</th>
                  <th rowspan="2">Licence</th>
                  <th rowspan="2">Joueur</th>
                  @for (st of challengeRanking()!.sub_tournaments; track st.id) {
                    <th class="tour" [attr.colspan]="detailMode() === 'full' ? 3 : 1" [title]="st.players + ' joueurs'">
                      {{ st.label }}
                    </th>
                  }
                  <th rowspan="2" class="num total">Points</th>
                  <th rowspan="2" class="num total">Pcn</th>
                  <th rowspan="2" class="num total pc">PC</th>
                  <th rowspan="2" class="num total">Particip.</th>
                </tr>
                <tr>
                  @for (st of challengeRanking()!.sub_tournaments; track st.id) {
                    @if (detailMode() === 'full') {
                      <th class="num sub">Pts</th><th class="num sub">Pcn</th><th class="num sub">PC</th>
                    } @else {
                      <th class="num sub">PC</th>
                    }
                  }
                </tr>
              </thead>
              <tbody>
                @for (e of challengeRanking()!.ranking; track e.player_id) {
                  <tr [class.first]="e.place === 1">
                    <td class="num">{{ e.place }}</td>
                    <td class="lic">{{ e.licence || '' }}</td>
                    <td class="name">{{ e.name }} {{ e.firstname }}</td>
                    @for (d of e.details; track $index) {
                      @if (detailMode() === 'full') {
                        <td class="num">{{ d ? d.points : '' }}</td>
                        <td class="num">{{ d ? d.pcn : '' }}</td>
                        <td class="num pc">{{ d ? d.pc : '' }}</td>
                      } @else {
                        <td class="num pc">{{ d ? d.pc : '' }}</td>
                      }
                    }
                    <td class="num total">{{ e.total_points }}</td>
                    <td class="num total">{{ e.total_pcn }}</td>
                    <td class="num total pc strong">{{ e.points }}</td>
                    <td class="num total">{{ e.sub_tournaments_played }}</td>
                  </tr>
                }
              </tbody>
            </table>
            </div>
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
    .section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .sub-card { transition: box-shadow 0.15s; }
    .sub-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
    .sub-card mat-card-content { display: flex; align-items: center; gap: 8px; padding-top: 16px; }
    .sub-link {
      flex: 1 1 auto; display: flex; align-items: center; justify-content: space-between;
      text-decoration: none; color: inherit; cursor: pointer;
    }
    .sub-delete { flex: 0 0 auto; }
    .challenge-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .spacer { flex: 1 1 auto; }
    @media print {
      @page { size: landscape; margin: 10mm; }
      .back, .head, .section-head, .subs { display: none !important; }
      .challenge-card { box-shadow: none !important; }
      .table-wrap { overflow: visible; }
      .challenge-table { font-size: 9pt; }
      .challenge-table th, .challenge-table td { padding: 2px 5px; }
      .challenge-table tr.first td { background: #ffe082 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    .sub-title { display: flex; align-items: center; gap: 8px; font-size: 1.15em; font-weight: 500; }
    .sub-open { display: flex; align-items: center; color: #1976d2; font-size: 0.9em; }
    .challenge-card mat-card-content { display: flex; flex-direction: column; gap: 12px; }
    .head-logo { margin-right: 12px; }
    .table-wrap { overflow-x: auto; }
    .challenge-table { border-collapse: collapse; white-space: nowrap; font-size: 0.92em; }
    .challenge-table th, .challenge-table td {
      text-align: left; padding: 4px 8px; border-bottom: 1px solid #eee;
    }
    .challenge-table th { background: #f5f5f5; vertical-align: bottom; }
    .challenge-table th.tour { text-align: center; border-left: 1px solid #ddd; font-weight: 500; }
    .challenge-table th.sub { font-size: 0.8em; color: #757575; font-weight: 500; }
    .challenge-table .num { text-align: right; }
    .challenge-table .lic { color: #757575; font-size: 0.85em; }
    .challenge-table .name { white-space: nowrap; }
    .challenge-table .pc { font-weight: 600; }
    .challenge-table .total { border-left: 2px solid #bdbdbd; background: #fafafa; }
    .challenge-table .strong { font-weight: 700; }
    .challenge-table tr.first td { background: rgba(255, 215, 0, 0.25); font-weight: 600; }
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
  detailMode = signal<'pc' | 'full'>('pc');

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

  subLink(sub: SubTournament): (string | number)[] {
    return sub.imported
      ? ['/sub-tournaments', sub.id, 'ranking']
      : ['/sub-tournaments', sub.id];
  }

  print(): void {
    window.print();
  }

  private reloadSubs(tid: number): void {
    this.api.subTournaments(tid).subscribe((subs) => {
      this.subs.set([...subs].sort((a, b) => b.id - a.id));
    });
    this.loadChallengeRanking(tid);
  }

  importSub(): void {
    const t = this.tournament();
    if (!t) return;
    const ref = this.dialog.open(RankingImportDialog, {
      width: '760px',
      data: { tournamentId: t.id },
    });
    ref.afterClosed().subscribe((done) => {
      if (done) this.reloadSubs(t.id);
    });
  }

  removeSub(sub: SubTournament): void {
    const t = this.tournament();
    if (!t) return;
    const data: ConfirmDialogData = {
      title: `Retirer le tournoi ${sub.label} ?`,
      message: sub.imported
        ? 'Le classement importé est supprimé et sort du classement du Challenge.'
        : 'Ses inscriptions, manches et scores sont supprimés définitivement, et il sort du classement du Challenge.',
      confirmLabel: 'Retirer',
      danger: true,
    };
    const ref = this.dialog.open(ConfirmDialog, { data });
    ref.afterClosed().subscribe((ok) => {
      if (!ok) return;
      this.api.deleteSubTournament(sub.id).subscribe({
        next: () => {
          this.snack.open('Tournoi retiré du challenge', 'Fermer', { duration: 2000 });
          this.reloadSubs(t.id);
        },
        error: (err) =>
          this.snack.open(err?.error?.error || 'Suppression impossible', 'Fermer', {
            duration: 3000,
          }),
      });
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
