const { getConfig } = require("../../../config/env.config");
const { logger } = require("../../../core/logger/logger");
const { AppError } = require("../../../core/errors/AppError");

const MAX_TARGETS = 2000;

function unavailable() {
  return new AppError(
    503,
    "PUSH_UNAVAILABLE",
    "L'envoi de la notification est impossible pour le moment",
  );
}

function buildTarget({ userIds, subscriptionIds }) {
  return subscriptionIds?.length
    ? { include_subscription_ids: subscriptionIds }
    : { include_aliases: { external_id: userIds } };
}

function buildBody({
  appId,
  userIds,
  subscriptionIds,
  title,
  body,
  data,
  ttl,
  priority,
  idempotencyKey,
}) {
  return {
    app_id: appId,
    target_channel: "push",
    ...buildTarget({ userIds, subscriptionIds }),
    headings: { fr: title, en: title },
    contents: { fr: body, en: body },
    ...(data ? { data } : {}),
    ...(ttl ? { ttl } : {}),
    ...(priority ? { priority } : {}),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };
}

async function sendPush({
  userIds,
  subscriptionIds,
  title,
  body,
  data,
  ttl,
  priority,
  idempotencyKey,
}) {
  const bySubscription = Boolean(subscriptionIds?.length);
  const targets = [...new Set((bySubscription ? subscriptionIds : [userIds]).flat().filter(Boolean))];

  if (!targets.length) return { id: null, recipients: 0, status: "NoTargets" };
  if (targets.length > MAX_TARGETS) {
    throw AppError.badRequest("Trop de destinataires pour un seul envoi", null, "PUSH_TOO_MANY");
  }

  const { appId, apiKey, baseUrl, dryRun, timeoutMs } = getConfig().push;

  if (dryRun) {
    logger.info({ targets: targets.length, title, body, data }, "Push dry run");
    return { id: "dry-run", recipients: targets.length, status: "DryRun" };
  }

  if (!appId || !apiKey) {
    logger.error("OneSignal is not configured");
    throw unavailable();
  }

  let response;
  try {
    response = await fetch(`${baseUrl}/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(
        buildBody({
          appId,
          userIds: bySubscription ? undefined : targets,
          subscriptionIds: bySubscription ? targets : undefined,
          title,
          body,
          data,
          ttl,
          priority,
          idempotencyKey,
        }),
      ),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    logger.error({ targets: targets.length, reason: err.message }, "Push provider request failed");
    throw unavailable();
  }

  const payload = await response.json().catch(() => ({}));

  if (response.status === 429 || response.status >= 500) {
    logger.error({ status: response.status, payload }, "Push provider unavailable");
    throw unavailable();
  }

  if (!response.ok) {
    logger.error({ status: response.status, errors: payload.errors }, "Push rejected by provider");
    throw AppError.badRequest("Notification refusée par le fournisseur", null, "PUSH_REJECTED");
  }

  if (!payload.id) {
    logger.info({ targets: targets.length }, "Push skipped, no subscribed device");
    return { id: null, recipients: 0, status: "NoSubscribers" };
  }

  logger.info({ id: payload.id, targets: targets.length }, "Push sent");
  return { id: payload.id, recipients: payload.recipients ?? targets.length, status: "Sent" };
}

module.exports = { sendPush };
