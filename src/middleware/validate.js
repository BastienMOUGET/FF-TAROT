const { validationResult } = require('express-validator');
const { badRequest } = require('../utils/httpError');

module.exports = (req, res, next) => {
  const errors = validationResult(req);

  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));

  next(badRequest('Validation échouée', details));
};
