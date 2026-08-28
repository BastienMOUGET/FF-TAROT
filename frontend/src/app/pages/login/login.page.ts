import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>PABB90 <small class="version">v{{ version }}</small></mat-card-title>
          <mat-card-subtitle>Connexion arbitre</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Identifiant</mat-label>
              <input matInput formControlName="username" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Mot de passe</mat-label>
              <input
                matInput
                type="password"
                formControlName="password"
                autocomplete="current-password"
              />
            </mat-form-field>
            @if (errorMsg()) {
              <p class="err">
                <mat-icon>error_outline</mat-icon>
                {{ errorMsg() }}
              </p>
            }
            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="full-width"
              [disabled]="form.invalid || loading()"
            >
              @if (loading()) {
                <mat-progress-spinner diameter="20" mode="indeterminate" />
              } @else {
                Se connecter
              }
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 24px;
    }
    .full-width {
      width: 100%;
      display: block;
      margin-bottom: 12px;
    }
    .err {
      color: #d32f2f;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0 16px;
    }
    .version {
      font-size: 0.55em;
      color: #757575;
      font-weight: normal;
      margin-left: 6px;
    }
  `,
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected version = environment.appVersion;

  loading = signal(false);
  errorMsg = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit() {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username, password);
      this.router.navigate(['/tournaments']);
    } catch (err: any) {
      this.errorMsg.set(
        err?.error?.error || 'Connexion impossible. Vérifie tes identifiants.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
