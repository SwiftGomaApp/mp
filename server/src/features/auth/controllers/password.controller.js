const service = require("../services/password.service");
const { setAuthCookies } = require("../../../core/auth/cookies");
const { clientMeta } = require("../../../core/http/clientMeta");

function handler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

const requestStepUp = handler(async (req, res) => {
  res.json(
    await service.requestStepUpOtp({ userId: req.auth.userId, ...req.body }, clientMeta(req)),
  );
});

const create = handler(async (req, res) => {
  await service.createPassword({ userId: req.auth.userId, ...req.body }, clientMeta(req));
  res.status(201).json({ message: "Mot de passe créé" });
});

const update = handler(async (req, res) => {
  await service.updatePassword(
    { userId: req.auth.userId, sessionId: req.auth.sessionId, ...req.body },
    clientMeta(req),
  );
  res.json({ message: "Mot de passe modifié" });
});

const forgot = handler(async (req, res) => {
  res.json(await service.forgotPassword(req.body, clientMeta(req)));
});

const reset = handler(async (req, res) => {
  await service.resetPassword(req.body, clientMeta(req));
  res.json({ message: "Mot de passe réinitialisé, veuillez vous reconnecter" });
});

const login = handler(async (req, res) => {
  const result = await service.loginWithPassword(req.body, clientMeta(req));
  if (result.twoFactorRequired) return res.status(202).json(result);

  const { user, accessToken, refreshToken, isNewDevice } = result;
  if (req.body.device.platform === "WEB") {
    setAuthCookies(res, { accessToken, refreshToken });
    return res.json({ user, isNewDevice });
  }
  res.json({ user, accessToken, refreshToken, isNewDevice });
});

const remove = handler(async (req, res) => {
  await service.removePassword({ userId: req.auth.userId, ...req.body }, clientMeta(req));
  res.json({ message: "Mot de passe supprimé" });
});

module.exports = { requestStepUp, create, update, forgot, reset, login, remove };
