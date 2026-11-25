import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../core/api.service';
import { Club, Comite } from '../../../core/api.types';

@Component({
  selector: 'app-club-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.club ? 'Modifier' : 'Nouveau' }} club</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" maxlength="15" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" maxlength="150" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Comité</mat-label>
          <mat-select formControlName="comite_id">
            <mat-option [value]="null">— aucun —</mat-option>
            @for (c of comites(); track c.id) {
              <mat-option [value]="c.id">
                {{ c.name }} ({{ c.code }})
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (data?.club) {
          <div class="logo-block">
            <div class="logo-label">Logo du club (miniature sur les classements imprimés)</div>
            <div class="logo-row">
              @if (logo(); as l) {
                <img [src]="l" alt="logo" class="logo-preview" />
              } @else {
                <span class="logo-none">aucun logo</span>
              }
              <label mat-stroked-button class="logo-btn">
                <mat-icon>image</mat-icon> Choisir une image
                <input type="file" accept="image/*" hidden (change)="onLogoFile($event)" />
              </label>
              @if (logo()) {
                <button mat-button type="button" color="warn" (click)="removeLogo()">Retirer</button>
              }
            </div>
            <div class="logo-help">JPG ou PNG, réduit automatiquement à 240 px.</div>
          </div>
        }
        @if (errorMsg()) {
          <p class="err"><mat-icon>error_outline</mat-icon>{{ errorMsg() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Annuler</button>
      <button
        mat-flat-button color="primary"
        [disabled]="form.invalid || saving()"
        (click)="submit()"
      >
        {{ data?.club ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; min-width: 400px; }
    mat-form-field { width: 100%; }
    .err { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
    .logo-block { margin: 4px 0 12px; }
    .logo-label { font-size: 0.85em; color: #616161; margin-bottom: 6px; }
    .logo-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .logo-preview { max-height: 64px; max-width: 160px; object-fit: contain; border: 1px solid #eee; border-radius: 4px; }
    .logo-none { color: #9e9e9e; font-style: italic; }
    .logo-btn { cursor: pointer; }
    .logo-help { font-size: 0.8em; color: #9e9e9e; margin-top: 4px; }
  `,
})
export class ClubDialog implements OnInit {
  data = inject<{ club?: Club }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<ClubDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  comites = signal<Comite[]>([]);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: [this.data?.club?.code || '', [Validators.required]],
    name: [this.data?.club?.name || '', [Validators.required]],
    comite_id: [this.data?.club?.comite_id ?? null as number | null],
  });

  logo = signal<string | null>(null);

  ngOnInit(): void {
    this.api.comites().subscribe((c) => this.comites.set(c));
    // Le logo n'est pas dans la liste des clubs : on va le chercher.
    if (this.data?.club) {
      this.api.club(this.data.club.id).subscribe((c) => this.logo.set(c.logo || null));
    }
  }

  // Redimensionne l'image côté navigateur (240 px max, JPEG) avant envoi :
  // quelques dizaines de Ko en base, quelle que soit la photo d'origine.
  onLogoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.data?.club) return;
    const clubId = this.data.club.id;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 240;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      this.api.setClubLogo(clubId, dataUrl).subscribe({
        next: () => this.logo.set(dataUrl),
        error: (err) => this.errorMsg.set(err?.error?.error || 'Erreur envoi du logo'),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.errorMsg.set('Image illisible');
    };
    img.src = url;
  }

  removeLogo(): void {
    if (!this.data?.club) return;
    this.api.setClubLogo(this.data.club.id, null).subscribe({
      next: () => this.logo.set(null),
      error: (err) => this.errorMsg.set(err?.error?.error || 'Erreur'),
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    const obs = this.data?.club
      ? this.api.updateClub(this.data.club.id, v)
      : this.api.createClub(v);
    obs.subscribe({
      next: (c) => this.ref.close(c),
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Erreur');
        this.saving.set(false);
      },
    });
  }
}
