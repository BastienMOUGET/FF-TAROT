const { getRanking } = require('./ranking.service');

async function ranking(req, res) {
  try {
    const { tournamentId } = req.params;
    const data = await getRanking(tournamentId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

module.exports = { ranking };