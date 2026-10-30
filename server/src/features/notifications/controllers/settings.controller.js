const service = require("../services/settings.service");
const { listCatalog } = require("../services/catalog.service");

async function getPreferences(req, res, next) {
  try {
    res.json(await service.getPreferences(req.auth.userId, req.auth.role));
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    res.json(await service.updatePreferences(req.auth.userId, req.auth.role, req.body.preferences));
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    res.json(await service.updateSettings(req.auth.userId, req.body));
  } catch (err) {
    next(err);
  }
}

function catalog(req, res) {
  res.json(listCatalog(req.auth.role));
}

module.exports = { getPreferences, updatePreferences, updateSettings, catalog };
