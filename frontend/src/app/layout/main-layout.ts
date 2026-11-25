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
    /* Écran seulement : laisse voir le fond bleuté de la page. L'impression
       garde le fond d'origine du conteneur. */
    @media screen { .container { background: transparent; } }
    .sidenav {
      width: 240px;
      background: #fbfcfe;
      border-right: 1px solid rgba(15, 40, 80, 0.08);
      border-radius: 0;
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
      padding: 18px 16px;
      color: #10203f;
      border-bottom: 1px solid rgba(15, 40, 80, 0.08);
    }
    /* Pastille de marque : dégradé bleu, icône blanche. */
    .brand mat-icon {
      width: 40px; height: 40px; font-size: 24px; line-height: 40px;
      text-align: center; flex: 0 0 auto;
      color: #fff;
      border-radius: 12px;
      background: linear-gradient(135deg, #2b8af0 0%, #1565c0 55%, #0d47a1 100%);
      box-shadow: 0 4px 12px -4px rgba(21, 101, 192, 0.6);
    }
    .brand-text { display: flex; flex-direction: column; }
    .brand-name { font-weight: 700; font-size: 1.15em; line-height: 1; letter-spacing: 0.02em; }
    .brand-version { font-size: 0.75em; color: #7a8499; line-height: 1.5; }
    .club-head {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      margin: 14px 12px 6px; padding: 10px 12px; border-radius: 12px;
      background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
      color: #fff; text-decoration: none;
      font-weight: 600; line-height: 1.2; text-align: center;
      box-shadow: 0 6px 16px -8px rgba(21, 101, 192, 0.7);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .club-head:hover { transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(21, 101, 192, 0.8); }
    .club-head-name { flex: 0 1 auto; }
    /* Menu : éléments en pastille, l'actif sur fond bleu pâle. */
    /* Pastille décollée de 6 px des bords. Pas de retrait supplémentaire :
       les marges d'icône de Material suffisent, et « Signaler un problème »
       garde la place de s'afficher en entier (vérifié par mesure). */
    .sidenav a.mat-mdc-list-item {
      border-radius: 12px;
      margin: 0 6px;
      width: auto;
      padding-left: 0;
      padding-right: 0;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(242, 245, 250, 0.82);
      backdrop-filter: saturate(180%) blur(10px);
      border-bottom: 1px solid rgba(15, 40, 80, 0.06);
    }
    .spacer { flex: 1 1 auto; }
    .content {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    a.active {
      background: rgba(25, 118, 210, 0.1);
      color: #1565c0;
      font-weight: 600;
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
