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
  Comite,
  Ligue,
  PenaltyType,
  Player,
  User,
} from '../../core/api.types';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { PlayerDialog } from './dialogs/player-dialog';
import { ClubDialog } from './dialogs/club-dialog';
import { ComiteDialog } from './dialogs/comite-dialog';
import { LigueDialog } from './dialogs/ligue-dialog';
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

      <!-- ====== COMITÉS ====== -->
      <mat-tab label="Comités">
        <div class="tab-toolbar">
          <span class="spacer"></span>
          <button mat-flat-button color="primary" (click)="newComite()">
            <mat-icon>add</mat-icon> Ajouter un comité
          </button>
        </div>
        <table mat-table [dataSource]="comites()" class="mat-elevation-z2">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let c">{{ c.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let c">{{ c.name }}</td>
          </ng-container>
          <ng-container matColumnDef="ligue">
            <th mat-header-cell *matHeaderCellDef>Ligue</th>
            <td mat-cell *matCellDef="let c">{{ c.ligue_name || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let c" class="actions-col">
              <button mat-icon-button (click)="editComite(c)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteComite(c)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'name', 'ligue', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name', 'ligue', 'actions']"></tr>
        </table>
      </mat-tab>

      <!-- ====== LIGUES ====== -->
      <mat-tab label="Ligues">
        <div class="tab-toolbar">
          <span class="spacer"></span>
          <button mat-flat-button color="primary" (click)="newLigue()">
            <mat-icon>add</mat-icon> Ajouter une ligue
          </button>
        </div>
        <table mat-table [dataSource]="ligues()" class="mat-elevation-z2">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let l">{{ l.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let l">{{ l.name }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let l" class="actions-col">
              <button mat-icon-button (click)="editLigue(l)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteLigue(l)">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'name', 'actions']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name', 'actions']"></tr>
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

  ligues = signal<Ligue[]>([]);
  comites = signal<Comite[]>([]);
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
    this.api.ligues().subscribe((d) => this.ligues.set(d));
    this.api.comites().subscribe((d) => this.comites.set(d));
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
  editPlayer(player: Player) {
    this.openDialog(PlayerDialog, { player }, () => this.reloadPlayers());
  }
  deletePlayer(p: Player) {
    this.confirmAndDelete(
      `Supprimer ${p.name} ${p.firstname} ?`,
      () => this.api.deletePlayer(p.id),
      () => this.reloadPlayers()
    );
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

  /* ----- Comités ----- */
  newComite() {
    this.openDialog(ComiteDialog, {}, () =>
      this.api.comites().subscribe((c) => this.comites.set(c))
    );
  }
  editComite(comite: Comite) {
    this.openDialog(ComiteDialog, { comite }, () =>
      this.api.comites().subscribe((c) => this.comites.set(c))
    );
  }
  deleteComite(c: Comite) {
    this.confirmAndDelete(
      `Supprimer le comité "${c.name}" ?`,
      () => this.api.deleteComite(c.id),
      () => this.api.comites().subscribe((cl) => this.comites.set(cl))
    );
  }

  /* ----- Ligues ----- */
  newLigue() {
    this.openDialog(LigueDialog, {}, () =>
      this.api.ligues().subscribe((l) => this.ligues.set(l))
    );
  }
  editLigue(ligue: Ligue) {
    this.openDialog(LigueDialog, { ligue }, () =>
      this.api.ligues().subscribe((l) => this.ligues.set(l))
    );
  }
  deleteLigue(l: Ligue) {
    this.confirmAndDelete(
      `Supprimer la ligue "${l.name}" ?`,
      () => this.api.deleteLigue(l.id),
      () => this.api.ligues().subscribe((li) => this.ligues.set(li))
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

  private confirmAndDelete(
    message: string,
    deleteFn: () => any,
    onDone: () => void
  ) {
    const data: ConfirmDialogData = {
      title: 'Confirmation',
      message,
      confirmLabel: 'Supprimer',
      danger: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
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
