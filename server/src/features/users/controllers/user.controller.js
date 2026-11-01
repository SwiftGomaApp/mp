const service = require("../services/user.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function getProfile(req, res, next) {
  try {
    res.json({ user: await service.getProfile(req.auth.userId) });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    res.json({
      user: await service.updateProfile(
        { userId: req.auth.userId, name: req.body.name },
        clientMeta(req),
      ),
    });
  } catch (err) {
    next(err);
  }
}

async function uploadAvatar(req, res, next) {
  try {
    res.json({
      user: await service.setAvatar({ userId: req.auth.userId, file: req.file }, clientMeta(req)),
    });
  } catch (err) {
    next(err);
  }
}

async function removeAvatar(req, res, next) {
  try {
    res.json({
      user: await service.removeAvatar({ userId: req.auth.userId }, clientMeta(req)),
    });
  } catch (err) {
    next(err);
  }
}

async function listAddresses(req, res, next) {
  try {
    res.json(await service.listAddresses(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function createAddress(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await service.createAddress({ userId: req.auth.userId, data: req.body }, clientMeta(req)),
      );
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    res.json(
      await service.updateAddress(
        { userId: req.auth.userId, id: req.params.id, data: req.body },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function removeAddress(req, res, next) {
  try {
    await service.removeAddress({ userId: req.auth.userId, id: req.params.id }, clientMeta(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function requestContactChange(req, res, next) {
  try {
    res.json(
      await service.requestContactChange({ userId: req.auth.userId, ...req.body }, clientMeta(req)),
    );
  } catch (err) {
    next(err);
  }
}

async function verifyContactChange(req, res, next) {
  try {
    res.json(
      await service.verifyContactChange({ userId: req.auth.userId, ...req.body }, clientMeta(req)),
    );
  } catch (err) {
    next(err);
  }
}

async function getPreferences(req, res, next) {
  try {
    res.json(await service.getPreferences(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    res.json(
      await service.updatePreferences({ userId: req.auth.userId, data: req.body }, clientMeta(req)),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPreferences,
  updatePreferences,
  getProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
  listAddresses,
  createAddress,
  updateAddress,
  removeAddress,
  requestContactChange,
  verifyContactChange,
};
