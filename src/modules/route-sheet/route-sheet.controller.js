const service = require('./route-sheet.service');

async function get(req, res) {
  res.json(await service.getForSubTournament(req.params.subTournamentId));
}

module.exports = { get };
