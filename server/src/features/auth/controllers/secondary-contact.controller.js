const secondaryContactService = require("../services/secondary-contact.service");

async function requestOtp(req, res, next) {
  try {
    const result = await secondaryContactService.requestSecondaryContactOtp(
      {
        userId: req.user.id,
        kind: req.body.kind,
        value: req.body.value,
      },
      {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const result = await secondaryContactService.verifySecondaryContact(
      {
        userId: req.user.id,
        kind: req.body.kind,
        value: req.body.value,
        code: req.body.code,
      },
      {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await secondaryContactService.listSecondaryContacts(req.user.id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requestOtp,
  verify,
  list,
};
