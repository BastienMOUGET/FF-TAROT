const service = require('./donne-sets.service');

async function list(req, res) {
  res.json(await service.list());
}

async function getById(req, res) {
  res.json(await service.getById(req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.create(req.body));
}

async function rename(req, res) {
  res.json(await service.rename(req.params.id, req.body));
}

async function remove(req, res) {
  await service.remove(req.params.id);
  res.status(204).end();
}

async function getDonne(req, res) {
  res.json(
    await service.getDonneByNumber(
      req.params.id,
      Number(req.params.donneNumber)
    )
  );
}

async function regenerate(req, res) {
  res.json(
    await service.regenerateDonne(
      req.params.id,
      Number(req.params.donneNumber)
    )
  );
}

async function swap(req, res) {
  res.json(
    await service.swapHands(
      req.params.id,
      Number(req.params.donneNumber),
      req.body.seat_a,
      req.body.seat_b
    )
  );
}

module.exports = {
  list,
  getById,
  create,
  rename,
  remove,
  getDonne,
  regenerate,
  swap,
};
