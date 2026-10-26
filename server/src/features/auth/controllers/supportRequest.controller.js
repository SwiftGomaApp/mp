const service = require("../services/supportRequest.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function create(req, res, next) {
  try {
    res.status(202).json(await service.createSupportRequest(req.body, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    res.json(await service.listSupportRequests(req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function close(req, res, next) {
  try {
    res.json(
      await service.closeSupportRequest(
        { actorId: req.auth.userId, id: req.params.id, ...req.body },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, close };
