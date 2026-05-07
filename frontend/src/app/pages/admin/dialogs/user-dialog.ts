import { Component, inject, signal } from '@angular/core';
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
import { Role, User } from '../../../core/api.types';

@Component({
  selector: 'app-user-dialog',
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
      {{ data?.user ? 'Modifier mot de passe' : 'Nouvel utilisateur' }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        @if (!data?.user) {
          <mat-form-field appearance="outline">
            <mat-label>Identifiant *</mat-label>
            <input matInput formControlName="username" maxlength="50" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Rôle *</mat-label>
            <mat-select formControlName="role">
              <mat-option value="admin">admin</mat-option>
              <mat-option value="arbitre">arbitre</mat-option>
              <mat-option value="viewer">viewer</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Nom complet</mat-label>
            <input matInput formControlName="full_name" maxlength="150" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
        } @else {
          <p class="user-label">
            <mat-icon>person</mat-icon> {{ data.user!.username }}
          </p>
        }
        <mat-form-field appearance="outline">
          <mat-label>
            {{ data?.user ? 'Nouveau mot de passe' : 'Mot de passe' }} *
          </mat-label>
          <input matInput type="password" formControlName="password" />
          <mat-hint>Minimum 6 caractères</mat-hint>
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
        {{ data?.user ? 'Enregistrer' : 'Créer' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; min-width: 400px; }
    mat-form-field { width: 100%; }
    .err { color: #d32f2f; display: flex; align-items: center; gap: 6px; }
    .user-label { display: flex; align-items: center; gap: 8px; }
  `,
})
export class UserDialog {
  data = inject<{ user?: User }>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<UserDialog>>(MatDialogRef);
  private fb = inject(FormBuilder);
  private api = inject(ApiService);

  saving = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    username: ['', this.data?.user ? [] : [Validators.required, Validators.minLength(3)]],
    role: ['arbitre' as Role, this.data?.user ? [] : [Validators.required]],
    full_name: [''],
    email: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const v = this.form.getRawValue();

    const onError = (err: any) => {
      this.errorMsg.set(err?.error?.error || 'Erreur');
      this.saving.set(false);
    };

    if (this.data?.user) {
      this.api
        .changeUserPassword(this.data.user.id, v.password)
        .subscribe({ next: () => this.ref.close(true), error: onError });
    } else {
      this.api
        .createUser({
          username: v.username,
          password: v.password,
          role: v.role,
          full_name: v.full_name || undefined,
          email: v.email || undefined,
        })
        .subscribe({ next: (u) => this.ref.close(u), error: onError });
    }
  }
}
