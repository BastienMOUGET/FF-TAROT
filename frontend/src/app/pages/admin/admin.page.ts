import { Component, OnInit, inject, signal } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
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

import { ApiService } from '../../core/api.service';
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

    <mat-tab-group>
      <!-- ====== JOUEURS ====== -->
      <mat-tab label="Joueurs">
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
          <button mat-stroked-button (click)="importPlayers()">
            <mat-icon>upload</mat-icon> Importer une liste
          </button>
          <button mat-flat-button color="primary" (click)="newPlayer()">
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
              <button mat-icon-button (click)="editPlayer(p)" matTooltip="Modifier">
                <mat-icon>edit</mat-icon>
              </button>
              <button
                mat-icon-button color="warn"
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
          <button mat-flat-button color="primary" (click)="newClub()">
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
              <button mat-icon-button (click)="editClub(c)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteClub(c)">
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
          <button mat-flat-button color="primary" (click)="newPenaltyType()">
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
              <button mat-icon-button (click)="editPenaltyType(p)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deletePenaltyType(p)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'label', 'points', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'label', 'points', 'actions']"></tr>
        </table>
      </mat-tab>

      <!-- ====== UTILISATEURS ====== -->
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

  playerSearch = '';
  playerMemberOnly = false;
  playerCols = ['licence', 'name', 'club', 'cat', 'member', 'actions'];

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll() {
    this.reloadPlayers();
    this.api.clubs().subscribe((d) => this.clubs.set(d));
    this.api.penaltyTypes().subscribe((d) => this.penaltyTypes.set(d));
    this.api.users().subscribe((d) => this.users.set(d));
  }

  reloadPlayers() {
    this.api
      .players({
        search: this.playerSearch || undefined,
        club_member: this.playerMemberOnly || undefined,
      })
      .subscribe((p) => this.players.set(p));
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
