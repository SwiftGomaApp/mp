const service = require("../services/device.service");

async function register(req, res, next) {
  try {
    res
      .status(201)
      .json(await service.registerDevice(req.auth.userId, req.auth.sessionId, req.body));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    res.json(await service.removeDevice(req.auth.userId, req.params.subscriptionId));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, remove };
