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

  connect(): void {
    if (this.socket) return;
    // socketUrl vide -> même origine que la page (prod quand le back
    // sert le front, dev quand /socket.io est proxifié).
    const opts = {
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    };
    this.socket = environment.socketUrl
      ? io(environment.socketUrl, opts)
      : io(opts);
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
