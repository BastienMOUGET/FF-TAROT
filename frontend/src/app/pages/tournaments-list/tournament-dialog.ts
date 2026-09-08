import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSelectModule } from '@angular/material/select';
import { provideNativeDateAdapter } from '@angular/material/core';

import { ApiService } from '../../core/api.service';
import { Club } from '../../core/api.types';

@Component({
  selector: 'app-tournament-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatSelectModule,
  ],
  providers: [provideNativeDateAdapter()],
  template: `
    <h2 mat-dialog-title>Nouveau Challenge</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" placeholder="ex: TOUR-2026-01" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Nom</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Club</mat-label>
          <mat-select formControlName="club_id">
            <mat-option [value]="null">— aucun —</mat-option>
            @for (c of clubs(); track c.id) {
              <mat-option [value]="c.id">{{ c.name }} ({{ c.code }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Date</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="date" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Annuler</button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="form.invalid || loading()"
        (click)="submit()"
      >
        Créer
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; }
    .full { width: 100%; }
  `,
})
export class TournamentDialog implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private ref = inject(MatDialogRef<TournamentDialog>);

  loading = signal(false);
  clubs = signal<Club[]>([]);

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    club_id: [null as number | null],
    date: [null as Date | null],
  });

  // Le club du challenge apparaît sur ses classements (nom + logo). S'il
  // n'y a qu'un club en base — le cas d'un club qui gère ses propres
  // soirées — il est présélectionné.
  ngOnInit(): void {
    this.api.clubs().subscribe((clubs) => {
      this.clubs.set(clubs);
      if (clubs.length === 1) this.form.patchValue({ club_id: clubs[0].id });
    });
  }

  cancel() {
    this.ref.close(false);
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const v = this.form.getRawValue();
    this.api
      .createTournament({
        code: v.code,
        name: v.name,
        club_id: v.club_id,
        date: v.date ? v.date.toISOString().slice(0, 10) : null,
      })
      .subscribe({
        next: () => this.ref.close(true),
        error: () => this.loading.set(false),
      });
  }
}
