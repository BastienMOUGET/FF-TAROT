import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../../core/api.service';
import { PenaltyType } from '../../../core/api.types';

@Component({
  selector: 'app-penalty-type-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data?.type ? 'Modifier' : 'Nouveau' }} type de pénalité
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" maxlength="20"
                 placeholder="ex: RETARD" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Libellé</mat-label>
          <input matInput formControlName="label" maxlength="150" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Points par défaut</mat-label>
          <input matInput type="number" step="0.5" formControlName="default_points" />
          <mat-hint>Négatif pour une pénalité (ex: -2)</mat-hint>
        </mat-form-field>
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
        {{ data?.type ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; min-width: 400px; }
    mat-form-field { width: 100%; }
    .err { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
  `,
})
export class PenaltyTypeDialog {
  data = inject<{ type?: PenaltyType }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<PenaltyTypeDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: [this.data?.type?.code || '', [Validators.required]],
    label: [this.data?.type?.label || '', [Validators.required]],
    default_points: [
      this.data?.type ? Number(this.data.type.default_points) : 0,
      [Validators.required],
    ],
  });

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    // back accepts numeric default_points ; PenaltyType.default_points est
    // typé string (DECIMAL côté SELECT). On stringifie pour satisfaire TS.
    const payload = { ...v, default_points: String(v.default_points) };
    const obs = this.data?.type
      ? this.api.updatePenaltyType(this.data.type.id, payload)
      : this.api.createPenaltyType(payload);
    obs.subscribe({
      next: (t) => this.ref.close(t),
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Erreur');
        this.saving.set(false);
      },
    });
  }
}
