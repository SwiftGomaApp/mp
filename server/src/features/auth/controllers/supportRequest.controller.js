const service = require("../services/supportRequest.service");

function clientMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent")?.slice(0, 255) };
}

async function create(req, res, next) {
  try {
    res.status(202).json(await service.createSupportRequest(req.body, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

module.exports = { create };
