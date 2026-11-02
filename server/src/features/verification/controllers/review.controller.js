const review = require("../services/review.service");
const decision = require("../services/decision.service");
const { clientMeta } = require("../../../core/http/clientMeta");

const actor = (req) => ({ userId: req.auth.userId, role: req.auth.role });

async function listCases(req, res, next) {
  try {
    res.json(await review.listCases({ actor: actor(req), ...req.validated.query }));
  } catch (err) {
    next(err);
  }
}

async function getCase(req, res, next) {
  try {
    res.json({ case: await review.getCase({ caseId: req.params.id, actor: actor(req) }) });
  } catch (err) {
    next(err);
  }
}

async function takeCase(req, res, next) {
  try {
    await review.takeCase({ caseId: req.params.id, actor: actor(req) }, clientMeta(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function logCall(req, res, next) {
  try {
    const call = await review.logCall(
      { caseId: req.params.id, actor: actor(req), ...req.body },
      clientMeta(req),
    );
    res.status(201).json({ call });
  } catch (err) {
    next(err);
  }
}

async function giveOpinion(req, res, next) {
  try {
    const opinion = await review.giveOpinion(
      { caseId: req.params.id, actor: actor(req), ...req.body },
      clientMeta(req),
    );
    res.json({ case: opinion });
  } catch (err) {
    next(err);
  }
}

async function viewDocument(req, res, next) {
  try {
    res.json(
      await review.viewDocument(
        { caseId: req.params.id, type: req.params.type, actor: actor(req) },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

async function approveCase(req, res, next) {
  try {
    await decision.approveCase(
      { caseId: req.params.id, actor: actor(req), note: req.body.note },
      clientMeta(req),
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function rejectCase(req, res, next) {
  try {
    res.json(
      await decision.rejectCase(
        { caseId: req.params.id, actor: actor(req), note: req.body.note },
        clientMeta(req),
      ),
    );
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCases,
  getCase,
  takeCase,
  logCall,
  giveOpinion,
  viewDocument,
  approveCase,
  rejectCase,
};
