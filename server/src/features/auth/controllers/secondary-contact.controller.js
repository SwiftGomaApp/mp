const secondaryContactService = require("../services/secondary-contact.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function requestOtp(req, res, next) {
  try {
    const result = await secondaryContactService.requestSecondaryContactOtp(
      {
        userId: req.auth.userId,
        kind: req.body.kind,
        value: req.body.value,
        stepUpCode: req.body.stepUpCode,
      },
      clientMeta(req),
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const result = await secondaryContactService.verifySecondaryContact(
      {
        userId: req.auth.userId,
        kind: req.body.kind,
        value: req.body.value,
        code: req.body.code,
      },
      clientMeta(req),
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await secondaryContactService.removeSecondaryContact(
      {
        userId: req.auth.userId,
        kind: req.body.kind,
        stepUpCode: req.body.stepUpCode,
      },
      clientMeta(req),
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await secondaryContactService.listSecondaryContacts(req.auth.userId);

    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requestOtp,
  verify,
  remove,
  list,
};
