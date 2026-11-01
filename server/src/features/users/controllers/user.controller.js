const service = require("../services/profile.service");
const { clientMeta } = require("../../../core/http/clientMeta");

async function get(req, res, next) {
  try {
    res.json({ user: await service.getProfile(req.auth.userId) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
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

async function upload(req, res, next) {
  try {
    res.json({
      user: await service.setAvatar({ userId: req.auth.userId, file: req.file }, clientMeta(req)),
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    res.json({
      user: await service.removeAvatar({ userId: req.auth.userId }, clientMeta(req)),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update, upload, remove };
