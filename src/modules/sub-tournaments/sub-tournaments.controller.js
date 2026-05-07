const service = require('./sub-tournaments.service');

async function listByTournament(req, res) {
  const tournamentId = req.params.tournamentId || req.params.id;
  res.json(await service.listByTournament(tournamentId));
}

async function getById(req, res) {
  res.json(await service.getById(req.params.id));
}

async function create(req, res) {
  const tournamentId = req.params.tournamentId || req.body.tournament_id;
  res.status(201).json(await service.create(tournamentId, req.body));
}

async function update(req, res) {
  res.json(await service.update(req.params.id, req.body));
}

async function remove(req, res) {
  await service.remove(req.params.id);
  res.status(204).end();
}

module.exports = { listByTournament, getById, create, update, remove };
