import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ApiService } from '../../../core/api.service';
import { Club, Player } from '../../../core/api.types';
import { matchPlayers } from './player-match';

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
    MatCheckboxModule,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.player ? 'Modifier' : 'Nouveau' }} joueur
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form">
        <mat-form-field appearance="outline">
          <mat-label>N° de licence (optionnel)</mat-label>
          <input matInput formControlName="licence" />
        </mat-form-field>
        <div class="row2">
          <mat-form-field appearance="outline">
            <mat-label>Nom</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Prénom</mat-label>
            <input matInput formControlName="firstname" />
          </mat-form-field>
        </div>
        <!-- Doublons signalés pendant la saisie : le serveur refuse de toute
             façon un doublon, mais l'apprendre après coup ne suffisait pas. -->
        @if (matches().same; as d) {
          <p class="dup dup-same">
            <mat-icon>block</mat-icon>
            <span>
              <strong>{{ d.name }} {{ d.firstname }}</strong> existe déjà
              (fiche n°{{ d.id }}). Les majuscules, accents, espaces, tirets et
              l'ordre nom/prénom ne comptent pas : modifiez la fiche existante
              plutôt que d'en créer une seconde.
            </span>
          </p>
        } @else if (matches().similar.length > 0) {
          <div class="dup dup-similar">
            <p>
              <mat-icon>warning</mat-icon>
              <span>Joueur(s) au nom proche déjà dans la liste :</span>
            </p>
            <ul>
              @for (s of matches().similar; track s.id) {
                <li>{{ s.name }} {{ s.firstname }} (fiche n°{{ s.id }})</li>
              }
            </ul>
            <mat-checkbox [checked]="distinctConfirmed()" (change)="distinctConfirmed.set($event.checked)">
              J'ai vérifié : ce n'est pas la même personne
            </mat-checkbox>
          </div>
        }
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
        <mat-checkbox formControlName="club_member">
          Adhérent du club
        </mat-checkbox>
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
        [disabled]="form.invalid || saving() || blockedByDuplicate()"
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
    .dup {
      display: flex; flex-direction: column; gap: 4px;
      margin: 0 0 12px; padding: 10px 12px; border-radius: 8px;
      font-size: 0.9em; line-height: 1.35;
    }
    .dup p { display: flex; align-items: flex-start; gap: 8px; margin: 0; }
    .dup ul { margin: 0 0 0 32px; padding: 0; }
    .dup mat-icon { flex: 0 0 auto; }
    .dup-same { flex-direction: row; align-items: flex-start; gap: 8px; background: #fdecea; color: #b71c1c; }
    .dup-similar { background: #fff4e5; color: #8a4b00; }
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

  // Liste des joueurs pour signaler un doublon pendant la saisie.
  private allPlayers = signal<Player[]>([]);
  private typedName = signal('');
  private typedFirstname = signal('');
  distinctConfirmed = signal(false);
  matches = computed(() => {
    // En modification, rien à signaler tant que le nom n'est pas changé
    // (changer le club d'une fiche ne doit rien demander de plus).
    const p = this.data.player;
    if (p && this.typedName().trim() === p.name && this.typedFirstname().trim() === p.firstname) {
      return { same: null, similar: [] as Player[] };
    }
    return matchPlayers(this.typedName(), this.typedFirstname(), this.allPlayers(), p?.id);
  });
  // Doublon exact : création impossible. Nom proche : il faut confirmer.
  blockedByDuplicate = computed(
    () => !!this.matches().same || (this.matches().similar.length > 0 && !this.distinctConfirmed())
  );

  form = this.fb.nonNullable.group({
    licence: [''],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    firstname: ['', [Validators.required, Validators.maxLength(100)]],
    club_id: [null as number | null],
    category: [''],
    gender: [null as 'M' | 'F' | null],
    birth_year: [null as number | null],
    club_member: [false],
  });

  ngOnInit(): void {
    this.api.clubs().subscribe((c) => this.clubs.set(c));
    this.api.players().subscribe({ next: (p) => this.allPlayers.set(p), error: () => this.allPlayers.set([]) });
    this.form.controls.name.valueChanges.subscribe((v) => {
      this.typedName.set(v ?? '');
      this.distinctConfirmed.set(false);
    });
    this.form.controls.firstname.valueChanges.subscribe((v) => {
      this.typedFirstname.set(v ?? '');
      this.distinctConfirmed.set(false);
    });
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
        club_member: p.club_member,
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
      club_member: v.club_member,
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
