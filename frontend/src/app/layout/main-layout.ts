import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';

import { AuthService } from '../core/auth.service';
import { environment } from '../../environments/environment';

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
        <mat-nav-list>
          <a
            mat-list-item
            routerLink="/tournaments"
            routerLinkActive="active"
          >
            <mat-icon matListItemIcon>emoji_events</mat-icon>
            <span matListItemTitle>Challenges</span>
          </a>
          @if (auth.isAdmin()) {
            <a mat-list-item routerLink="/admin" routerLinkActive="active">
              <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
              <span matListItemTitle>Administration</span>
            </a>
          }
        </mat-nav-list>
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
export class MainLayout {
  protected auth = inject(AuthService);
  protected version = environment.appVersion;
}
