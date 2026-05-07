const service = require('./tournaments.service');

async function list(req, res) {
  res.json(
    await service.list({
      status: req.query.status,
      type: req.query.type,
      club_id: req.query.club_id,
      comite_id: req.query.comite_id,
    })
  );
}

async function getById(req, res) {
  res.json(await service.getById(req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.create(req.body));
}

async function update(req, res) {
  res.json(await service.update(req.params.id, req.body));
}

async function remove(req, res) {
  await service.remove(req.params.id);
  res.status(204).end();
}

module.exports = { list, getById, create, update, remove };
