const service = require('./teams.service');

async function listBySubTournament(req, res) {
  const subTournamentId = req.params.subTournamentId || req.params.id;
  res.json(await service.listBySubTournament(subTournamentId));
}

async function getById(req, res) {
  res.json(await service.getById(req.params.id));
}

async function create(req, res) {
  const subTournamentId =
    req.params.subTournamentId || req.body.sub_tournament_id;
  res.status(201).json(await service.create(subTournamentId, req.body));
}

async function remove(req, res) {
  await service.remove(req.params.id);
  res.status(204).end();
}

module.exports = { listBySubTournament, getById, create, remove };
