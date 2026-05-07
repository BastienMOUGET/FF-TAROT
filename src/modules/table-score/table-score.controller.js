const service = require('./table-score.service');

async function create(req, res) {

  try {

    const result = await service.saveTableScore(
      req.body
    );

    res.json(result);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Erreur serveur'
    });

  }

}

async function remove(req, res) {

  try {

    const result =
      await service.deleteTableScore(
        req.params.tableId
      );

    res.json(result);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

}

module.exports = {
  create,
  remove
};