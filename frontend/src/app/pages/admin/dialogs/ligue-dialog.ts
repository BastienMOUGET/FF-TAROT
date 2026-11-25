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
import { Ligue } from '../../../core/api.types';

@Component({
  selector: 'app-ligue-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.ligue ? 'Modifier' : 'Nouvelle' }} ligue</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" maxlength="10" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" maxlength="100" />
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
        {{ data?.ligue ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; min-width: 360px; }
    mat-form-field { width: 100%; }
    .err { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
  `,
})
export class LigueDialog {
  data = inject<{ ligue?: Ligue }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<LigueDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: [this.data?.ligue?.code || '', [Validators.required]],
    name: [this.data?.ligue?.name || '', [Validators.required]],
  });

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    const obs = this.data?.ligue
      ? this.api.updateLigue(this.data.ligue.id, v)
      : this.api.createLigue(v);
    obs.subscribe({
      next: (l) => this.ref.close(l),
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Erreur');
        this.saving.set(false);
      },
    });
  }
}
