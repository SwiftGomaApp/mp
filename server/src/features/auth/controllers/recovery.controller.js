const service = require("../services/recovery.service");
const { clientMeta } = require("../../../core/http/clientMeta");

function handler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      next(err);
    }
  };
}

const request = handler(async (req, res) => {
  res.json(await service.requestRecovery(req.body, clientMeta(req)));
});

const verify = handler(async (req, res) => {
  res.json(await service.verifyRecoveryContact(req.body, clientMeta(req)));
});

const contact = handler(async (req, res) => {
  res.json(await service.requestNewPrimaryContact(req.body, clientMeta(req)));
});

const complete = handler(async (req, res) => {
  res.json(await service.completeRecovery(req.body, clientMeta(req)));
});

const cancel = handler(async (req, res) => {
  res.json(await service.cancelRecovery({ userId: req.auth.userId }, clientMeta(req)));
});

module.exports = { request, verify, contact, complete, cancel };
