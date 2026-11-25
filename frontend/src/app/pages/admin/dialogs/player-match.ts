// Rapprochement de noms de joueurs, pour signaler un doublon PENDANT la
// saisie (le serveur refuse de toute façon un doublon exact).

export interface NamedPlayer {
  id: number;
  name: string;
  firstname: string;
}

export interface PlayerMatches<T extends NamedPlayer> {
  // Même personne : nom et prénom identiques une fois ignorés casse,
  // accents, espaces, tirets, apostrophes et points — ou inversés.
  same: T | null;
  // Noms proches (faute de frappe, prénom composé…) : à confirmer.
  similar: T[];
}

// Clé de comparaison : « Du-Bois » et « DUBOIS » donnent « DUBOIS ».
export function nameKey(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// Distance d'édition (insertions, suppressions, substitutions).
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

// Deux clés « proches » : au plus 1 écart sous 6 lettres, 2 au-delà, ou
// l'une prolonge l'autre (« ELODIE » / « ELODIEANNE »).
function close(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  const max = Math.min(a.length, b.length) < 6 ? 1 : 2;
  return editDistance(a, b) <= max;
}

export function matchPlayers<T extends NamedPlayer>(
  name: string,
  firstname: string,
  players: T[],
  exceptId?: number
): PlayerMatches<T> {
  const n = nameKey(name);
  const f = nameKey(firstname);
  if (n.length < 2 || f.length < 1) return { same: null, similar: [] };
  let same: T | null = null;
  const similar: T[] = [];
  for (const p of players) {
    if (p.id === exceptId) continue;
    const pn = nameKey(p.name);
    const pf = nameKey(p.firstname);
    if ((pn === n && pf === f) || (pn === f && pf === n)) {
      same = same ?? p;
      continue;
    }
    if ((close(pn, n) && close(pf, f)) || (close(pn, f) && close(pf, n))) similar.push(p);
  }
  return { same, similar: similar.slice(0, 5) };
}
