const service = require("../services/security.service");

async function activity(req, res, next) {
  try {
    res.json(await service.getActivity(req.auth.userId, req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function checklist(req, res, next) {
  try {
    res.json(await service.getSecurityChecklist(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

module.exports = { activity, checklist };
