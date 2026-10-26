const { issueNonce } = require("../../../core/auth/nonce");

async function nonce(req, res, next) {
  try {
    res.set("Cache-Control", "no-store");
    res.json({ nonce: await issueNonce() });
  } catch (err) {
    next(err);
  }
}

module.exports = { nonce };
