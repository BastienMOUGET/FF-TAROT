const service = require('./scores.service');

async function create(req, res) {

  try {

    const data = await service.createScores(
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

    const data = await service.getScores(
      req.params.tournamentId
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