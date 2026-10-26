const service = require("../services/staff.service");

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 255) };
}

async function create(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await service.createSupportAccount(
          { actorId: req.auth.userId, ...req.body },
          clientMeta(req),
        ),
      );
  } catch (err) {
    next(err);
  }
}

async function setup(req, res, next) {
  try {
    await service.completeStaffSetup(req.body, clientMeta(req));
    res.json({ message: "Mot de passe défini, vous pouvez maintenant vous connecter" });
  } catch (err) {
    next(err);
  }
}

async function resendSetup(req, res, next) {
  try {
    await service.resendStaffSetup(
      { actorId: req.auth.userId, userId: req.params.id, ...req.body },
      clientMeta(req),
    );
    res.json({ message: "Un nouveau lien a été envoyé" });
  } catch (err) {
    next(err);
  }
}

async function resetTwoFactor(req, res, next) {
  try {
    await service.resetStaffTwoFactor(
      { actorId: req.auth.userId, userId: req.params.id, ...req.body },
      clientMeta(req),
    );
    res.json({ id: req.params.id, twoFactorEnabled: false });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, setup, resendSetup, resetTwoFactor };
