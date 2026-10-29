const service = require("../services/admin.service");

async function analytics(req, res, next) {
  try {
    res.json(await service.deliveryAnalytics(req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function deliveries(req, res, next) {
  try {
    res.json(await service.lookupDeliveries(req.validated.query));
  } catch (err) {
    next(err);
  }
}

module.exports = { analytics, deliveries };
