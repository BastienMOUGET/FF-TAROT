// Wrap an async route handler so any thrown error is passed to next().
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
