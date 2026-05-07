const service = require('./tables.service');

async function create(req, res) {

  try {

    const data = await service.createTable(
      req.body
    );

    res.json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Erreur serveur'
    });

  }

}

async function list(req, res) {

  try {

    const data = await service.getTables(
      req.params.roundId
    );

    res.json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Erreur serveur'
    });

  }

}

module.exports = {
  create,
  list
};