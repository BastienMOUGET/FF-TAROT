import { drawSeats, Orientation } from './seat-draw';
import { Seat } from '../../core/api.types';

// Générateur pseudo-aléatoire reproductible (mulberry32).
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function decompose(n: number): { fours: number; threes: number } | null {
  if (n < 3) return null;
  const r = n % 4;
  const threes = r === 0 ? 0 : r === 1 ? 3 : r === 2 ? 2 : 1;
  const remaining = n - threes * 3;
  if (remaining < 0 || remaining % 4 !== 0) return null;
  return { fours: remaining / 4, threes };
}

// Nombre minimal de consignes impossibles, calculé indépendamment de
// l'algorithme : demandes au-delà des places disponibles.
function minimalUnmet(orients: Orientation[], plan: { fours: number; threes: number }): number {
  const cap: Record<Seat, number> = {
    N: plan.fours,
    S: plan.fours + plan.threes,
    E: plan.fours + plan.threes,
    O: plan.fours + plan.threes,
  };
  let unmet = 0;
  let freeNonNorth = 0;
  for (const s of ['N', 'S', 'E', 'O'] as Seat[]) {
    const asked = orients.filter((o) => o === s).length;
    unmet += Math.max(0, asked - cap[s]);
    if (s !== 'N') freeNonNorth += Math.max(0, cap[s] - asked);
  }
  const notNorth = orients.filter((o) => o === 'not_north').length;
  unmet += Math.max(0, notNorth - freeNonNorth);
  return unmet;
}

describe('drawSeats — tirage des places avec consignes', () => {
  it('cas du retour terrain : deux « Nord fixe » ne finissent plus à la même table', () => {
    // 8 joueurs = 2 tables de 4 ; deux demandent Nord. L'ancien tirage les
    // mettait à la même table une fois sur ~2,3 et l'un perdait le Nord.
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];
    const orient = (id: number): Orientation => (id === 1 || id === 2 ? 'N' : 'random');
    for (let seed = 1; seed <= 2000; seed++) {
      const d = drawSeats(ids, { fours: 2, threes: 0 }, orient, rng(seed));
      expect(d.unmet).toBe(0);
      const seatOf = new Map(d.tables.flat().map((s) => [s.id, s.seat]));
      expect(seatOf.get(1)).toBe('N');
      expect(seatOf.get(2)).toBe('N');
    }
  });

  it('un « Nord fixe » ne va jamais à une table de 3 (Nord = Relais) quand une table de 4 est libre', () => {
    const ids = Array.from({ length: 15 }, (_, i) => i + 1); // 3 de 4 + 1 de 3
    const orient = (id: number): Orientation => (id <= 3 ? 'N' : 'random');
    for (let seed = 1; seed <= 2000; seed++) {
      const d = drawSeats(ids, { fours: 3, threes: 1 }, orient, rng(seed));
      expect(d.unmet).toBe(0);
      for (const t of d.tables) {
        if (t.length === 3) expect(t.some((s) => s.id <= 3)).toBe(false);
      }
    }
  });

  it('respecte toutes les consignes réalisables, sur 20 000 tirages aléatoires', () => {
    const r = rng(42);
    const choices: Orientation[] = ['random', 'random', 'random', 'N', 'S', 'E', 'O', 'not_north'];
    for (let trial = 0; trial < 20000; trial++) {
      let n = 3 + Math.floor(r() * 50);
      let plan = decompose(n);
      while (!plan) plan = decompose(++n);
      const ids = Array.from({ length: n }, (_, i) => 100 + i);
      const o = new Map(ids.map((id) => [id, choices[Math.floor(r() * choices.length)]]));
      const d = drawSeats(ids, plan, (id) => o.get(id)!, rng(trial));

      // Forme : bon nombre de tables, chacun placé une seule fois.
      expect(d.tables.length).toBe(plan.fours + plan.threes);
      const all = d.tables.flat();
      expect(all.length).toBe(n);
      expect(new Set(all.map((s) => s.id)).size).toBe(n);
      d.tables.forEach((t, i) => {
        const seats = t.map((s) => s.seat).sort().join('');
        expect(seats).toBe(i < plan!.fours ? 'ENOS' : 'EOS');
      });

      // Consignes : manquées uniquement si c'est impossible.
      expect(d.unmet).toBe(minimalUnmet(ids.map((id) => o.get(id)!), plan));
      let missed = 0;
      for (const s of all) {
        const want = o.get(s.id)!;
        if (want === 'random') continue;
        if (want === 'not_north' ? s.seat === 'N' : s.seat !== want) missed++;
      }
      expect(missed).toBe(d.unmet);
      expect(d.reasons.length > 0).toBe(d.unmet > 0);
    }
  });

  it('explique une impossibilité : 3 « Nord fixe » pour 2 tables de 4', () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1); // 2 de 4 + 1 de 3
    const d = drawSeats(ids, { fours: 2, threes: 1 }, (id) => (id <= 3 ? 'N' : 'random'), rng(7));
    expect(d.unmet).toBe(1);
    expect(d.reasons[0]).toContain('3 joueurs demandent Nord fixe pour 2 place(s) Nord');
    expect(d.reasons[0]).toContain('Relais');
  });

  it('reste un vrai tirage au sort : les tables changent d’un tirage à l’autre', () => {
    const ids = Array.from({ length: 16 }, (_, i) => i + 1);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const d = drawSeats(ids, { fours: 4, threes: 0 }, () => 'random', rng(seed));
      seen.add(JSON.stringify(d.tables.map((t) => t.map((s) => s.id).sort((a, b) => a - b)).sort()));
    }
    expect(seen.size).toBeGreaterThan(45);
  });
});
