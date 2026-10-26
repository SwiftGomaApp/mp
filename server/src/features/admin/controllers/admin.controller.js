const accountStatus = require("../../auth/services/accountStatus.service");

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 255) };
}

function input(req) {
  return { userId: req.params.id, actorId: req.auth.userId, reason: req.body.reason };
}

async function suspend(req, res, next) {
  try {
    await accountStatus.suspendAccount(input(req), clientMeta(req));
    res.json({ id: req.params.id, status: "SUSPENDED" });
  } catch (err) {
    next(err);
  }
}

async function ban(req, res, next) {
  try {
    await accountStatus.banAccount(input(req), clientMeta(req));
    res.json({ id: req.params.id, status: "BANNED" });
  } catch (err) {
    next(err);
  }
}

async function reactivate(req, res, next) {
  try {
    await accountStatus.reactivateAccount(input(req), clientMeta(req));
    res.json({ id: req.params.id, status: "ACTIVE" });
  } catch (err) {
    next(err);
  }
}

module.exports = { suspend, ban, reactivate };
