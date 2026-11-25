import { shortTournamentLabel } from './challenge-labels';

describe('shortTournamentLabel — titres courts des colonnes du Challenge', () => {
  it('dates chiffrées', () => {
    expect(shortTournamentLabel('Tournoi du 02/09/2026')).toBe('02/09');
    expect(shortTournamentLabel('Tournoi du 2/9')).toBe('02/09');
    expect(shortTournamentLabel('Soirée 25.11.26')).toBe('25/11');
    expect(shortTournamentLabel('25-11-2026')).toBe('25/11');
  });
  it('dates en toutes lettres', () => {
    expect(shortTournamentLabel('Tournoi du 25 novembre')).toBe('25/11');
    expect(shortTournamentLabel('Tournoi du 1er décembre')).toBe('01/12');
    expect(shortTournamentLabel('3 sept 2026')).toBe('03/09');
    expect(shortTournamentLabel('Tournoi du 14 Février')).toBe('14/02');
  });
  it('noms sans date conservés', () => {
    expect(shortTournamentLabel('Tournoi 3')).toBe('Tournoi 3');
    expect(shortTournamentLabel('Open de Noël')).toBe('Open de Noël');
    expect(shortTournamentLabel('Soirée 12 joueurs')).toBe('Soirée 12 joueurs');
  });
  it('pas de fausse date', () => {
    expect(shortTournamentLabel('Tournoi 45/13')).toBe('Tournoi 45/13');
  });
});
