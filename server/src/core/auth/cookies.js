const { getConfig } = require("../../config/env.config");

const ACCESS_COOKIE = "swg_access";
const REFRESH_COOKIE = "swg_refresh";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function baseOptions() {
  return { httpOnly: true, secure: getConfig().isProd, sameSite: "lax" };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const { accessTtlSeconds, refreshTtlDays } = getConfig().auth;

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseOptions(),
    path: "/",
    maxAge: accessTtlSeconds * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_COOKIE_PATH });
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  setAuthCookies,
  clearAuthCookies,
};
