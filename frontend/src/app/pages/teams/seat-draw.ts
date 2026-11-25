import { Seat } from '../../core/api.types';

// Consigne de position d'un joueur au tirage au sort.
// 'random' = position aléatoire (par défaut), N/S/E/O = siège fixe,
// 'not_north' = n'importe quel siège sauf Nord (Nord tient la feuille).
export type Orientation = 'random' | Seat | 'not_north';

export interface DrawnSeat {
  id: number;
  seat: Seat;
}

export interface SeatDraw {
  // Une entrée par table : d'abord les tables de 4, puis les tables de 3
  // (dont le Nord est tenu par un Relais, posé par le serveur).
  tables: DrawnSeat[][];
  // Nombre de consignes qui n'ont pas pu être respectées.
  unmet: number;
  // Explication lisible de chaque impossibilité (vide si tout est respecté).
  reasons: string[];
}

const SEAT_LABEL: Record<Seat, string> = { N: 'Nord', S: 'Sud', E: 'Est', O: 'Ouest' };

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Tire au sort les tables ET les places en respectant au mieux les
// consignes de position.
//
// Les places de TOUTES les tables sont considérées ensemble (et non table
// par table après un découpage au hasard, ce qui faisait tomber deux
// « Nord fixe » à la même table alors qu'un Nord restait libre ailleurs).
// Ordre d'attribution, chaque fois sur des places mélangées :
//   1. sièges fixes (N, S, E, O) sur une place de ce siège ;
//   2. « Non Nord » sur une place Sud, Est ou Ouest ;
//   3. les autres joueurs sur les places restantes.
// Cet ordre respecte le maximum de consignes possible : une consigne n'est
// manquée que s'il y a plus de demandes que de places (ex. 6 « Nord fixe »
// pour 5 tables de 4 — le Nord d'une table de 3 est le Relais).
export function drawSeats(
  ids: number[],
  plan: { fours: number; threes: number },
  orientationOf: (id: number) => Orientation,
  rng: () => number = Math.random
): SeatDraw {
  type Slot = { table: number; seat: Seat };
  const slots: Slot[] = [];
  for (let t = 0; t < plan.fours; t++) {
    for (const seat of ['N', 'S', 'E', 'O'] as Seat[]) slots.push({ table: t, seat });
  }
  for (let k = 0; k < plan.threes; k++) {
    for (const seat of ['S', 'E', 'O'] as Seat[]) slots.push({ table: plan.fours + k, seat });
  }
  if (slots.length !== ids.length) {
    throw new Error(`drawSeats : ${ids.length} joueurs pour ${slots.length} places`);
  }

  const free = shuffle(slots, rng);
  const taken = new Set<Slot>();
  const placed = new Map<number, Slot>();
  const take = (id: number, ok: (s: Slot) => boolean): boolean => {
    const s = free.find((x) => !taken.has(x) && ok(x));
    if (!s) return false;
    taken.add(s);
    placed.set(id, s);
    return true;
  };

  const players = shuffle(ids, rng);
  const missedFixed: Record<Seat, number> = { N: 0, S: 0, E: 0, O: 0 };
  let missedNotNorth = 0;

  // 1. Sièges fixes.
  for (const id of players) {
    const o = orientationOf(id);
    if (o === 'N' || o === 'S' || o === 'E' || o === 'O') {
      if (!take(id, (s) => s.seat === o)) missedFixed[o]++;
    }
  }
  // 2. Non Nord.
  for (const id of players) {
    if (placed.has(id) || orientationOf(id) !== 'not_north') continue;
    if (!take(id, (s) => s.seat !== 'N')) missedNotNorth++;
  }
  // 3. Tous les autres (et les consignes impossibles) sur ce qui reste.
  for (const id of players) {
    if (!placed.has(id)) take(id, () => true);
  }

  const tables: DrawnSeat[][] = Array.from({ length: plan.fours + plan.threes }, () => []);
  for (const [id, s] of placed) tables[s.table].push({ id, seat: s.seat });

  const reasons: string[] = [];
  const capacity: Record<Seat, number> = {
    N: plan.fours,
    S: plan.fours + plan.threes,
    E: plan.fours + plan.threes,
    O: plan.fours + plan.threes,
  };
  for (const seat of ['N', 'S', 'E', 'O'] as Seat[]) {
    if (missedFixed[seat] > 0) {
      const asked = ids.filter((id) => orientationOf(id) === seat).length;
      reasons.push(
        `${asked} joueurs demandent ${SEAT_LABEL[seat]} fixe pour ${capacity[seat]} place(s) ${SEAT_LABEL[seat]}` +
          (seat === 'N' && plan.threes > 0 ? ' (aux tables de 3, le Nord est le Relais)' : '')
      );
    }
  }
  if (missedNotNorth > 0) {
    reasons.push(
      `trop de « Non Nord » : il ne reste pas assez de places Sud, Est ou Ouest`
    );
  }
  const unmet = missedNotNorth + missedFixed.N + missedFixed.S + missedFixed.E + missedFixed.O;
  return { tables, unmet, reasons };
}
