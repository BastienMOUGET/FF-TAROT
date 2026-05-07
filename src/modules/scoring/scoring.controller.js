const service = require('./scoring.service');

async function listByRound(req, res) {
  res.json(await service.listByRound(req.params.roundId));
}

async function getByRoundAndTable(req, res) {
  res.json(
    await service.getByRoundAndTable(
      req.params.roundId,
      req.params.tableNumber
    )
  );
}

async function setCodifs(req, res) {
  res.json(
    await service.setCodifs(
      req.params.roundId,
      req.params.tableNumber,
      req.body
    )
  );
}

async function validate(req, res) {
  res.json(
    await service.validate(req.params.roundId, req.params.tableNumber)
  );
}

async function unvalidate(req, res) {
  res.json(
    await service.unvalidate(req.params.roundId, req.params.tableNumber)
  );
}

async function removeByRoundAndTable(req, res) {
  await service.removeByRoundAndTable(
    req.params.roundId,
    req.params.tableNumber
  );
  res.status(204).end();
}

async function addHand(req, res) {
  res.status(201).json(
    await service.addHand(
      req.params.roundId,
      req.params.tableNumber,
      req.body
    )
  );
}

async function updateHand(req, res) {
  res.json(await service.updateHand(req.params.id, req.body));
}

async function removeHand(req, res) {
  await service.removeHand(req.params.id);
  res.status(204).end();
}

module.exports = {
  listByRound,
  getByRoundAndTable,
  setCodifs,
  validate,
  unvalidate,
  removeByRoundAndTable,
  addHand,
  updateHand,
  removeHand,
};
