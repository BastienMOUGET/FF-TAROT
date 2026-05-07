const service = require('./auth.service');

async function login(req, res) {
  res.json(await service.login(req.body.username, req.body.password));
}

async function me(req, res) {
  res.json(await service.getById(req.user.id));
}

async function listUsers(req, res) {
  res.json(await service.list());
}

async function getUser(req, res) {
  res.json(await service.getById(req.params.id));
}

async function createUser(req, res) {
  res.status(201).json(await service.create(req.body));
}

async function changeMyPassword(req, res) {
  await service.changePassword(req.user.id, req.body.new_password);
  res.status(204).end();
}

async function changeUserPassword(req, res) {
  await service.changePassword(req.params.id, req.body.new_password);
  res.status(204).end();
}

async function deleteUser(req, res) {
  await service.remove(req.params.id);
  res.status(204).end();
}

module.exports = {
  login,
  me,
  listUsers,
  getUser,
  createUser,
  changeMyPassword,
  changeUserPassword,
  deleteUser,
};
