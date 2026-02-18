// BackEnd/auth.js
// Simple fake token auth: token format "driver-{id}-token"
// Stores issued tokens in memory so server can invalidate if desired.

const tokens = new Map(); // token -> driverId

function createToken(driverId) {
  const token = `driver-${driverId}-token`;
  tokens.set(token, driverId);
  return token;
}

function verifyToken(token) {
  return tokens.get(token) || null;
}

module.exports = {
  createToken,
  verifyToken,
  _tokens: tokens // exported for testing/debug
};

