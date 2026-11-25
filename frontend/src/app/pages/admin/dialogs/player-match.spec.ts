import { editDistance, matchPlayers, nameKey } from './player-match';

const players = [
  { id: 4, name: 'MARTIN', firstname: 'Élodie' },
  { id: 5, name: 'DUBOIS', firstname: 'Françoise' },
  { id: 6, name: 'MAZIMANN', firstname: 'Aurélien' },
  { id: 7, name: 'PETIT', firstname: 'Luc' },
];

describe('player-match — doublons signalés pendant la saisie', () => {
  it('normalise casse, accents, espaces, tirets, apostrophes, points', () => {
    expect(nameKey(' Du-Bois ')).toBe('DUBOIS');
    expect(nameKey("D'Artagnan")).toBe('DARTAGNAN');
    expect(nameKey('Élodie.')).toBe('ELODIE');
    expect(editDistance('MAZIMAN', 'MAZIMANN')).toBe(1);
  });

  it('même personne : toutes les variantes connues', () => {
    for (const [n, f] of [
      ['MARTIN', 'Élodie'], ['martin', 'ELODIE'], [' MARTIN ', 'Élodie '], ['Élodie', 'MARTIN'],
      ['DU BOIS', 'Françoise'], ['DUBOIS', 'Fran-çoise'], ['MARTIN', 'Elodie.'], ['MAZIMANN', 'AURELIEN'],
    ]) {
      const m = matchPlayers(n, f, players);
      expect(m.same?.id, `${n} ${f}`).toBeDefined();
    }
  });

  it('noms proches signalés, sans bloquer', () => {
    expect(matchPlayers('MARTIN', 'Élodi', players).similar.map((p) => p.id)).toEqual([4]);
    expect(matchPlayers('MAZIMAN', 'Aurélien', players).similar.map((p) => p.id)).toEqual([6]);
    expect(matchPlayers('MARTIN', 'Élodie-Anne', players).similar.map((p) => p.id)).toEqual([4]);
    expect(matchPlayers('MARTIN', 'Élodie-Anne', players).same).toBeNull();
  });

  it('joueurs sans rapport : rien à signaler', () => {
    for (const [n, f] of [['PETIT', 'Paul'], ['MARTINEZ', 'Jean'], ['DURAND', 'Élodie'], ['PETITJEAN', 'Marc']]) {
      const m = matchPlayers(n, f, players);
      expect(m.same, `${n} ${f}`).toBeNull();
      expect(m.similar, `${n} ${f}`).toEqual([]);
    }
  });

  it('modification de sa propre fiche : pas de doublon avec soi-même', () => {
    expect(matchPlayers('MARTIN', 'Élodie', players, 4).same).toBeNull();
  });

  it('saisie incomplète : rien tant que le nom n’est pas tapé', () => {
    expect(matchPlayers('M', '', players)).toEqual({ same: null, similar: [] });
  });
});
