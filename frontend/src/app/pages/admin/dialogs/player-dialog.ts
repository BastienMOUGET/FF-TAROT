import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
import { Club, Player } from '../../../core/api.types';

export interface PlayerDialogData {
  player?: Player;
}

@Component({
  selector: 'app-player-dialog',
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
    <h2 mat-dialog-title>
      {{ data.player ? 'Modifier' : 'Nouveau' }} joueur
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Licence FFT (optionnel)</mat-label>
          <input matInput formControlName="licence" />
        </mat-form-field>
        <div class="row2">
          <mat-form-field appearance="outline">
            <mat-label>Nom *</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Prénom *</mat-label>
            <input matInput formControlName="firstname" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Club</mat-label>
          <mat-select formControlName="club_id">
            <mat-option [value]="null">— aucun —</mat-option>
            @for (c of clubs(); track c.id) {
              <mat-option [value]="c.id">
                {{ c.name }} ({{ c.code }})
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row3">
          <mat-form-field appearance="outline">
            <mat-label>Catégorie</mat-label>
            <input matInput formControlName="category" placeholder="ex: S" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Sexe</mat-label>
            <mat-select formControlName="gender">
              <mat-option [value]="null">—</mat-option>
              <mat-option value="M">M</mat-option>
              <mat-option value="F">F</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Année naissance</mat-label>
            <input matInput type="number" formControlName="birth_year" />
          </mat-form-field>
        </div>
        @if (errorMsg()) {
          <p class="err">
            <mat-icon>error_outline</mat-icon>
            {{ errorMsg() }}
          </p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">Annuler</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid || saving()"
        (click)="submit()"
      >
        {{ data.player ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 480px;
    }
    .row2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .row3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
    mat-form-field { width: 100%; }
    .err {
      color: #d32f2f;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 8px;
    }
  `,
})
export class PlayerDialog implements OnInit {
  data = inject<PlayerDialogData>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<PlayerDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  clubs = signal<Club[]>([]);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    licence: [''],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    firstname: ['', [Validators.required, Validators.maxLength(100)]],
    club_id: [null as number | null],
    category: [''],
    gender: [null as 'M' | 'F' | null],
    birth_year: [null as number | null],
  });

  ngOnInit(): void {
    this.api.clubs().subscribe((c) => this.clubs.set(c));
    if (this.data.player) {
      const p = this.data.player;
      this.form.patchValue({
        licence: p.licence || '',
        name: p.name,
        firstname: p.firstname,
        club_id: p.club_id,
        category: p.category || '',
        gender: p.gender,
        birth_year: p.birth_year,
      });
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const data: Partial<Player> = {
      licence: v.licence || null,
      name: v.name,
      firstname: v.firstname,
      club_id: v.club_id,
      category: v.category || null,
      gender: v.gender,
      birth_year: v.birth_year,
    };
    this.saving.set(true);
    this.errorMsg.set(null);
    const obs = this.data.player
      ? this.api.updatePlayer(this.data.player.id, data)
      : this.api.createPlayer(data);
    obs.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.ref.close(saved);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Erreur d\'enregistrement');
        this.saving.set(false);
      },
    });
  }
}
