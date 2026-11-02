const service = require("../services/applicant.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function getMyCase(req, res, next) {
  try {
    res.json(await service.getMyCase(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function startCase(req, res, next) {
  try {
    res.json({ case: await service.startCase(req.auth.userId) });
  } catch (err) {
    next(err);
  }
}

async function saveDetails(req, res, next) {
  try {
    res.json({ case: await service.saveDetails({ userId: req.auth.userId, ...req.body }) });
  } catch (err) {
    next(err);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const document = await service.uploadDocument({
      userId: req.auth.userId,
      type: req.params.type,
      file: req.file,
      expiresAt: req.body.expiresAt,
    });
    res.json({ document });
  } catch (err) {
    next(err);
  }
}

async function removeDocument(req, res, next) {
  try {
    await service.removeDocument({ userId: req.auth.userId, type: req.params.type });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function submitCase(req, res, next) {
  try {
    res.json(await service.submitCase(req.auth.userId, clientMeta(req)));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyCase,
  startCase,
  saveDetails,
  uploadDocument,
  removeDocument,
  submitCase,
};
