const geoip = require("geoip-lite");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");

const regionNames = new Intl.DisplayNames(["fr"], { type: "region" });
const TIMEOUT_MS = 1500;
const EMPTY = Object.freeze({ city: null, country: null });
const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|f[cd][0-9a-f]{2}:)/i;

function countryName(code) {
  return code ? regionNames.of(code) : null;
}

function lookupOffline(ip) {
  const hit = geoip.lookup(ip);
  return { city: hit?.city || null, country: countryName(hit?.country) };
}

async function lookupOnline(ip) {
  const { ipinfoToken } = getConfig().geo;
  const query = ipinfoToken ? `?token=${encodeURIComponent(ipinfoToken)}` : "";

  const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ipinfo responded ${res.status}`);

  const data = await res.json();
  logger.debug({ ip, data }, "ipinfo response");
  return { city: data.city || null, country: countryName(data.country) };
}

async function lookupIp(ip) {
  const clean = String(ip ?? "").replace(/^::ffff:/, "");
  if (!clean || PRIVATE_IP.test(clean)) return EMPTY;

  try {
    const online = await lookupOnline(clean);
    if (online.country) return online;
  } catch (err) {
    logger.warn({ err }, "Online IP lookup failed, using offline database");
  }

  return lookupOffline(clean);
}

module.exports = { lookupIp };
