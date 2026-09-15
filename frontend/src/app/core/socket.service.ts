import { Injectable, OnDestroy, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import { environment } from '../../environments/environment';
import { RankingEntry } from './api.types';

export interface RankingUpdateEvent {
  sub_tournament_id: number;
  ranking: RankingEntry[];
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;
  readonly connected = signal(false);
  readonly lastRanking = signal<RankingUpdateEvent | null>(null);

  // Adresse du serveur de classement live. Il écoute sur son propre port
  // (3001 par défaut), pas sur celui qui sert la page : sans cette
  // dérivation, socket.io interroge le port 3000 et reste « Déconnecté ».
  // En développement (port 4200), proxy.conf.json s'en charge : on garde
  // l'origine de la page.
  private resolveUrl(): string | null {
    if (environment.socketUrl) return environment.socketUrl;
    if (typeof location === 'undefined') return null;
    if (location.port === environment.devPort) return null;
    return `${location.protocol}//${location.hostname}:${environment.socketPort}`;
  }

  connect(): void {
    if (this.socket) return;
    const opts = {
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    };
    const url = this.resolveUrl();
    this.socket = url ? io(url, opts) : io(opts);
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
    this.socket.on('ranking:update', (data: RankingUpdateEvent) => {
      this.lastRanking.set(data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
