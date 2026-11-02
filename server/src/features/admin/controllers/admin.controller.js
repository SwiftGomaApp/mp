const accountStatus = require("../../auth/services/accountStatus.service");
const users = require("../services/users.service");

async function listUsers(req, res, next) {
  try {
    res.json(await users.listUsers(req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    res.json({ user: await users.getUser(req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function listActivity(req, res, next) {
  try {
    res.json(await users.listActivity(req.params.id, req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function forceLogout(req, res, next) {
  try {
    await users.forceLogout(input(req), clientMeta(req));
    res.json({ id: req.params.id, sessionsRevoked: true });
  } catch (err) {
    next(err);
  }
}

async function changeRole(req, res, next) {
  try {
    await users.changeRole({ ...input(req), role: req.body.role }, clientMeta(req));
    res.json({ id: req.params.id, role: req.body.role });
  } catch (err) {
    next(err);
  }
}

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

const act =
  (name, extra = () => ({})) =>
  async (req, res, next) => {
    try {
      await users[name]({ ...input(req), ...extra(req) }, clientMeta(req));
      res.json({ id: req.params.id, ok: true });
    } catch (err) {
      next(err);
    }
  };

const unlockAccount = act("unlockAccount");
const cancelDeletion = act("cancelDeletion");
const stepUp = (req) => ({ stepUpCode: req.body.stepUpCode });
const forceDeletion = act("forceDeletion", stepUp);
const resetPassword = act("resetPassword", stepUp);
const resetTwoFactor = act("resetTwoFactor", stepUp);
const moderateProfile = act("moderateProfile", (req) => req.body);
const updateContact = act("updateContact", (req) => req.body);

async function listAudit(req, res, next) {
  try {
    res.json(await users.listAudit(req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function exportUserData(req, res, next) {
  try {
    const data = await users.exportUserData(input(req), clientMeta(req));
    res.set({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="swiftgoma-export-${req.params.id}.json"`,
      "Cache-Control": "no-store",
    });
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  suspend,
  ban,
  reactivate,
  listUsers,
  getUser,
  listActivity,
  forceLogout,
  changeRole,
  unlockAccount,
  cancelDeletion,
  forceDeletion,
  resetPassword,
  resetTwoFactor,
  moderateProfile,
  updateContact,
  listAudit,
  exportUserData,
};
