const service = require('./ranking.service');

async function get(req, res) {
  res.json(await service.getRanking(req.params.subTournamentId));
}

async function recompute(req, res) {
  res.json(await service.compute(req.params.subTournamentId));
}

module.exports = { get, recompute };
