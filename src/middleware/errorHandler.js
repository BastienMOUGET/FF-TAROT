const { HttpError } = require('../utils/httpError');

// MariaDB error codes we want to translate into proper HTTP statuses.
const SQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';
const SQL_FK_VIOLATION = 'ER_NO_REFERENCED_ROW_2';
const SQL_FK_VIOLATION_DELETE = 'ER_ROW_IS_REFERENCED_2';

module.exports = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err && err.code === SQL_DUPLICATE_ENTRY) {
    return res.status(409).json({
      error: 'Doublon : cette ressource existe déjà',
    });
  }

  if (err && err.code === SQL_FK_VIOLATION) {
    return res.status(400).json({
      error: 'Référence invalide (clé étrangère)',
    });
  }

  if (err && err.code === SQL_FK_VIOLATION_DELETE) {
    return res.status(409).json({
      error: 'Suppression impossible : ressource référencée ailleurs',
    });
  }

  console.error('[error]', err);

  res.status(500).json({ error: 'Erreur serveur' });
};
