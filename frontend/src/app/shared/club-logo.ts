import { Component, Input, OnChanges, inject, signal } from '@angular/core';

import { ApiService } from '../core/api.service';

// Miniature du logo du club, pour l'en-tête des classements imprimés.
// Ne rend rien si le club n'a pas de logo : l'application sert aussi à
// d'autres clubs. Se résout depuis un club, un challenge (tournament) ou
// un tournoi (sub_tournament).
@Component({
  selector: 'app-club-logo',
  template: `
    @if (src(); as s) {
      <img class="club-logo" [src]="s" [alt]="name() || 'logo du club'" [style.max-height.px]="size" />
    }
  `,
  styles: `
    :host { display: inline-block; }
    .club-logo { display: block; max-width: 160px; object-fit: contain; }
    @media print { .club-logo { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  `,
})
export class ClubLogo implements OnChanges {
  private api = inject(ApiService);

  @Input() clubId: number | null | undefined;
  @Input() tournamentId: number | null | undefined;
  @Input() subTournamentId: number | null | undefined;
  @Input() size = 56;

  src = signal<string | null>(null);
  name = signal<string | null>(null);

  ngOnChanges(): void {
    if (this.clubId) this.loadClub(this.clubId);
    else if (this.tournamentId) this.loadTournament(this.tournamentId);
    else if (this.subTournamentId) {
      this.api.subTournament(this.subTournamentId).subscribe({
        next: (s) => this.loadTournament(s.tournament_id),
        error: () => this.src.set(null),
      });
    } else this.src.set(null);
  }

  private loadTournament(id: number): void {
    this.api.tournament(id).subscribe({
      next: (t) => (t.club_id ? this.loadClub(t.club_id) : this.src.set(null)),
      error: () => this.src.set(null),
    });
  }

  private loadClub(id: number): void {
    this.api.club(id).subscribe({
      next: (c) => {
        this.src.set(c.logo || null);
        this.name.set(c.name);
      },
      error: () => this.src.set(null),
    });
  }
}
