const service = require("../services/apple.service");
const { setAuthCookies } = require("../../../core/auth/cookies");

function clientMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get("user-agent")?.slice(0, 255),
  };
}

function sendLoginResult(req, res, result) {
  if (result.twoFactorRequired) {
    return res.status(202).json(result);
  }

  const { user, accessToken, refreshToken, isNewDevice } = result;

  if (req.body.device.platform === "WEB") {
    setAuthCookies(res, { accessToken, refreshToken });
    return res.json({ user, isNewDevice });
  }

  return res.json({
    user,
    accessToken,
    refreshToken,
    isNewDevice,
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
