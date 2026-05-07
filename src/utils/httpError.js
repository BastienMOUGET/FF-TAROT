class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

const notFound = (message = 'Ressource introuvable') =>
  new HttpError(404, message);

const conflict = (message = 'Conflit') =>
  new HttpError(409, message);

const badRequest = (message = 'Requête invalide', details) =>
  new HttpError(400, message, details);

module.exports = { HttpError, notFound, conflict, badRequest };
