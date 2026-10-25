const service = require("../services/auth.service");
const { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } = require("../../../core/auth/cookies");
const sessionService = require("../services/session.service");
const { assertTrustedOrigin } = require("../../../core/middlewares/auth.middleware");
const { AppError } = require("../../../core/errors/AppError");
const passkeyService = require("../services/passkey.service");
const totpService = service;

function clientMeta(req) {
  console.log("IP DEBUG", { ip: req.ip, xff: req.headers["x-forwarded-for"] });
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
    const result = await service.verifyLoginOtp(req.body, clientMeta(req));
    if (result.twoFactorRequired) return res.status(202).json(result);

    const { user, accessToken, refreshToken, isNewDevice } = result;

    if (req.body.device.platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user, isNewDevice });
    }
    res.json({ user, accessToken, refreshToken, isNewDevice });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  const fromCookie = !req.body.refreshToken;

  try {
    const token = req.body.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw AppError.unauthorized(
        "Session expirée, veuillez vous reconnecter",
        "REFRESH_TOKEN_MISSING",
      );
    }
    if (fromCookie) assertTrustedOrigin(req);

    const { accessToken, refreshToken, expiresIn } = await sessionService.refreshSession(
      token,
      clientMeta(req),
    );

    if (fromCookie) {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ expiresIn });
    }
    res.json({ accessToken, refreshToken, expiresIn });
  } catch (err) {
    if (fromCookie && err instanceof AppError && err.status === 401) clearAuthCookies(res);
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({ user: await service.getMe(req.auth) });
  } catch (err) {
    next(err);
  }
}

function noStore(res) {
  res.set("Cache-Control", "no-store");
}

async function status(req, res, next) {
  try {
    res.json(await totpService.getStatus(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function setup(req, res, next) {
  try {
    noStore(res);
    res.json(await totpService.beginSetup(req.auth));
  } catch (err) {
    next(err);
  }
}

async function confirm(req, res, next) {
  try {
    noStore(res);
    res.json(
      await totpService.confirmSetup(
        { userId: req.auth.userId, code: req.body.code },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function disable(req, res, next) {
  try {
    await totpService.disable({ ...req.auth, ...req.body }, clientMeta(req));
    res.json({ enabled: false });
  } catch (err) {
    next(err);
  }
}

async function regenerateBackupCodes(req, res, next) {
  try {
    noStore(res);
    res.json(
      await totpService.regenerateBackupCodes(
        { userId: req.auth.userId, ...req.body },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function verifyLogin(req, res, next) {
  try {
    const { user, accessToken, refreshToken, isNewDevice, platform } =
      await service.verifyTwoFactorLogin(req.body, clientMeta(req));

    if (platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user, isNewDevice });
    }
    res.json({ user, accessToken, refreshToken, isNewDevice });
  } catch (err) {
    next(err);
  }
}

async function enrollSetup(req, res, next) {
  try {
    noStore(res);
    res.json(await service.beginEnrollment(req.body));
  } catch (err) {
    next(err);
  }
}

async function enrollConfirm(req, res, next) {
  try {
    noStore(res);
    const { user, accessToken, refreshToken, isNewDevice, backupCodes, platform } =
      await service.confirmEnrollment(req.body, clientMeta(req));

    if (platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user, isNewDevice, backupCodes });
    }
    res.json({ user, accessToken, refreshToken, isNewDevice, backupCodes });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await sessionService.logout(req.auth, clientMeta(req));
    if (req.auth.source === "cookie") clearAuthCookies(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    const result = await sessionService.logoutAll(req.auth, clientMeta(req));
    if (req.auth.source === "cookie") clearAuthCookies(res);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function sessions(req, res, next) {
  try {
    res.json({ sessions: await sessionService.listSessions(req.auth) });
  } catch (err) {
    next(err);
  }
}

async function disconnectDevice(req, res, next) {
  try {
    const result = await sessionService.revokeOwnSession(req.auth, req.params.id, clientMeta(req));
    if (result.current && req.auth.source === "cookie") clearAuthCookies(res);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function passkeyList(req, res, next) {
  try {
    res.json({ passkeys: await passkeyService.listPasskeys(req.auth.userId) });
  } catch (err) {
    next(err);
  }
}

async function passkeyRegisterOptions(req, res, next) {
  try {
    noStore(res);
    res.json(await passkeyService.beginRegistration(req.auth));
  } catch (err) {
    next(err);
  }
}

async function passkeyRegisterVerify(req, res, next) {
  try {
    const passkey = await passkeyService.finishRegistration(
      { userId: req.auth.userId, ...req.body },
      clientMeta(req),
    );
    res.status(201).json({ passkey });
  } catch (err) {
    next(err);
  }
}

async function passkeyRename(req, res, next) {
  try {
    res.json(
      await passkeyService.renamePasskey(
        { userId: req.auth.userId, id: req.params.id, name: req.body.name },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function passkeyRemove(req, res, next) {
  try {
    await passkeyService.removePasskey(
      { userId: req.auth.userId, id: req.params.id },
      clientMeta(req),
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function passkeyLoginOptions(req, res, next) {
  try {
    noStore(res);
    res.json(await passkeyService.beginLogin());
  } catch (err) {
    next(err);
  }
}

async function passkeyLoginVerify(req, res, next) {
  try {
    const result = await passkeyService.verifyPasskeyLogin(req.body, clientMeta(req));

    if (result.twoFactorRequired) {
      const { twoFactorRequired, enrollment, challengeToken, expiresIn } = result;
      return res.status(202).json({ twoFactorRequired, enrollment, challengeToken, expiresIn });
    }

    const { user, accessToken, refreshToken, isNewDevice, platform } = result;
    if (platform === "WEB") {
      setAuthCookies(res, { accessToken, refreshToken });
      return res.json({ user, isNewDevice });
    }
    res.json({ user, accessToken, refreshToken, isNewDevice });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signupEmail,
  signupPhone,
  verify,
  resend,
  requestOtp,
  verifyOtp,
  refresh,
  me,
  status,
  setup,
  confirm,
  disable,
  regenerateBackupCodes,
  verifyLogin,
  enrollSetup,
  enrollConfirm,
  logout,
  logoutAll,
  sessions,
  disconnectDevice,
  passkeyList,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyRename,
  passkeyRemove,
  passkeyLoginOptions,
  passkeyLoginVerify,
};
