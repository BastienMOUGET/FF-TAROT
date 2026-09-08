import { Component, inject, signal } from '@angular/core';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

import { ApiService } from '../../../core/api.service';
import { PlayerImportResult } from '../../../core/api.types';

interface ParsedRow {
  licence: string | null;
  name: string;
  firstname: string;
  status: 'ok' | 'no_firstname' | 'skip_available';
}

// Découpe une ligne CSV en tenant compte des champs entre guillemets
// (délimiteur détecté automatiquement : ';' si majoritaire sur la
// ligne d'en-tête, ',' sinon — format observé côté club : virgules +
// champs entre guillemets, à la LibreOffice/Excel).
export function parseCsv(text: string): string[][] {
  const headerLine = text.split(/\r\n|\n/, 1)[0] || '';
  const delimiter =
    (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length
      ? ';'
      : ',';
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === '\r') {
      // ignoré
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

// "NOM Prénom" combiné (format du fichier club) → { name, firstname }.
// Découpe sur le DERNIER espace : "MAZIMANN FRANCK" → NOM=MAZIMANN,
// prénom=FRANCK. Un mot seul (ex: "MARECHAL") → prénom vide, à
// compléter manuellement après import.
export function splitFullName(full: string): { name: string; firstname: string } {
  const trimmed = full.trim().replace(/\s+/g, ' ');
  const idx = trimmed.lastIndexOf(' ');
  if (idx === -1) return { name: trimmed, firstname: '' };
  return { name: trimmed.slice(0, idx), firstname: trimmed.slice(idx + 1) };
}

function detectColumns(header: string[]): {
  licenceCol: number;
  nameCol: number;
  firstnameCol: number | null;
} {
  const norm = header.map((h) => h.toLowerCase().trim());
  const licenceCol = norm.findIndex((h) => h.includes('lic'));
  // Colonnes séparées nom/prénom : n'existent que si on trouve à la fois
  // une colonne "prénom" ET une colonne "nom" DISTINCTE qui ne contient
  // pas elle-même "prénom" (sinon un en-tête combiné du type "nom
  // prenom" matche les deux règles et finit par lire le même texte
  // deux fois — vu en pratique sur l'export club réel).
  const prenomCol = norm.findIndex(
    (h) => h.includes('prenom') || h.includes('prénom')
  );
  const nomOnlyCol = norm.findIndex(
    (h, i) =>
      i !== prenomCol &&
      h.includes('nom') &&
      !h.includes('prenom') &&
      !h.includes('prénom')
  );
  var nameCol: number;
  var firstnameCol: number | null;
  if (prenomCol !== -1 && nomOnlyCol !== -1) {
    nameCol = nomOnlyCol;
    firstnameCol = prenomCol;
  } else {
    const combinedCol = norm.findIndex((h) => h.includes('nom'));
    nameCol = combinedCol !== -1 ? combinedCol : 1;
    firstnameCol = null;
  }
  return {
    licenceCol: licenceCol !== -1 ? licenceCol : 0,
    nameCol,
    firstnameCol,
  };
}

@Component({
  selector: 'app-players-import-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  template: `
    <h2 mat-dialog-title>Importer une liste de joueurs</h2>
    <mat-dialog-content>
      <p class="hint">
        Fichier CSV avec une colonne licence et soit une colonne "nom
        prénom" combinée, soit deux colonnes séparées nom/prénom. Les
        lignes "Disponible" (licence non attribuée) sont ignorées
        automatiquement. Export Excel/LibreOffice : Fichier → Enregistrer
        sous → CSV.
      </p>

      <input
        type="file"
        accept=".csv,.txt"
        (change)="onFileSelected($event)"
      />

      @if (parsed().length > 0) {
        <div class="summary">
          <mat-chip color="primary">{{ okCount() }} importable(s)</mat-chip>
          @if (skippedCount() > 0) {
            <mat-chip>{{ skippedCount() }} ignorée(s) (Disponible)</mat-chip>
          }
          @if (noFirstnameCount() > 0) {
            <mat-chip color="warn"
              >{{ noFirstnameCount() }} sans prénom détecté (importé quand
              même, à compléter)</mat-chip
            >
          }
        </div>

        <div class="preview">
          <table>
            <thead>
              <tr>
                <th>Licence</th>
                <th>Nom</th>
                <th>Prénom</th>
              </tr>
            </thead>
            <tbody>
              @for (r of previewRows(); track $index) {
                <tr [class.skip]="r.status === 'skip_available'">
                  <td>{{ r.licence || '—' }}</td>
                  <td>{{ r.name }}</td>
                  <td>{{ r.firstname || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (parsed().length > previewRows().length) {
            <p class="more">
              … et {{ parsed().length - previewRows().length }} ligne(s) de
              plus
            </p>
          }
        </div>
      }

      @if (result(); as r) {
        <div class="result">
          <p>
            <strong>{{ r.created }}</strong> créé(s),
            <strong>{{ r.updated }}</strong> mis à jour,
            <strong>{{ r.unchanged }}</strong> inchangé(s).
          </p>
          @if (r.potential_duplicates.length > 0) {
            <p class="warn">
              {{ r.potential_duplicates.length }} doublon(s) potentiel(s) —
              même nom/prénom déjà en base avec une licence différente, à
              vérifier manuellement :
            </p>
            <ul>
              @for (d of r.potential_duplicates; track $index) {
                <li>
                  {{ d.name }} {{ d.firstname }}
                  @if (d.new_licence) {
                    (nouvelle licence {{ d.new_licence }})
                  }
                </li>
              }
            </ul>
          }
        </div>
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
          [disabled]="okCount() === 0 || importing()"
          (click)="doImport()"
        >
          @if (importing()) {
            <mat-progress-spinner mode="indeterminate" diameter="18" />
          } @else {
            <mat-icon>upload</mat-icon>
          }
          Importer {{ okCount() }} joueur(s)
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .hint { color: #757575; font-size: 0.9em; margin-bottom: 12px; }
    .summary { display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap; }
    .preview { max-height: 300px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px 10px; font-size: 0.9em; }
    thead th { position: sticky; top: 0; background: #fafafa; border-bottom: 1px solid #ddd; }
    tr.skip { color: #bbb; text-decoration: line-through; }
    .more { color: #757575; font-size: 0.85em; padding: 6px 10px; margin: 0; }
    .result { margin-top: 16px; }
    .result .warn { color: #c62828; }
    .result ul { margin: 4px 0; padding-left: 20px; }
  `,
})
export class PlayersImportDialog {
  ref = inject<MatDialogRef<PlayersImportDialog>>(MatDialogRef);
  private api = inject(ApiService);

  parsed = signal<ParsedRow[]>([]);
  importing = signal(false);
  result = signal<PlayerImportResult | null>(null);

  previewRows() {
    return this.parsed().slice(0, 30);
  }
  okCount() {
    return this.parsed().filter((r) => r.status !== 'skip_available').length;
  }
  skippedCount() {
    return this.parsed().filter((r) => r.status === 'skip_available').length;
  }
  noFirstnameCount() {
    return this.parsed().filter((r) => r.status === 'no_firstname').length;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.parseText(String(reader.result || ''));
    };
    reader.readAsText(file, 'utf-8');
  }

  private parseText(text: string): void {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      this.parsed.set([]);
      return;
    }
    const header = rows[0];
    const { licenceCol, nameCol, firstnameCol } = detectColumns(header);
    const out: ParsedRow[] = [];
    for (const r of rows.slice(1)) {
      const licenceRaw = (r[licenceCol] ?? '').trim();
      const licence = licenceRaw.length > 0 ? licenceRaw : null;

      var name: string;
      var firstname: string;
      if (firstnameCol !== null) {
        name = (r[nameCol] ?? '').trim();
        firstname = (r[firstnameCol] ?? '').trim();
      } else {
        const full = (r[nameCol] ?? '').trim();
        const split = splitFullName(full);
        name = split.name;
        firstname = split.firstname;
      }
      if (!name) continue;

      if (name.toLowerCase() === 'disponible') {
        out.push({ licence, name, firstname, status: 'skip_available' });
        continue;
      }
      out.push({
        licence,
        name,
        firstname,
        status: firstname ? 'ok' : 'no_firstname',
      });
    }
    this.parsed.set(out);
  }

  doImport(): void {
    const toImport = this.parsed()
      .filter((r) => r.status !== 'skip_available')
      .map((r) => ({
        licence: r.licence,
        name: r.name,
        firstname: r.firstname,
      }));
    if (toImport.length === 0) return;
    this.importing.set(true);
    this.api.importPlayers(toImport).subscribe({
      next: (r) => {
        this.importing.set(false);
        this.result.set(r);
      },
      error: () => {
        this.importing.set(false);
      },
    });
  }
}
