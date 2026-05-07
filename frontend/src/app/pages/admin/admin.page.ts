import { Component, OnInit, inject, signal } from '@angular/core';

import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../core/api.service';
import {
  Club,
  Comite,
  Ligue,
  PenaltyType,
  Player,
  User,
} from '../../core/api.types';

@Component({
  selector: 'app-admin-page',
  imports: [
    MatTabsModule,
    MatTableModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
  ],
  template: `
    <h1>Administration</h1>
    <p class="note">
      <mat-icon>info</mat-icon>
      Vue de lecture seule pour l'instant. La gestion complète (CRUD) du
      référentiel est exposée par l'API
      (<code>/ligues</code>, <code>/comites</code>, <code>/clubs</code>,
      <code>/players</code>, <code>/penalty-types</code>, <code>/users</code>).
      Front complet à venir en V2.1.
    </p>

    <mat-tab-group>
      <mat-tab label="Joueurs">
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
          <tr mat-header-row *matHeaderRowDef="['licence', 'name', 'club']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['licence', 'name', 'club']"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Clubs">
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
          <tr mat-header-row *matHeaderRowDef="['code', 'name', 'comite']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name', 'comite']"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Comités">
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
          <tr mat-header-row *matHeaderRowDef="['code', 'name', 'ligue']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name', 'ligue']"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Ligues">
        <table mat-table [dataSource]="ligues()" class="mat-elevation-z2">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Code</th>
            <td mat-cell *matCellDef="let l">{{ l.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nom</th>
            <td mat-cell *matCellDef="let l">{{ l.name }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'name']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'name']"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Pénalités (types)">
        <table
          mat-table
          [dataSource]="penaltyTypes()"
          class="mat-elevation-z2"
        >
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
            <td mat-cell *matCellDef="let p" class="num">
              {{ p.default_points }}
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="['code', 'label', 'points']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['code', 'label', 'points']"></tr>
        </table>
      </mat-tab>

      <mat-tab label="Utilisateurs">
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
          <tr mat-header-row *matHeaderRowDef="['username', 'role', 'full_name']"></tr>
          <tr mat-row *matRowDef="let row; columns: ['username', 'role', 'full_name']"></tr>
        </table>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    h1 { margin-bottom: 8px; }
    .note {
      display: flex; align-items: center; gap: 8px;
      background: #fff3cd; border: 1px solid #ffe082;
      border-radius: 4px; padding: 12px; margin-bottom: 24px;
    }
    table { width: 100%; }
    .num { text-align: right; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
  `,
})
export class AdminPage implements OnInit {
  private api = inject(ApiService);

  ligues = signal<Ligue[]>([]);
  comites = signal<Comite[]>([]);
  clubs = signal<Club[]>([]);
  players = signal<Player[]>([]);
  penaltyTypes = signal<PenaltyType[]>([]);
  users = signal<User[]>([]);

  ngOnInit(): void {
    this.api.ligues().subscribe((d) => this.ligues.set(d));
    this.api.comites().subscribe((d) => this.comites.set(d));
    this.api.clubs().subscribe((d) => this.clubs.set(d));
    this.api.players().subscribe((d) => this.players.set(d));
    this.api.penaltyTypes().subscribe((d) => this.penaltyTypes.set(d));
    this.api.users().subscribe((d) => this.users.set(d));
  }
}
