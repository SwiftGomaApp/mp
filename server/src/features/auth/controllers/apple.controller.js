const service = require("../services/apple.service");
const { setAuthCookies, accessExpiresIn } = require("../../../core/auth/cookies");
const { clientMeta } = require("../../../core/http/clientMeta");

function sendLoginResult(req, res, result) {
  if (result.twoFactorRequired) {
    return res.status(202).json(result);
  }

  const { user, accessToken, refreshToken, isNewDevice } = result;

  if (req.body.device.platform === "WEB") {
    setAuthCookies(res, { accessToken, refreshToken });
    return res.json({ user, isNewDevice, expiresIn: accessExpiresIn() });
  }

  return res.json({
    user,
    accessToken,
    refreshToken,
    isNewDevice,
    expiresIn: accessExpiresIn(),
  });
}

async function login(req, res, next) {
  try {
    const result = await service.loginWithApple(req.body, clientMeta(req));
    return sendLoginResult(req, res, result);
  } catch (err) {
    next(err);
  }
}

async function signup(req, res, next) {
  try {
    const result = await service.signupWithApple(req.body, clientMeta(req));
    return sendLoginResult(req, res, result);
  } catch (err) {
    next(err);
  }
}

async function link(req, res, next) {
  try {
    const result = await service.linkAppleAccount(
      {
        userId: req.auth.userId,
        idToken: req.body.idToken,
        nonce: req.body.nonce,
        stepUpCode: req.body.stepUpCode,
      },
      clientMeta(req),
    );

    return res.status(result.alreadyLinked ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  signup,
  link,
};
