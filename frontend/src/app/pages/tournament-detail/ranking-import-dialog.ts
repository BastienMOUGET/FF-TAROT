import { Component, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { RankingImportResult, RankingImportRow } from '../../core/api.types';
import { parseCsv, splitFullName } from '../admin/dialogs/players-import-dialog';

// Import d'un tournoi joué hors PABB90 (classeur Excel « Classement JJMMAAAA »)
// dans le Challenge. Format observé (fichier du club, séparateur « ; ») :
// quelques lignes d'en-tête, puis une ligne de titres
//   Place;N° Licence;Nom Prénom;Départ;Points;Pcn
// puis une ligne par joueur. Licence « 0 » = pas de licence. Le nom traîne
// parfois des codes (« FREYBURGER Jonathan   0  NR ») qu'on nettoie.

// Repère la ligne de titres : celle qui contient « place » et « points ».
function findHeader(rows: string[][]): number {
  return rows.findIndex((r) => {
    const n = r.map((c) => c.toLowerCase());
    return n.some((c) => c.includes('place')) && n.some((c) => c.includes('point'));
  });
}

// « MOUGIN Marie 0 » → « MOUGIN Marie » ; « GUILLET Eric   0  2C » →
// « GUILLET Eric ». On retire les mots finaux qui sont des chiffres ou des
// codes courts en majuscules/chiffres.
function cleanName(raw: string): string {
  const words = raw.trim().replace(/\s+/g, ' ').split(' ');
  while (words.length > 1) {
    const last = words[words.length - 1];
    if (/^\d+$/.test(last) || /^[A-Z0-9]{1,3}$/.test(last)) words.pop();
    else break;
  }
  return words.join(' ');
}

// « Classement 02092026.xls » → « 02/09/2026 ».
function labelFromFilename(filename: string): string {
  const m = filename.match(/(\d{2})(\d{2})(\d{4})/);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;
  return filename.replace(/\.[^.]+$/, '');
}

@Component({
  selector: 'app-ranking-import-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title>Importer un tournoi (classement CSV)</h2>
    <mat-dialog-content>
      <p class="hint">
        Pour un tournoi géré sur un classeur Excel : enregistrer la feuille
        « Classement » au format CSV, puis la choisir ici. Le classement
        entre dans le Challenge tel quel ; les joueurs inconnus sont créés.
      </p>

      <input type="file" accept=".csv,.txt" (change)="onFileSelected($event)" />

      @if (rows().length > 0) {
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nom du tournoi (date de la soirée)</mat-label>
          <input matInput [(ngModel)]="label" />
        </mat-form-field>

        <div class="summary">
          <mat-chip color="primary">{{ rows().length }} joueur(s) classé(s)</mat-chip>
          @if (skipped() > 0) {
            <mat-chip>{{ skipped() }} ligne(s) ignorée(s) (sans nom)</mat-chip>
          }
        </div>

        <div class="preview">
          <table>
            <thead>
              <tr><th>Place</th><th>Licence</th><th>Nom</th><th>Prénom</th><th>Points</th><th>PCN</th></tr>
            </thead>
            <tbody>
              @for (r of rows().slice(0, 40); track $index) {
                <tr>
                  <td>{{ r.place }}</td>
                  <td>{{ r.licence || '—' }}</td>
                  <td>{{ r.name }}</td>
                  <td>{{ r.firstname || '—' }}</td>
                  <td class="num">{{ r.points }}</td>
                  <td class="num">{{ r.pcn }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (rows().length > 40) {
            <p class="more">… et {{ rows().length - 40 }} ligne(s) de plus</p>
          }
        </div>
      } @else if (fileRead()) {
        <p class="warn">
          Aucune ligne de classement trouvée : la ligne de titres doit
          contenir « Place » et « Points ».
        </p>
      }

      @if (result(); as r) {
        <p class="result">
          Tournoi <strong>{{ r.label }}</strong> importé :
          <strong>{{ r.imported }}</strong> joueur(s) classé(s),
          <strong>{{ r.created_players }}</strong> joueur(s) créé(s).
        </p>
      }
      @if (error()) {
        <p class="warn">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(!!result())">
        {{ result() ? 'Fermer' : 'Annuler' }}
      </button>
      @if (!result()) {
        <button
          mat-flat-button
          color="primary"
          [disabled]="rows().length === 0 || !label.trim() || importing()"
          (click)="doImport()"
        >
          @if (importing()) {
            <mat-progress-spinner mode="indeterminate" diameter="18" />
          } @else {
            <mat-icon>upload</mat-icon>
          }
          Importer
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .hint { color: #757575; font-size: 0.9em; margin-bottom: 12px; }
    .full { width: 100%; margin-top: 12px; }
    .summary { display: flex; gap: 8px; margin: 8px 0 12px; flex-wrap: wrap; }
    .preview { max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px 10px; font-size: 0.9em; }
    td.num { text-align: right; }
    thead th { position: sticky; top: 0; background: #fafafa; border-bottom: 1px solid #ddd; }
    .more { color: #757575; font-size: 0.85em; padding: 6px 10px; margin: 0; }
    .result { margin-top: 12px; }
    .warn { color: #c62828; margin-top: 12px; }
  `,
})
export class RankingImportDialog {
  ref = inject<MatDialogRef<RankingImportDialog>>(MatDialogRef);
  data = inject<{ tournamentId: number }>(MAT_DIALOG_DATA);
  private api = inject(ApiService);

  rows = signal<RankingImportRow[]>([]);
  skipped = signal(0);
  fileRead = signal(false);
  importing = signal(false);
  result = signal<RankingImportResult | null>(null);
  error = signal<string | null>(null);
  label = '';

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.label) this.label = labelFromFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => this.parseText(String(reader.result || ''));
    reader.readAsText(file, 'utf-8');
  }

  private parseText(text: string): void {
    this.fileRead.set(true);
    const all = parseCsv(text.replace(/^﻿/, ''));
    const h = findHeader(all);
    if (h === -1) {
      this.rows.set([]);
      return;
    }
    const header = all[h].map((c) => c.toLowerCase().trim());
    const col = (pred: (c: string) => boolean, fallback: number) => {
      const i = header.findIndex(pred);
      return i === -1 ? fallback : i;
    };
    const placeCol = col((c) => c.includes('place'), 0);
    const licCol = col((c) => c.includes('lic'), 1);
    const nameCol = col((c) => c.includes('nom'), 2);
    const pointsCol = col((c) => c.includes('point'), 4);
    const pcnCol = col((c) => c.includes('pcn'), 5);

    const out: RankingImportRow[] = [];
    let skipped = 0;
    for (const r of all.slice(h + 1)) {
      const place = parseInt((r[placeCol] ?? '').trim(), 10);
      const name = cleanName(r[nameCol] ?? '');
      if (!Number.isFinite(place) || !name || /^\d*$/.test(name)) {
        if (r.some((c) => c.trim())) skipped++;
        continue;
      }
      const licRaw = (r[licCol] ?? '').trim();
      const licence = licRaw && licRaw !== '0' ? licRaw : null;
      const split = splitFullName(name);
      const points = parseFloat((r[pointsCol] ?? '0').replace(',', '.')) || 0;
      const pcn = parseFloat((r[pcnCol] ?? '0').replace(',', '.')) || 0;
      out.push({ place, licence, name: split.name, firstname: split.firstname, points, pcn });
    }
    this.rows.set(out);
    this.skipped.set(skipped);
  }

  doImport(): void {
    if (this.rows().length === 0 || !this.label.trim()) return;
    this.importing.set(true);
    this.error.set(null);
    this.api.importRanking(this.data.tournamentId, this.label.trim(), this.rows()).subscribe({
      next: (r) => {
        this.importing.set(false);
        this.result.set(r);
      },
      error: (err) => {
        this.importing.set(false);
        this.error.set(err?.error?.error || 'Erreur pendant l’import');
      },
    });
  }
}
