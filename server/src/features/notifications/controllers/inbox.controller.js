const service = require("../services/inbox.service");

async function list(req, res, next) {
  try {
    res.json(await service.listNotifications(req.auth.userId, req.validated.query));
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    res.json(await service.unreadSummary(req.auth.userId));
  } catch (err) {
    next(err);
  }
}

async function read(req, res, next) {
  try {
    res.json(await service.markRead(req.auth.userId, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function ack(req, res, next) {
  try {
    res.json(await service.acknowledge(req.auth.userId, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function readAll(req, res, next) {
  try {
    res.json(await service.markAllRead(req.auth.userId, req.body));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    res.json(await service.removeNotification(req.auth.userId, req.params.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, unreadCount, read, ack, readAll, remove };
