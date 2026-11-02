const { AsyncLocalStorage } = require("node:async_hooks");
const { getConfig } = require("../../config/env.config");
const { AppError } = require("../errors/AppError");

const store = new AsyncLocalStorage();

const ROLES_BY_APP = Object.freeze({
  web: ["BUYER", "SELLER"],
  admin: ["SUPPORT", "ADMIN"],
});

function resolveClientApp(origin) {
  if (!origin) return null;
  const { webOrigins, adminOrigins } = getConfig().clientApps;
  if (adminOrigins.includes(origin)) return "admin";
  if (webOrigins.includes(origin)) return "web";
  return null;
}

function bindClientApp(req, res, next) {
  store.run({ app: resolveClientApp(req.get("origin")) }, next);
}

function assertRoleAllowedOnClient(role) {
  const app = store.getStore()?.app;
  if (!app || ROLES_BY_APP[app].includes(role)) return;

  if (app === "web" && role === "RIDER") {
    throw AppError.forbidden(
      "Les comptes livreur s'utilisent depuis l'application mobile",
      "RIDER_MOBILE_ONLY",
    );
  }
  throw AppError.forbidden(
    "Ce rôle n'est pas autorisé sur cette application",
    "ROLE_NOT_ALLOWED_ON_CLIENT",
  );
}

module.exports = { bindClientApp, assertRoleAllowedOnClient, resolveClientApp };
