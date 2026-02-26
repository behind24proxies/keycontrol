/**
 * Wrap an async route handler so rejected promises are forwarded to next().
 * Eliminates the need for try/catch in every route.
 */
export const asyncCatch = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
