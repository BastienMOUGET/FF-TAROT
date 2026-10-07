import { Component, OnInit, computed, inject, signal, viewChild, ElementRef } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';

import { HttpResponse } from '@angular/common/http';

import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import {
  Club,
  PenaltyType,
  Player,
  PlayerReferencedError,
  User,
} from '../../core/api.types';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { PlayerDialog } from './dialogs/player-dialog';
import { PlayersImportDialog } from './dialogs/players-import-dialog';
import { ClubDialog } from './dialogs/club-dialog';
import { PenaltyTypeDialog } from './dialogs/penalty-type-dialog';
import { UserDialog } from './dialogs/user-dialog';

@Component({
  selector: 'app-admin-page',
  imports: [
    FormsModule,
    MatTabsModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="header">
      <h1>Administration</h1>
    </div>

    @if (!isAdmin()) {
      <p class="readonly-banner">
        <mat-icon>visibility</mat-icon>
        <span>
          <strong>Consultation seule.</strong> Seul un compte administrateur
          peut modifier les joueurs, les clubs, les pénalités et les
          paramètres, ou sauvegarder la base.
        </span>
      </p>
    }

    <mat-tab-group>
      <!-- ====== JOUEURS ====== -->
      <mat-tab label="Joueurs">
        <!-- Deux fiches pour la même personne ont fait jouer un joueur à deux
             tables le 30/09. La création d'un doublon est désormais refusée,
             mais ceux déjà en base doivent être vus pour être corrigés. -->
        @if (duplicates().length > 0) {
          <div class="dup-banner">
            <mat-icon>warning</mat-icon>
            <div>
              @if (renamedRelais().length > 0) {
                <p class="m0">
                  <strong
                    >{{ renamedRelais().length }} « Relais » porte(nt) le nom
                    d'un joueur.</strong
                  >
                  Un Relais est la place fixe en Nord d'une table de 3, pas une
                  personne. Portant le nom d'un joueur, il n'apparaît dans
                  aucune liste — mais la feuille de marque affiche ce joueur à
                  deux tables. Le placement, lui, est correct : c'est le nom
                  qui est faux. Le bouton ci-dessous le corrige, sans toucher
                  aux places ni aux scores.
                </p>
                <p class="m0">
                  @for (d of renamedRelais(); track d.id) {
                    <span class="dup-chip">{{ d.name }} {{ d.firstname }} (n°{{ d.id }})</span>
                  }
                </p>
                <button
                  mat-flat-button
                  color="warn"
                  class="repair-btn"
                  [disabled]="busy()"
                  (click)="repairRelais()"
                >
                  <mat-icon>build</mat-icon> Rendre aux Relais leur nom
                </button>
              }
              @if (realDuplicates().length > 0) {
                <p class="m0">
                  <strong>{{ realDuplicates().length }} fiches font doublon.</strong>
                  Une même personne inscrite deux fois peut se retrouver assise
                  à deux tables. Supprimez la fiche en trop — de préférence
                  celle qui compte <em>0 inscription</em> :
                  @for (d of realDuplicates(); track d.id) {
                    <span class="dup-chip"
                      >{{ d.name }} {{ d.firstname }} (n°{{ d.id }},
                      {{ d.inscriptions }} inscr.)</span
                    >
                  }
                </p>
              }
            </div>
          </div>
        }
        <div class="tab-toolbar">
          <mat-form-field appearance="outline" class="search">
            <mat-label>Rechercher</mat-label>
            <input
              matInput
              [(ngModel)]="playerSearch"
              (ngModelChange)="reloadPlayers()"
              placeholder="nom, prénom ou licence"
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-checkbox
            [(ngModel)]="playerMemberOnly"
            (ngModelChange)="reloadPlayers()"
          >
            Adhérents uniquement
          </mat-checkbox>
          <span class="spacer"></span>
          <button mat-stroked-button [disabled]="!isAdmin()" (click)="importPlayers()">
            <mat-icon>upload</mat-icon> Importer une liste
          </button>
          <button mat-flat-button color="primary" [disabled]="!isAdmin()" (click)="newPlayer()">
            <mat-icon>person_add</mat-icon> Ajouter un joueur
          </button>
        </div>
        <table mat-table [dataSource]="players()" class="mat-elevation-z2">
          <ng-container matColumnDef="licence">
            <th mat-header-cell *matHeaderCellDef>Licence</th>
            <td mat-cell *matCellDef="let p">{{ p.licence || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let p">{{ p.name }} {{ p.firstname }}</td>
          </ng-container>
          <ng-container matColumnDef="club">
            <th mat-header-cell *matHeaderCellDef>Club</th>
            <td mat-cell *matCellDef="let p">{{ p.club_name || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="cat">
            <th mat-header-cell *matHeaderCellDef>Cat.</th>
            <td mat-cell *matCellDef="let p">{{ p.category || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="member">
            <th mat-header-cell *matHeaderCellDef>Adhérent</th>
            <td mat-cell *matCellDef="let p">
              @if (p.club_member) {
                <mat-icon class="member-yes" title="Adhérent">check_circle</mat-icon>
              } @else {
                —
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let p" class="actions-col">
              <button mat-icon-button [disabled]="!isAdmin()" (click)="editPlayer(p)" matTooltip="Modifier">
                <mat-icon>edit</mat-icon>
              </button>
              <button
                mat-icon-button color="warn"
                [disabled]="!isAdmin()"
                (click)="deletePlayer(p)" matTooltip="Supprimer"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="playerCols"></tr>
          <tr mat-row *matRowDef="let row; columns: playerCols"></tr>
        </table>
      </mat-tab>

      <!-- ====== CLUBS ====== -->
      <mat-tab label="Clubs">
        <div class="tab-toolbar">
          <span class="spacer"></span>
          <button mat-flat-button color="primary" [disabled]="!isAdmin()" (click)="newClub()">
            <mat-icon>add</mat-icon> Ajouter un club
          </button>
        </div>
        <table mat-table [dataSource]="clubs()" class="mat-elevation-z2">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let c">{{ c.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let c">{{ c.name }}</td>
          </ng-container>
          <ng-container matColumnDef="comite">
            <th mat-header-cell *matHeaderCellDef>Comité</th>
            <td mat-cell *matCellDef="let c">{{ c.comite_name || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let c" class="actions-col">
              <button mat-icon-button [disabled]="!isAdmin()" (click)="editClub(c)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" [disabled]="!isAdmin()" (click)="deleteClub(c)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'name', 'comite', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name', 'comite', 'actions']"></tr>
        </table>
      </mat-tab>

      <!-- ====== PÉNALITÉS (TYPES) ====== -->
      <mat-tab label="Types de pénalités">
        <div class="tab-toolbar">
          <span class="spacer"></span>
          <button mat-flat-button color="primary" [disabled]="!isAdmin()" (click)="newPenaltyType()">
            <mat-icon>add</mat-icon> Ajouter un type
          </button>
        </div>
        <table mat-table [dataSource]="penaltyTypes()" class="mat-elevation-z2">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let p">{{ p.code }}</td>
          </ng-container>
          <ng-container matColumnDef="label">
            <th mat-header-cell *matHeaderCellDef>Libellé</th>
            <td mat-cell *matCellDef="let p">{{ p.label }}</td>
          </ng-container>
          <ng-container matColumnDef="points">
            <th mat-header-cell *matHeaderCellDef class="num">Points</th>
            <td mat-cell *matCellDef="let p" class="num">{{ p.default_points }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let p" class="actions-col">
              <button mat-icon-button [disabled]="!isAdmin()" (click)="editPenaltyType(p)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" [disabled]="!isAdmin()" (click)="deletePenaltyType(p)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'label', 'points', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'label', 'points', 'actions']"></tr>
        </table>
      </mat-tab>

      <!-- ====== UTILISATEURS ====== -->
@if (isAdmin()) {
      <mat-tab label="Utilisateurs">
        <div class="tab-toolbar">
          <span class="spacer"></span>
          <button mat-flat-button color="primary" (click)="newUser()">
            <mat-icon>person_add</mat-icon> Ajouter un utilisateur
          </button>
        </div>
        <table mat-table [dataSource]="users()" class="mat-elevation-z2">
          <ng-container matColumnDef="username">
            <th mat-header-cell *matHeaderCellDef>Identifiant</th>
            <td mat-cell *matCellDef="let u">{{ u.username }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Rôle</th>
            <td mat-cell *matCellDef="let u">{{ u.role }}</td>
          </ng-container>
          <ng-container matColumnDef="full_name">
            <th mat-header-cell *matHeaderCellDef>Nom complet</th>
            <td mat-cell *matCellDef="let u">{{ u.full_name || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let u" class="actions-col">
              <button
                mat-icon-button
                (click)="changeUserPassword(u)"
                matTooltip="Changer le mot de passe"
              >
                <mat-icon>vpn_key</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteUser(u)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['username', 'role', 'full_name', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['username', 'role', 'full_name', 'actions']"></tr>
        </table>
      </mat-tab>
      }

      <!-- ====== PARAMÈTRES ====== -->
      <mat-tab label="Paramètres">
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-card-title>Paramètres de l'application</mat-card-title>
            <mat-card-subtitle>Valables pour tous les challenges</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" class="setting">
              <mat-label>Club par défaut</mat-label>
              <mat-select [value]="settingClubId()" [disabled]="!isAdmin()" (selectionChange)="saveSetting('default_club_id', $event.value)">
                <mat-option [value]="null">— aucun —</mat-option>
                @for (c of clubs(); track c.id) {
                  <mat-option [value]="c.id">{{ c.name }} ({{ c.code }})</mat-option>
                }
              </mat-select>
              <mat-hint>Affiché en tête du bandeau latéral et présélectionné à la création d'un challenge.</mat-hint>
            </mat-form-field>
            <mat-form-field appearance="outline" class="setting">
              <mat-label>Nombre de manches par défaut</mat-label>
              <input matInput type="number" min="1" max="12" [disabled]="!isAdmin()" [value]="settingRounds()" (change)="saveSetting('rounds_default', $any($event.target).value)" />
              <mat-hint>Proposé à la création d'un tournoi ; toutes les manches sont générées après le tirage au sort.</mat-hint>
            </mat-form-field>
          </mat-card-content>
        </mat-card>

        <!-- ====== SAUVEGARDE / RESTAURATION ====== -->
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-card-title>Sauvegarde des données du club</mat-card-title>
            <mat-card-subtitle>
              Réservé à l'administrateur
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (!isAdmin()) {
              <p class="locked">
                <mat-icon>lock</mat-icon>
                Seul un compte administrateur peut sauvegarder ou restaurer la
                base. Demandez-lui de le faire.
              </p>
            }
            <p class="hint">
              La sauvegarde enregistre <strong>toute</strong> la base (joueurs,
              challenges, tournois, manches, scores) dans un fichier
              <code>.sql</code>. À faire avant chaque mise à jour du programme
              et après chaque soirée.
            </p>
            <div class="backup-actions">
              <button
                mat-flat-button
                color="primary"
                [disabled]="!isAdmin() || busy()"
                (click)="downloadBackup()"
              >
                <mat-icon>save</mat-icon> Sauvegarder
              </button>
              <button
                mat-stroked-button
                color="warn"
                [disabled]="!isAdmin() || busy()"
                (click)="pickRestoreFile()"
              >
                <mat-icon>restore</mat-icon> Restaurer…
              </button>
              @if (busy()) {
                <span class="busy">{{ busyLabel() }}</span>
              }
            </div>
            <p class="warn-restore">
              <mat-icon>warning</mat-icon>
              La restauration <strong>remplace</strong> les données actuelles
              par celles du fichier. Tout ce qui a été saisi depuis cette
              sauvegarde est perdu.
            </p>
            <input
              #restoreInput
              type="file"
              accept=".sql"
              hidden
              (change)="restoreFrom($any($event.target))"
            />
          </mat-card-content>
        </mat-card>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .header { display: flex; align-items: center; margin-bottom: 16px; }
    .header h1 { margin: 0; }
    .tab-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 0;
    }
    .spacer { flex: 1 1 auto; }
    .search { width: 320px; }
    table { width: 100%; }
    .num { text-align: right; }
    .actions-col { width: 120px; text-align: right; }
    .member-yes { color: #2e7d32; vertical-align: middle; }
    .settings-card { margin-top: 16px; max-width: 640px; }
    .settings-card mat-card-content { display: flex; flex-direction: column; gap: 20px; padding-top: 16px; }
    .setting { width: 100%; }
    .m0 { margin: 0 0 8px; }
    .repair-btn { margin: 4px 0 4px; }
    .dup-banner {
      display: flex; align-items: flex-start; gap: 10px; margin: 12px 0 0;
      padding: 10px 14px; border-radius: 4px;
      background: #fff3e0; color: #e65100; line-height: 1.5;
    }
    .dup-chip {
      display: inline-block; margin: 2px 4px 0 0; padding: 1px 8px;
      border-radius: 10px; background: #ffe0b2; font-size: 0.9em;
    }
    .readonly-banner {
      display: flex; align-items: center; gap: 10px; margin: 0 0 12px;
      padding: 10px 14px; border-radius: 4px;
      background: #e3f2fd; color: #0d47a1; line-height: 1.4;
    }
    .hint { margin: 0; color: rgba(0, 0, 0, 0.7); }
    .locked, .warn-restore {
      display: flex; align-items: flex-start; gap: 8px; margin: 0;
      padding: 10px 12px; border-radius: 4px; line-height: 1.4;
    }
    .locked { background: #eceff1; color: #455a64; }
    .warn-restore { background: #fff3e0; color: #e65100; }
    .locked mat-icon, .warn-restore mat-icon { flex: 0 0 auto; }
    .backup-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .busy { color: rgba(0, 0, 0, 0.6); font-style: italic; }
  `,
})
export class AdminPage implements OnInit {
  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  clubs = signal<Club[]>([]);
  players = signal<Player[]>([]);
  penaltyTypes = signal<PenaltyType[]>([]);
  users = signal<User[]>([]);

  // Les deux boutons de sauvegarde sont grisés pour les non-administrateurs :
  // le serveur refuse déjà la route, l'écran le dit avant le clic.
  readonly isAdmin = inject(AuthService).isAdmin;
  busy = signal(false);
  busyLabel = signal('');
  restoreInput = viewChild<ElementRef<HTMLInputElement>>('restoreInput');

  duplicates = signal<
    {
      id: number;
      name: string;
      firstname: string;
      licence: string | null;
      inscriptions: number;
      is_relais: boolean;
    }[]
  >([]);

  renamedRelais = computed(() => this.duplicates().filter((d) => d.is_relais));
  realDuplicates = computed(() => this.duplicates().filter((d) => !d.is_relais));


  settingClubId = signal<number | null>(null);
  settingRounds = signal<number>(4);

  playerSearch = '';
  playerMemberOnly = false;
  playerCols = ['licence', 'name', 'club', 'cat', 'member', 'actions'];

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll() {
    this.api.settings().subscribe((st) => {
      const id = Number(st.default_club_id);
      this.settingClubId.set(id > 0 ? id : null);
      const n = Number(st.rounds_default);
      this.settingRounds.set(n >= 1 ? n : 4);
    });
    this.reloadPlayers();
    this.api.clubs().subscribe((d) => this.clubs.set(d));
    this.api.penaltyTypes().subscribe((d) => this.penaltyTypes.set(d));
    // /api/users est refusé à un non-admin : on ne le demande pas, sinon
    // l'écran s'ouvrirait sur une erreur sans objet.
    if (this.isAdmin()) this.api.users().subscribe((d) => this.users.set(d));
    if (this.isAdmin())
      this.api.playerDuplicates().subscribe({
        next: (d) => this.duplicates.set(d),
        error: () => this.duplicates.set([]),
      });
  }

  reloadPlayers() {
    this.api
      .players({
        search: this.playerSearch || undefined,
        club_member: this.playerMemberOnly || undefined,
      })
      .subscribe((p) => this.players.set(p));
  }

  /* ----- Paramètres ----- */
  saveSetting(key: 'default_club_id' | 'rounds_default', value: unknown): void {
    const v = value === null || value === undefined || value === '' ? '' : String(value);
    this.api.updateSettings({ [key]: v }).subscribe({
      next: () => {
        this.snack.open('Paramètre enregistré — rechargez la page pour voir le bandeau', 'Fermer', { duration: 3000 });
        if (key === 'default_club_id') this.settingClubId.set(v ? Number(v) : null);
        else this.settingRounds.set(v ? Number(v) : 4);
      },
      error: (err) => this.snack.open(err?.error?.error || 'Erreur', 'Fermer', { duration: 3000 }),
    });
  }

  /* ----- Players ----- */
  newPlayer() {
    this.openDialog(PlayerDialog, {}, () => this.reloadPlayers());
  }
  importPlayers() {
    const ref = this.dialog.open(PlayersImportDialog, { width: '600px' });
    ref.afterClosed().subscribe((imported) => {
      if (imported) this.reloadPlayers();
    });
  }
  editPlayer(player: Player) {
    this.openDialog(PlayerDialog, { player }, () => this.reloadPlayers());
  }
  // Un joueur inscrit à un tournoi est protégé par des clés étrangères côté
  // base. Plutôt que d'afficher un « suppression impossible » sans suite, on
  // montre ce qui bloque et — si aucun résultat n'est en jeu — on propose de
  // supprimer quand même.
  deletePlayer(p: Player) {
    const who = `${p.firstname} ${p.name}`;
    this.confirm({
      title: 'Confirmation',
      message: `Supprimer ${who} ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deletePlayer(p.id).subscribe({
        next: () => this.onPlayerDeleted(),
        error: (err: any) => this.onPlayerDeleteBlocked(p, who, err),
      });
    });
  }

  private onPlayerDeleteBlocked(p: Player, who: string, err: any) {
    const detail = err?.error as PlayerReferencedError | undefined;
    if (err?.status !== 409 || detail?.code !== 'player_referenced') {
      this.snack.open(detail?.error || 'Suppression impossible', 'Fermer', {
        duration: 4000,
      });
      return;
    }

    const list = detail.tournaments.map((t) => `  • ${t.name}`).join('\n');
    const plural = detail.tournaments.length > 1 ? 'ces tournois' : 'ce tournoi';

    // Résultats déjà saisis : la seule issue propre est de supprimer le
    // tournoi d'abord. On le dit, au lieu de laisser l'utilisateur bloqué.
    if (!detail.can_force) {
      this.confirm({
        title: 'Suppression impossible',
        message: `${detail.error}\n\nTournoi(s) concerné(s) :\n${list}`,
        confirmLabel: 'Fermer',
        hideCancel: true,
      }).subscribe();
      return;
    }

    this.confirm({
      title: 'Joueur inscrit à un tournoi',
      message:
        `${detail.error}\n\nTournoi(s) concerné(s) :\n${list}\n\n` +
        `Le supprimer retirera aussi son équipe de ${plural}. ` +
        `Ses coéquipiers ne seront plus inscrits, mais ils ne seront pas supprimés.`,
      confirmLabel: 'Supprimer quand même',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.api.deletePlayer(p.id, true).subscribe({
        next: () => this.onPlayerDeleted(),
        error: (e: any) =>
          this.snack.open(e?.error?.error || 'Suppression impossible', 'Fermer', {
            duration: 4000,
          }),
      });
    });
  }

  private onPlayerDeleted() {
    this.snack.open('Supprimé', 'Fermer', { duration: 1500 });
    this.reloadPlayers();
  }

  /* ----- Clubs ----- */
  newClub() {
    this.openDialog(ClubDialog, {}, () =>
      this.api.clubs().subscribe((c) => this.clubs.set(c))
    );
  }
  editClub(club: Club) {
    this.openDialog(ClubDialog, { club }, () =>
      this.api.clubs().subscribe((c) => this.clubs.set(c))
    );
  }
  deleteClub(c: Club) {
    this.confirmAndDelete(
      `Supprimer le club "${c.name}" ?`,
      () => this.api.deleteClub(c.id),
      () => this.api.clubs().subscribe((cl) => this.clubs.set(cl))
    );
  }

  /* ----- Penalty Types ----- */
  newPenaltyType() {
    this.openDialog(PenaltyTypeDialog, {}, () =>
      this.api.penaltyTypes().subscribe((p) => this.penaltyTypes.set(p))
    );
  }
  editPenaltyType(type: PenaltyType) {
    this.openDialog(PenaltyTypeDialog, { type }, () =>
      this.api.penaltyTypes().subscribe((p) => this.penaltyTypes.set(p))
    );
  }
  deletePenaltyType(t: PenaltyType) {
    this.confirmAndDelete(
      `Supprimer le type "${t.label}" ?`,
      () => this.api.deletePenaltyType(t.id),
      () => this.api.penaltyTypes().subscribe((p) => this.penaltyTypes.set(p))
    );
  }

  /* ----- Users ----- */
  newUser() {
    this.openDialog(UserDialog, {}, () =>
      this.api.users().subscribe((u) => this.users.set(u))
    );
  }
  changeUserPassword(user: User) {
    this.openDialog(UserDialog, { user }, () =>
      this.snack.open('Mot de passe modifié', 'Fermer', { duration: 2000 })
    );
  }
  deleteUser(u: User) {
    this.confirmAndDelete(
      `Supprimer l'utilisateur "${u.username}" ?`,
      () => this.api.deleteUser(u.id),
      () => this.api.users().subscribe((us) => this.users.set(us))
    );
  }

  /* ----- helpers ----- */
  private openDialog(component: any, data: any, onDone: () => void) {
    const ref = this.dialog.open(component, { data });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        onDone();
        this.snack.open('Enregistré', 'Fermer', { duration: 1500 });
      }
    });
  }

  /* ----- Sauvegarde / restauration ----- */

  // Le fichier .sql peut peser quelques Mo : on bloque les deux boutons le
  // temps de l'aller-retour, sinon un double clic lance deux restaurations.
  private downloadName(res: HttpResponse<Blob>): string {
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    return m ? m[1] : 'pabb90-sauvegarde.sql';
  }

  downloadBackup(): void {
    if (!this.isAdmin()) return;
    this.busy.set(true);
    this.busyLabel.set('Sauvegarde en cours…');
    this.api.backupDump().subscribe({
      next: (res) => {
        this.busy.set(false);
        const blob = res.body;
        if (!blob) {
          this.snack.open('Sauvegarde vide', 'Fermer', { duration: 3000 });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.downloadName(res);
        a.click();
        URL.revokeObjectURL(url);
        this.confirm({
          title: 'Sauvegarde enregistrée',
          message:
            'Le fichier « ' +
            a.download +
            ' » est dans votre dossier de téléchargements. Copiez-le sur une clé USB ou dans un dossier de sauvegarde : il contient toutes les données du club.',
          confirmLabel: 'Compris',
          hideCancel: true,
        }).subscribe();
      },
      error: (err: any) => {
        this.busy.set(false);
        // La réponse est demandée en Blob : en cas d'erreur, le corps JSON du
        // serveur arrive lui aussi en Blob, et `err.error.error` est vide.
        // Sans ce décodage, toute panne se résumait à « la sauvegarde a
        // échoué », sans le diagnostic que le serveur avait pourtant écrit
        // (retour terrain n°15).
        this.showError('Sauvegarde impossible', err, 'La sauvegarde a échoué.');
      },
    });
  }

  // Un message d'erreur de sauvegarde tient sur plusieurs lignes (outil,
  // dossier, message système) : une boîte de dialogue, pas un bandeau qui
  // disparaît au bout de cinq secondes.
  private showError(title: string, err: any, fallback: string): void {
    const say = (message: string) =>
      this.confirm({
        title,
        message,
        confirmLabel: 'Fermer',
        hideCancel: true,
      }).subscribe();
    const body = err?.error;
    if (body instanceof Blob) {
      body.text().then(
        (t) => {
          try {
            say(JSON.parse(t)?.error || fallback);
          } catch {
            say(t || fallback);
          }
        },
        () => say(fallback)
      );
      return;
    }
    say(body?.error || fallback);
  }

  pickRestoreFile(): void {
    if (!this.isAdmin()) return;
    this.restoreInput()?.nativeElement.click();
  }

  restoreFrom(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = ''; // pour pouvoir reprendre le même fichier après un refus
    if (!file || !this.isAdmin()) return;

    this.confirm({
      title: 'Restaurer la base ?',
      message:
        'Toutes les données actuelles seront remplacées par celles du fichier « ' +
        file.name +
        ' ». Ce qui a été saisi depuis cette sauvegarde sera définitivement perdu.',
      confirmLabel: 'Restaurer',
      danger: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.busy.set(true);
      this.busyLabel.set('Lecture du fichier…');
      file.text().then(
        (sql) => {
          this.busyLabel.set('Restauration en cours…');
          this.api.restoreDump(sql).subscribe({
            next: () => {
              this.busy.set(false);
              this.reloadAll();
              this.confirm({
                title: 'Base restaurée',
                message:
                  'Les données de la sauvegarde sont en place. Fermez puis rouvrez le programme pour que tous les écrans soient relus.',
                confirmLabel: 'Compris',
                hideCancel: true,
              }).subscribe();
            },
            error: (err: any) => {
              this.busy.set(false);
              this.showError(
                'Restauration impossible',
                err,
                'La restauration a échoué.'
              );
            },
          });
        },
        () => {
          this.busy.set(false);
          this.snack.open('Fichier illisible', 'Fermer', { duration: 3000 });
        }
      );
    });
  }

  // Rend aux Relais leur nom canonique. Un Relais n'est pas une personne :
  // réécrire son nom ne perd aucune donnée.
  repairRelais(): void {
    this.confirm({
      title: 'Rendre aux Relais leur nom ?',
      message:
        'Les places « Relais » reprendront les noms « Relais 1 », « Relais 2 »… ' +
        "Aucune donnée de joueur n'est touchée : un Relais n'est pas une " +
        'personne, c\'est la place fixe en Nord d\'une table de 3.',
      confirmLabel: 'Réparer',
    }).subscribe((ok) => {
      if (!ok) return;
      this.busy.set(true);
      this.api.repairRelais().subscribe({
        next: (r) => {
          this.busy.set(false);
          this.reloadAll();
          const lignes = r.repaired
            .map((x) => `« ${x.was} » → « ${x.now} »`)
            .join('\n');
          this.confirm({
            title: 'Relais réparés',
            message: r.repaired.length
              ? lignes +
                '\n\nLe placement lui-même était juste : seul le nom affiché ' +
                'était faux. Réimprimez la feuille de marque, inutile de ' +
                'refaire le tirage des places.'
              : 'Aucun Relais à réparer.',
            confirmLabel: 'Compris',
            hideCancel: true,
          }).subscribe();
        },
        error: (err: any) => {
          this.busy.set(false);
          this.showError('Réparation impossible', err, 'La réparation a échoué.');
        },
      });
    });
  }

  private confirm(data: ConfirmDialogData) {
    return this.dialog.open(ConfirmDialog, { data, width: '520px' }).afterClosed();
  }

  private confirmAndDelete(
    message: string,
    deleteFn: () => any,
    onDone: () => void
  ) {
    this.confirm({
      title: 'Confirmation',
      message,
      confirmLabel: 'Supprimer',
      danger: true,
    })
      .subscribe((ok) => {
        if (!ok) return;
        deleteFn().subscribe({
          next: () => {
            this.snack.open('Supprimé', 'Fermer', { duration: 1500 });
            onDone();
          },
          error: (err: any) =>
            this.snack.open(
              err?.error?.error || 'Suppression impossible',
              'Fermer',
              { duration: 3000 }
            ),
        });
      });
  }
}
