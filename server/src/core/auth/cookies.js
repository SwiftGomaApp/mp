const { getConfig } = require("../../config/env.config");

const ACCESS_COOKIE = "__Host-swg_access";
const REFRESH_COOKIE = "swg_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function baseOptions() {
  return { httpOnly: true, secure: getConfig().isProd, sameSite: "lax" };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const { accessTtlSeconds, refreshTtlDays } = getConfig().auth;

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    secure: true,
    path: "/",
    maxAge: accessTtlSeconds * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

// How long the access token lives, in seconds: sent with every answer that opens a session.
function accessExpiresIn() {
  return getConfig().auth.accessTtlSeconds;
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), secure: true, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_COOKIE_PATH });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  setAuthCookies,
  clearAuthCookies,
  accessExpiresIn,
};
