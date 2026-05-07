const service = require('./rounds.service');

async function create(req, res) {
  try {
    const data = await service.createRound(
      req.body.tournament_id,
      req.body.round_number
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
    const data = await service.getRounds(
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

async function generate(req, res) {

  try {

    const data =
      await service.generateTables(
        req.params.id
      );

    res.json(data);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

}

module.exports = {
  create,
  list,
  generate
};