const service = require('./pp-grids.service');

async function get(req, res) {
  res.json(await service.get(req.params.subTournamentId));
}

async function replace(req, res) {
  res.json(
    await service.replace(req.params.subTournamentId, req.body.entries || [])
  );
}

async function clear(req, res) {
  await service.clear(req.params.subTournamentId);
  res.status(204).end();
}

module.exports = { get, replace, clear };
