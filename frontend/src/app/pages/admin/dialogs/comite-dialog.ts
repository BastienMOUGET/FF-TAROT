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
import { Comite, Ligue } from '../../../core/api.types';

@Component({
  selector: 'app-comite-dialog',
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
    <h2 mat-dialog-title>{{ data?.comite ? 'Modifier' : 'Nouveau' }} comité</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Code *</mat-label>
          <input matInput formControlName="code" maxlength="10" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nom *</mat-label>
          <input matInput formControlName="name" maxlength="100" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Ligue</mat-label>
          <mat-select formControlName="ligue_id">
            <mat-option [value]="null">— aucune —</mat-option>
            @for (l of ligues(); track l.id) {
              <mat-option [value]="l.id">{{ l.name }} ({{ l.code }})</mat-option>
            }
          </mat-select>
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
        {{ data?.comite ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; min-width: 400px; }
    mat-form-field { width: 100%; }
    .err { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
  `,
})
export class ComiteDialog implements OnInit {
  data = inject<{ comite?: Comite }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<ComiteDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  ligues = signal<Ligue[]>([]);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: [this.data?.comite?.code || '', [Validators.required]],
    name: [this.data?.comite?.name || '', [Validators.required]],
    ligue_id: [this.data?.comite?.ligue_id ?? null as number | null],
  });

  ngOnInit(): void {
    this.api.ligues().subscribe((l) => this.ligues.set(l));
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();
    const obs = this.data?.comite
      ? this.api.updateComite(this.data.comite.id, v)
      : this.api.createComite(v);
    obs.subscribe({
      next: (c) => this.ref.close(c),
      error: (err) => {
        this.errorMsg.set(err?.error?.error || 'Erreur');
        this.saving.set(false);
      },
    });
  }
}
