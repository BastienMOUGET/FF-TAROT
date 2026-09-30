import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { Club } from '../core/api.types';
import { environment } from '../../environments/environment';
import { RoundTimer } from './round-timer';

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    RoundTimer,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav mode="side" opened class="sidenav">
        <div class="brand">
          <mat-icon>casino</mat-icon>
          <div class="brand-text">
            <span class="brand-name">PABB90</span>
            <span class="brand-version">v{{ version }}</span>
          </div>
        </div>
        @if (club(); as c) {
          <!-- Club par défaut (Administration → Paramètres) : le nom du club
               en tête du bandeau, avec son logo s'il en a un. -->
          <a class="club-head" routerLink="/tournaments" [title]="c.name">
            <span class="club-head-name">{{ c.name }}</span>
          </a>
        }
        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/tournaments"
            routerLinkActive="active"
          >
            <mat-icon matListItemIcon>emoji_events</mat-icon>
            <span matListItemTitle>Challenges</span>
          </a>
          <!-- Visible par tous : un utilisateur y consulte les joueurs, les
               clubs et les paramètres, sans rien pouvoir y changer. -->
          <a mat-list-item routerLink="/admin" routerLinkActive="active">
            <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
            <span matListItemTitle>Administration</span>
          </a>
          <a mat-list-item routerLink="/aide" routerLinkActive="active">
            <mat-icon matListItemIcon>help_outline</mat-icon>
            <span matListItemTitle>Notice</span>
          </a>
          <!-- Les remarques et anomalies vont sur les tickets du projet. -->
          <a mat-list-item [href]="issuesUrl" target="_blank" rel="noopener">
            <mat-icon matListItemIcon>bug_report</mat-icon>
            <span matListItemTitle>Signaler un problème</span>
          </a>
        </mat-nav-list>
        <app-round-timer />
        <!-- Logo du club par défaut, en bas du bandeau (retour terrain n°7). -->
        @if (club()?.logo; as logo) {
          <div class="club-foot">
            <img [src]="logo" [alt]="club()?.name || 'logo du club'" class="club-foot-logo" />
          </div>
        }
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar color="primary" class="topbar">
          <span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="userMenu">
            <mat-icon>account_circle</mat-icon>
            {{ auth.user()?.username }}
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item disabled>
              <mat-icon>person</mat-icon>
              <span>{{ auth.user()?.full_name || auth.user()?.username }}</span>
            </button>
            <button mat-menu-item disabled>
              <mat-icon>verified_user</mat-icon>
              <span>Rôle : {{ auth.user()?.role }}</span>
            </button>
            <button mat-menu-item (click)="auth.logout()">
              <mat-icon>logout</mat-icon>
              <span>Déconnexion</span>
            </button>
          </mat-menu>
        </mat-toolbar>
        <main class="content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container { height: 100vh; }
    .sidenav {
      width: 240px;
      background: #f5f5f5;
      border-right: 1px solid #e0e0e0;
    }
    /* Colonne : marque, nav, minuterie, puis le logo poussé en bas. */
    .sidenav ::ng-deep .mat-drawer-inner-container { display: flex; flex-direction: column; }
    .club-foot {
      margin-top: auto; padding: 12px 16px 16px; text-align: center;
    }
    .club-foot-logo { max-width: 100%; max-height: 190px; object-fit: contain; border-radius: 6px; }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px;
      color: #1976d2;
      border-bottom: 1px solid #e0e0e0;
    }
    .brand mat-icon { color: #1976d2; }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-weight: 600; font-size: 1.1em; line-height: 1; }
    .brand-version { font-size: 0.75em; color: #757575; line-height: 1.4; }
    .club-head {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      margin: 12px 12px 4px; padding: 10px 12px; border-radius: 8px;
      background: #1976d2; color: #fff; text-decoration: none;
      font-weight: 600; line-height: 1.2; text-align: center;
    }
    .club-head-name { flex: 0 1 auto; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .spacer { flex: 1 1 auto; }
    .content {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    a.active {
      background: rgba(25, 118, 210, 0.1);
      color: #1976d2;
    }
    a.active mat-icon { color: #1976d2; }
  `,
})
export class MainLayout implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  protected version = environment.appVersion;
  protected issuesUrl = 'https://github.com/BastienMOUGET/FF-TAROT/issues/new';
  club = signal<Club | null>(null);

  ngOnInit(): void {
    this.api.settings().subscribe({
      next: (s) => {
        const id = Number(s.default_club_id);
        if (id > 0) this.api.club(id).subscribe({ next: (c) => this.club.set(c), error: () => this.club.set(null) });
      },
      error: () => this.club.set(null),
    });
  }
}
