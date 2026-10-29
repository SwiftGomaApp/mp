const segments = require("../services/segment.service");
const templates = require("../services/template.service");
const campaigns = require("../services/campaign.service");
const analytics = require("../services/analytics.service");
const suppressions = require("../services/suppression.service");

const handle =
  (fn, status = 200) =>
  async (req, res, next) => {
    try {
      res.status(status).json(await fn(req));
    } catch (err) {
      next(err);
    }
  };

module.exports = {
  // segments
  createSegment: handle((req) => segments.createSegment(req.body, req.auth.userId), 201),
  listSegments: handle((req) => segments.listSegments(req.validated.query)),
  getSegment: handle((req) => segments.getSegment(req.params.id)),
  updateSegment: handle((req) => segments.updateSegment(req.params.id, req.body)),
  deleteSegment: handle((req) => segments.deleteSegment(req.params.id)),
  previewSegment: handle((req) => segments.previewAudience(req.body.rules)),

  // templates
  createTemplate: handle((req) => templates.createTemplate(req.body, req.auth.userId), 201),
  listTemplates: handle((req) => templates.listTemplates(req.validated.query)),
  getTemplate: handle((req) => templates.getTemplate(req.params.key)),
  updateTemplate: handle((req) =>
    templates.updateTemplate(req.params.key, req.body, req.auth.userId),
  ),

  // campaigns
  createCampaign: handle((req) => campaigns.createCampaign(req.body, req.auth.userId), 201),
  listCampaigns: handle((req) => campaigns.listCampaigns(req.validated.query)),
  getCampaign: handle((req) => campaigns.getCampaign(req.params.id)),
  updateCampaign: handle((req) => campaigns.updateCampaign(req.params.id, req.body)),
  deleteCampaign: handle((req) => campaigns.deleteCampaign(req.params.id)),
  scheduleCampaign: handle((req) =>
    campaigns.scheduleCampaign(req.params.id, req.body.scheduledAt),
  ),
  sendCampaign: handle((req) => campaigns.sendCampaignNow(req.params.id)),
  cancelCampaign: handle((req) => campaigns.cancelCampaign(req.params.id)),
  testCampaign: handle((req) => campaigns.sendTest(req.params.id, req.auth.userId)),

  // recipients and suppression list
  listRecipients: handle((req) =>
    suppressions.listRecipients(req.params.id, req.validated.query),
  ),
  listSuppressions: handle((req) => suppressions.listSuppressions(req.validated.query)),
  addSuppression: handle((req) => suppressions.addSuppression(req.body), 201),
  removeSuppression: handle((req) => suppressions.removeSuppression(req.params.id)),

  // analytics
  campaignStats: handle((req) => analytics.campaignStats(req.params.id)),
  overview: handle((req) => analytics.overview(req.validated.query)),
};
