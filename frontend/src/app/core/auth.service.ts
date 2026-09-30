import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { LoginResponse, User } from './api.types';

const STORAGE_KEY = 'fft.auth';

interface StoredAuth {
  token: string;
  user: User;
  // Dernier signe de vie, en millisecondes. Voir IDLE_MS.
  seen?: number;
}

// Au-delà de ce délai sans activité, la session est jetée et le mot de passe
// redemandé. Quatre heures : une soirée de tournoi est une suite ininterrompue
// de saisies, personne n'est donc déconnecté en cours de route, mais d'une
// soirée à l'autre la question est toujours posée.
const IDLE_MS = 4 * 60 * 60 * 1000;

// La session vit dans sessionStorage et non localStorage : fermer l'onglet
// déconnecte (retour terrain n°14).
//
// Cela ne suffisait pas. Le raccourci du bureau est une simple URL vers
// localhost:3000, et Chrome comme Edge restaurent le sessionStorage avec les
// onglets qu'ils rouvrent : le programme se retrouvait déjà connecté au
// lancement suivant, alors que le club demandait l'inverse (retour terrain
// n°15). D'où le délai d'inactivité ci-dessus, qui ne dépend d'aucun
// comportement de navigateur.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private state = signal<StoredAuth | null>(this.readStorage());

  readonly user = computed(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  async login(username: string, password: string): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(
        `${environment.apiUrl}/auth/login`,
        { username, password }
      )
    );
    const stored: StoredAuth = {
      token: res.token,
      user: res.user,
      seen: Date.now(),
    };
    this.state.set(stored);
    this.writeStorage(stored);
    return res.user;
  }

  logout(): void {
    this.state.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  // Appelé à chaque requête à l'API : tant que le programme sert, la session
  // reste ouverte.
  touch(): void {
    const s = this.state();
    if (!s) return;
    const now = Date.now();
    // On n'écrit pas à chaque appel : une fois par minute suffit largement.
    if (s.seen && now - s.seen < 60_000) return;
    const next = { ...s, seen: now };
    this.state.set(next);
    this.writeStorage(next);
  }

  private readStorage(): StoredAuth | null {
    try {
      // Jusqu'à la v3.0.32 la session vivait dans localStorage. Plus rien ne
      // la lit, mais un jeton y dormirait indéfiniment : on fait le ménage.
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Stockage refusé : rien à nettoyer.
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredAuth;
      // Une session restaurée par le navigateur mais vieille d'une soirée ne
      // vaut plus : on repasse par le mot de passe.
      if (!parsed.seen || Date.now() - parsed.seen > IDLE_MS) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private writeStorage(value: StoredAuth): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Navigation privée ou stockage refusé : la session reste en mémoire.
    }
  }
}
