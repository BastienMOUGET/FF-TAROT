const service = require('./ranking.service');

async function get(req, res) {
  res.json(await service.getRanking(req.params.subTournamentId));
}

async function recompute(req, res) {
  res.json(await service.compute(req.params.subTournamentId));
}

async function exportPcn(req, res) {
  const { filename, content } = await service.exportPcnCsv(
    req.params.subTournamentId
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.send(content);
}

module.exports = { get, recompute, exportPcn };
