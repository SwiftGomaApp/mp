const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const { queueCampaignStart } = require("../../../core/queue/marketing");
const { sendMarketingMail } = require("../../../core/mail/mailer");
const { getVersion } = require("./template.service");
const { previewAudience, getSegment } = require("./segment.service");
const { composeCampaignEmail } = require("./compose");

const MIN_LEAD_MS = 60 * 1000;

const notFound = () => AppError.notFound("Campagne introuvable", "CAMPAIGN_NOT_FOUND");

function maskEmail(value) {
  const [local, domain] = String(value).split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

async function contentFrom(body) {
  if (!body.templateKey) {
    return {
      templateKey: null,
      templateVersion: null,
      subject: body.subject,
      preheader: body.preheader ?? null,
      html: body.html,
      text: body.text ?? null,
    };
  }

  const version = await getVersion(body.templateKey, body.templateVersion);
  return {
    templateKey: body.templateKey,
    templateVersion: version.version,
    subject: version.subject,
    preheader: version.preheader,
    html: version.html,
    text: version.text,
  };
}

async function getCampaign(id) {
  const campaign = await getPrisma().campaign.findUnique({
    where: { id },
    include: { segment: { select: { id: true, name: true } } },
  });
  if (!campaign) throw notFound();
  return campaign;
}

async function createCampaign(body, actorId) {
  if (body.segmentId) await getSegment(body.segmentId);

  return getPrisma().campaign.create({
    data: {
      name: body.name,
      segmentId: body.segmentId ?? null,
      createdBy: actorId,
      ...(await contentFrom(body)),
    },
  });
}

async function listCampaigns({ status, page, limit }) {
  const prisma = getPrisma();
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        status: true,
        subject: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        skippedCount: true,
        createdAt: true,
      },
    }),
    prisma.campaign.count({ where }),
  ]);
  return { items, page, limit, total };
}

async function updateCampaign(id, patch) {
  const campaign = await getCampaign(id);
  if (campaign.status !== "DRAFT") {
    throw AppError.conflict("Seul un brouillon peut être modifié", "CAMPAIGN_NOT_EDITABLE");
  }
  if (patch.segmentId) await getSegment(patch.segmentId);

  const data = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.segmentId !== undefined) data.segmentId = patch.segmentId;

  if (patch.templateKey) {
    Object.assign(data, await contentFrom(patch));
  } else {
    for (const field of ["subject", "preheader", "html", "text"]) {
      if (patch[field] !== undefined) data[field] = patch[field];
    }
  }

  return getPrisma().campaign.update({ where: { id }, data });
}

async function deleteCampaign(id) {
  const campaign = await getCampaign(id);
  if (!["DRAFT", "CANCELLED"].includes(campaign.status)) {
    throw AppError.conflict(
      "Seuls un brouillon ou une campagne annulée peuvent être supprimés",
      "CAMPAIGN_NOT_DELETABLE",
    );
  }
  await getPrisma().campaign.delete({ where: { id } });
  return { id };
}

async function assertSendable(campaign) {
  const rules = campaign.segmentId ? (await getSegment(campaign.segmentId)).rules : {};
  const { count } = await previewAudience(rules);

  if (!count) {
    throw AppError.badRequest("Aucun destinataire éligible", undefined, "EMPTY_AUDIENCE");
  }
  const { maxRecipients } = getConfig().marketing;
  if (count > maxRecipients) {
    throw AppError.badRequest(
      `Le public dépasse la limite de ${maxRecipients} destinataires`,
      undefined,
      "AUDIENCE_TOO_LARGE",
    );
  }
  return count;
}

async function moveToScheduled(id, scheduledAt) {
  const { count } = await getPrisma().campaign.updateMany({
    where: { id, status: { in: ["DRAFT", "SCHEDULED"] } },
    data: { status: "SCHEDULED", scheduledAt },
  });
  if (!count) {
    throw AppError.conflict("Cette campagne ne peut plus être programmée", "CAMPAIGN_NOT_SCHEDULABLE");
  }
}

async function scheduleCampaign(id, scheduledAt) {
  const campaign = await getCampaign(id);
  if (scheduledAt.getTime() < Date.now() + MIN_LEAD_MS) {
    throw AppError.badRequest(
      "Choisissez une date au moins une minute dans le futur",
      undefined,
      "INVALID_SCHEDULE",
    );
  }
  const audience = await assertSendable(campaign);
  await moveToScheduled(id, scheduledAt);
  return { id, status: "SCHEDULED", scheduledAt, audience };
}

async function sendCampaignNow(id) {
  const campaign = await getCampaign(id);
  const audience = await assertSendable(campaign);
  const scheduledAt = new Date();
  await moveToScheduled(id, scheduledAt);
  await queueCampaignStart(id);
  return { id, status: "SCHEDULED", scheduledAt, audience };
}

async function cancelCampaign(id) {
  const prisma = getPrisma();
  await getCampaign(id);

  const { count } = await prisma.campaign.updateMany({
    where: { id, status: { in: ["SCHEDULED", "SENDING"] } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (!count) {
    throw AppError.conflict("Cette campagne ne peut pas être annulée", "CAMPAIGN_NOT_CANCELLABLE");
  }

  await prisma.campaignRecipient.updateMany({
    where: { campaignId: id, status: "PENDING" },
    data: { status: "SKIPPED", skipReason: "cancelled" },
  });
  return { id, status: "CANCELLED" };
}

async function sendTest(id, actorId) {
  const campaign = await getCampaign(id);
  const actor = await getPrisma().user.findUnique({
    where: { id: actorId },
    select: { name: true, email: true, emailVerifiedAt: true },
  });
  if (!actor?.email || !actor.emailVerifiedAt) {
    throw AppError.badRequest(
      "Aucune adresse e-mail vérifiée pour recevoir le test",
      undefined,
      "CONTACT_NOT_AVAILABLE",
    );
  }

  const message = composeCampaignEmail({
    campaign,
    recipient: { email: actor.email, name: actor.name },
    preview: true,
  });
  await sendMarketingMail({ to: actor.email, ...message });
  return { sentTo: maskEmail(actor.email) };
}

module.exports = {
  getCampaign,
  createCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  scheduleCampaign,
  sendCampaignNow,
  cancelCampaign,
  sendTest,
};
