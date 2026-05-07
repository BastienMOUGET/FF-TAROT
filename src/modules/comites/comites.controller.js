const service = require('./comites.service');

async function list(req, res) {
  res.json(await service.list({ ligue_id: req.query.ligue_id }));
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
