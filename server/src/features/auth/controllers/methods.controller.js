const service = require("../services/methods.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function list(req, res, next) {
  try {
    res.json(await service.listMethods(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    res.json(
      await service.removeMethod(
        { userId: req.auth.userId, method: req.params.method, ...req.body },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { list, remove };
