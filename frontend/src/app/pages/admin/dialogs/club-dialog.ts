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
          <mat-label>Code *</mat-label>
          <input matInput formControlName="code" maxlength="15" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nom *</mat-label>
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

  ngOnInit(): void {
    this.api.comites().subscribe((c) => this.comites.set(c));
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
