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
}

// La session vit dans sessionStorage et non localStorage : fermer le
// programme (ou l'onglet) déconnecte, et le mot de passe est redemandé au
// lancement suivant. Avant, la session survivait des heures et l'utilisateur
// ne butait dessus qu'au moment d'enregistrer (retour terrain n°14).
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
    const stored: StoredAuth = { token: res.token, user: res.user };
    this.state.set(stored);
    this.writeStorage(stored);
    return res.user;
  }

  logout(): void {
    this.state.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  private readStorage(): StoredAuth | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredAuth) : null;
    } catch {
      return null;
    }
  }

  private writeStorage(value: StoredAuth): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}
