// Titre court d'une colonne de tournoi dans le classement du Challenge.
// Un Challenge compte jusqu'à 15 tournois, nommés en général par leur date
// (« Tournoi du 02/09/2026 », « Tournoi du 25 novembre ») : écrit en entier,
// le nom imposait sa largeur à la colonne et le tableau débordait. On garde
// le jour et le mois (« 02/09 ») ; le nom complet reste en info-bulle. Un nom
// sans date est conservé tel quel (il passe alors à la ligne).

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

export function shortTournamentLabel(label: string): string {
  const s = (label ?? '').trim();
  // 02/09/2026, 2/9, 25.11.26, 25-11
  const num = s.match(/(?:^|\D)(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-]\d{2,4})?(?!\d)/);
  if (num) {
    const d = Number(num[1]);
    const m = Number(num[2]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return `${pad(d)}/${pad(m)}`;
  }
  // 25 novembre, 1er déc., 3 sept 2026
  const plain = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const txt = plain.match(/(?:^|\D)(\d{1,2})(?:er)?\s+([a-z]+)/);
  if (txt && MONTHS[txt[2]] !== undefined) {
    const d = Number(txt[1]);
    if (d >= 1 && d <= 31) return `${pad(d)}/${pad(MONTHS[txt[2]])}`;
  }
  return s;
}
