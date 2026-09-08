import { Component, OnDestroy, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// Minuterie de manche (retour terrain n°4) : le club joue chaque manche en
// temps limité (50 min par défaut) et sonne la fin. Vit dans le bandeau
// latéral, donc survit à la navigation. La durée choisie est mémorisée dans
// le navigateur. Le bip est synthétisé (Web Audio), pas de fichier son.
const KEY = 'pabb90.timer.minutes';

@Component({
  selector: 'app-round-timer',
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="timer" [class.running]="running()" [class.finished]="finished()">
      <div class="title">
        <mat-icon>timer</mat-icon>
        <span>Minuterie de manche</span>
      </div>
      <div class="display">{{ display() }}</div>
      @if (finished()) {
        <div class="end">Fin de la manche !</div>
      }
      <div class="controls">
        @if (!running()) {
          <button mat-flat-button color="primary" (click)="start()" [disabled]="remaining() === 0 && !finished()">
            <mat-icon>play_arrow</mat-icon> {{ remaining() < total() && remaining() > 0 ? 'Reprendre' : 'Démarrer' }}
          </button>
        } @else {
          <button mat-stroked-button (click)="pause()">
            <mat-icon>pause</mat-icon> Pause
          </button>
        }
        <button mat-icon-button (click)="reset()" title="Remettre à zéro">
          <mat-icon>replay</mat-icon>
        </button>
      </div>
      <label class="minutes">
        Durée
        <input
          type="number"
          min="1"
          max="180"
          [value]="minutes()"
          [disabled]="running()"
          (change)="setMinutes($any($event.target).value)"
        />
        min
      </label>
    </div>
  `,
  styles: `
    .timer {
      margin: 8px 12px; padding: 10px 12px; border-radius: 8px;
      background: #fff; border: 1px solid #e0e0e0;
    }
    .timer.running { border-color: #1976d2; }
    .timer.finished { background: #fff3e0; border-color: #ef6c00; animation: blink 1s step-start infinite; }
    @keyframes blink { 50% { background: #ffe0b2; } }
    .title { display: flex; align-items: center; gap: 6px; font-size: 0.85em; color: #616161; }
    .display { font-size: 2em; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; margin: 4px 0; }
    .end { text-align: center; color: #e65100; font-weight: 700; margin-bottom: 4px; }
    .controls { display: flex; align-items: center; justify-content: center; gap: 4px; }
    .minutes { display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 0.85em; color: #616161; margin-top: 6px; }
    .minutes input { width: 52px; text-align: center; }
  `,
})
export class RoundTimer implements OnDestroy {
  minutes = signal(this.loadMinutes());
  total = computed(() => this.minutes() * 60);
  remaining = signal(this.loadMinutes() * 60);
  running = signal(false);
  finished = signal(false);
  private handle: ReturnType<typeof setInterval> | null = null;
  private endAt = 0;

  display = computed(() => {
    const s = Math.max(0, this.remaining());
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  });

  private loadMinutes(): number {
    try {
      const v = Number(localStorage.getItem(KEY));
      return v > 0 && v <= 180 ? v : 50;
    } catch {
      return 50;
    }
  }

  setMinutes(v: string): void {
    const n = Math.max(1, Math.min(180, Number(v) || 50));
    this.minutes.set(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      /* stockage indisponible : la valeur reste pour la session */
    }
    if (!this.running()) {
      this.remaining.set(n * 60);
      this.finished.set(false);
    }
  }

  start(): void {
    if (this.finished() || this.remaining() <= 0) this.remaining.set(this.total());
    this.finished.set(false);
    // Un « geste » utilisateur est nécessaire pour autoriser l'audio :
    // on prépare le contexte au clic Démarrer.
    this.audio();
    this.endAt = Date.now() + this.remaining() * 1000;
    this.running.set(true);
    this.handle = setInterval(() => this.tick(), 250);
  }

  pause(): void {
    this.running.set(false);
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  reset(): void {
    this.pause();
    this.finished.set(false);
    this.remaining.set(this.total());
  }

  private tick(): void {
    const left = Math.ceil((this.endAt - Date.now()) / 1000);
    if (left <= 0) {
      this.remaining.set(0);
      this.pause();
      this.finished.set(true);
      this.ring();
      return;
    }
    this.remaining.set(left);
  }

  private ctx: AudioContext | null = null;
  private audio(): AudioContext | null {
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  // 3 séries de 3 bips : audible dans une salle de jeu.
  private ring(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let serie = 0; serie < 3; serie++) {
      for (let i = 0; i < 3; i++) {
        const t = t0 + serie * 1.5 + i * 0.35;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    }
  }

  ngOnDestroy(): void {
    this.pause();
  }
}
