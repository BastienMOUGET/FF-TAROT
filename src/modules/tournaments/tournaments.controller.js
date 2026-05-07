const service = require('./tournaments.service');

async function getAll(req, res) {
  try {
    const data = await service.getAll();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erreur serveur'
    });
  }
}

async function create(req, res) {
  try {
    const data = await service.create(req.body);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erreur serveur'
    });
  }
}

async function getById(req, res) {
  try {
    const data = await service.getById(req.params.id);

    if (!data) {
      return res.status(404).json({
        error: 'Tournoi introuvable'
      });
    }

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Erreur serveur'
    });
  }
}

module.exports = {
  getAll,
  create,
  getById
};