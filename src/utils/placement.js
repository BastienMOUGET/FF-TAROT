// Placement utilities for FFT Libre par 4.
//
// Round 1: each team is assigned to a random table (one team per table),
// and the 4 players of the team are seated N/S/E/O in their team_player order.
//
// Rounds N+1: apply offsets per seat (N/S/E/O) on the table number, with
// wrap-around modulo nb_table. Default offsets: N=0, S=+1, E=+2, O=-1.

const SEATS = ['N', 'S', 'E', 'O'];

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Wrap a 1-based table number after applying an offset in a ring of nbTables.
function wrapTable(currentTable, offset, nbTables) {
  if (nbTables <= 0) return currentTable;
  // ((current - 1 + offset) mod nbTables + nbTables) mod nbTables + 1
  const idx = ((currentTable - 1 + offset) % nbTables + nbTables) % nbTables;
  return idx + 1;
}

// Build seat rows for round 1 from a list of teams with their players.
// teams: [{ id, players: [{player_id, player_number}, ...4 sorted asc] }, ...]
// Returns: [{ table_number, seat, player_id, team_id }]
function generateInitialSeats(teams) {
  const tableNumbers = shuffle(teams.map((_, i) => i + 1));
  const seats = [];
  teams.forEach((team, i) => {
    const tableNumber = tableNumbers[i];
    // sort players by player_number 1..4, assign N, S, E, O
    const ordered = [...team.players].sort(
      (a, b) => a.player_number - b.player_number
    );
    ordered.forEach((p, idx) => {
      seats.push({
        table_number: tableNumber,
        seat: SEATS[idx],
        player_id: p.player_id,
        team_id: team.id,
      });
    });
  });
  return seats;
}

// Build seat rows for the next round from previous round's seats + offsets.
// prevSeats: [{ table_number, seat, player_id, team_id }]
// offsets: { offset_n, offset_s, offset_e, offset_o }
// Returns: same shape as prevSeats but with new table_number.
function generateNextSeats(prevSeats, offsets) {
  if (prevSeats.length === 0) return [];

  const nbTables = Math.max(...prevSeats.map((s) => s.table_number));
  const offsetMap = {
    N: offsets.offset_n,
    S: offsets.offset_s,
    E: offsets.offset_e,
    O: offsets.offset_o,
  };

  return prevSeats.map((s) => ({
    table_number: wrapTable(s.table_number, offsetMap[s.seat], nbTables),
    seat: s.seat,
    player_id: s.player_id,
    team_id: s.team_id,
  }));
}

module.exports = {
  SEATS,
  wrapTable,
  generateInitialSeats,
  generateNextSeats,
};
