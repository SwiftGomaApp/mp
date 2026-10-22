const service = require("../services/auth.service");
const { setAuthCookies } = require("../../../core/auth/cookies");

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 255) };
}

async function signupEmail(req, res, next) {
  try {
    res.status(201).json(await service.startSignUp(req.body, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

async function signupPhone(req, res, next) {
  try {
    res.status(201).json(await service.startSignUp(req.body, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await service.verifySignUp(
      req.body,
      clientMeta(req),
    );

    if (req.body.device.platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user });
    }
    res.json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

async function resend(req, res, next) {
  try {
    res.json(await service.resendSignupOtp(req.body));
  } catch (err) {
    next(err);
  }
}

async function requestOtp(req, res, next) {
  try {
    res.json(await service.requestLoginOtp(req.body, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { user, accessToken, refreshToken, isNewDevice } = await service.verifyLoginOtp(
      req.body,
      clientMeta(req),
    );

    if (req.body.device.platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user, isNewDevice });
    }
    res.json({ user, accessToken, refreshToken, isNewDevice });
  } catch (err) {
    next(err);
  }
}

module.exports = { signupEmail, signupPhone, verify, resend, requestOtp, verifyOtp };
