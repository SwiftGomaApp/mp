const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { randomToken, sha256 } = require("../../../core/crypto/crypto");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { queueOtpEmail, queueOtpSms } = require("../../../core/queue/notifications");
const { notify } = require("../../notifications/notify");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { revokeUserSessions } = require("./session.service");
const { revokeAllPasskeys } = require("./passkey.service");
const { verifySecondFactor } = require("./auth.service");

const GENERIC_MESSAGE =
  "Si un contact de récupération existe pour ce compte, un code y a été envoyé";

const codePurpose = `${OTP_PURPOSES.RECOVERY}:code`;
const contactPurpose = (requestId) => `${OTP_PURPOSES.RECOVERY}:contact:${requestId}`;

const FIELDS = {
  EMAIL: { primary: "email", primaryVerified: "emailVerifiedAt" },
  PHONE: { primary: "phone", primaryVerified: "phoneVerifiedAt" },
};

function invalidCode() {
  return AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");
}

function invalidRequest() {
  return AppError.badRequest(
    "Cette demande de récupération est invalide ou a expiré",
    undefined,
    "RECOVERY_INVALID",
  );
}

function normalize(kind, value) {
  const contact = String(value).trim();
  return kind === "EMAIL" ? contact.toLowerCase() : contact;
}

async function findAccount({ email, phone }) {
  const user = await getPrisma().user.findFirst({
    where: email
      ? { email, emailVerifiedAt: { not: null } }
      : { phone, phoneVerifiedAt: { not: null } },
    include: { totp: { select: { confirmedAt: true } } },
  });

  if (!user || user.status !== "ACTIVE" || authConfig.staffRoles.includes(user.role)) return null;
  return user;
}

function recoveryContact(user, kind) {
  const email = user.secondaryEmail && user.secondaryEmailVerifiedAt ? user.secondaryEmail : null;
  const phone = user.secondaryPhone && user.secondaryPhoneVerifiedAt ? user.secondaryPhone : null;

  if (kind === "EMAIL") return email ? { kind, value: email } : null;
  if (kind === "PHONE") return phone ? { kind, value: phone } : null;
  if (email) return { kind: "EMAIL", value: email };
  if (phone) return { kind: "PHONE", value: phone };
  return null;
}

async function sendCode({ kind, value }, name, purpose) {
  const { code, expiresMinutes } = await issueOtp({ purpose, target: value });
  const emailPurpose = purpose === codePurpose ? OTP_PURPOSES.RECOVERY : "recovery-contact";

  if (kind === "EMAIL") {
    await queueOtpEmail({ to: value, name, code, expiresMinutes, purpose: emailPurpose });
  } else {
    await queueOtpSms({ to: value, code, expiresMinutes });
  }

  return expiresMinutes;
}

// `user` is the account as it was before this step, so the warning reaches the contacts the
// owner had, even when a completed recovery has just replaced them.
async function notifyPrimaryContacts(user, type) {
  await notify({
    event: "security.recovery",
    userId: user.id,
    data: { type, date: new Date().toISOString() },
    contacts: {
      email: user.email && user.emailVerifiedAt ? user.email : null,
      phone: user.phone && user.phoneVerifiedAt ? user.phone : null,
    },
  });
}

async function requestRecovery({ email, phone, kind }, meta) {
  const user = await findAccount({ email, phone });
  const contact = user && recoveryContact(user, kind);

  if (contact) {
    try {
      await sendCode(contact, user.name, codePurpose);
      await logActivity({
        userId: user.id,
        event: "OTP_REQUESTED",
        method: contact.kind === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { purpose: OTP_PURPOSES.RECOVERY },
      });
    } catch (err) {
      if (!(err instanceof AppError && ["OTP_COOLDOWN", "OTP_HOURLY_LIMIT"].includes(err.code))) {
        throw err;
      }
    }
  }

  return { message: GENERIC_MESSAGE };
}

async function verifyRecoveryContact({ email, phone, kind, code }, meta) {
  const user = await findAccount({ email, phone });
  const contact = user && recoveryContact(user, kind);
  if (!contact) throw invalidCode();

  await verifyOtp({ purpose: codePurpose, target: contact.value, code });

  const prisma = getPrisma();
  const { primaryContactVetoWindowMs, completionWindowMs } = authConfig.recovery;
  const now = Date.now();
  const token = randomToken(32);
  const availableAt = new Date(now + primaryContactVetoWindowMs);
  const expiresAt = new Date(now + primaryContactVetoWindowMs + completionWindowMs);

  await prisma.accountRecoveryRequest.updateMany({
    where: { userId: user.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await prisma.accountRecoveryRequest.create({
    data: {
      userId: user.id,
      status: "PENDING",
      availableAt,
      expiresAt,
      verificationHash: sha256(token),
      verificationExpiresAt: expiresAt,
    },
  });

  await logActivity({
    userId: user.id,
    event: "ACCOUNT_RECOVERY_REQUESTED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { via: contact.kind },
  });
  await notifyPrimaryContacts(user, "RECOVERY_REQUESTED");

  return { recoveryToken: token, availableAt };
}

async function loadRequest(token) {
  const prisma = getPrisma();
  const request = await prisma.accountRecoveryRequest.findUnique({
    where: { verificationHash: sha256(token) },
    include: { user: { include: { totp: { select: { confirmedAt: true } } } } },
  });

  if (!request || request.status !== "PENDING") throw invalidRequest();

  if (request.expiresAt <= new Date()) {
    await prisma.accountRecoveryRequest.update({
      where: { id: request.id },
      data: { status: "EXPIRED" },
    });
    throw invalidRequest();
  }

  if (request.user.status !== "ACTIVE") throw invalidRequest();

  if (request.availableAt > new Date()) {
    throw new AppError(
      403,
      "RECOVERY_WAITING",
      "La récupération sera possible à la fin du délai de sécurité",
      { availableAt: request.availableAt },
    );
  }

  return request;
}

async function assertContactFree(contact) {
  const existing = await getPrisma().user.findFirst({
    where: {
      OR: [
        { email: contact },
        { phone: contact },
        { secondaryEmail: contact },
        { secondaryPhone: contact },
      ],
    },
    select: { id: true },
  });
  if (existing) {
    throw AppError.conflict(
      "Cet e-mail ou ce numéro est déjà associé à un compte",
      "CONTACT_ALREADY_IN_USE",
    );
  }
}

async function requestNewPrimaryContact({ token, kind, value }) {
  const request = await loadRequest(token);
  const contact = normalize(kind, value);

  await assertContactFree(contact);

  const expiresMinutes = await sendCode(
    { kind, value: contact },
    request.user.name,
    contactPurpose(request.id),
  );

  return { message: "Un code de vérification a été envoyé", kind, contact, expiresMinutes };
}

async function completeRecovery({ token, kind, value, code, backupCode }, meta) {
  const request = await loadRequest(token);
  const { user } = request;
  const contact = normalize(kind, value);

  if (user.totp?.confirmedAt && !backupCode) {
    throw AppError.forbidden(
      "Utilisez un code de secours pour terminer, ou contactez l'équipe SwiftGoma",
      "RECOVERY_BACKUP_CODE_REQUIRED",
    );
  }

  await assertContactFree(contact);
  await verifyOtp({ purpose: contactPurpose(request.id), target: contact, code });

  if (user.totp?.confirmedAt) {
    await verifySecondFactor(user.id, { backupCode }, meta, "recovery");
  }

  const fields = FIELDS[kind];
  const prisma = getPrisma();

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          [fields.primary]: contact,
          [fields.primaryVerified]: new Date(),
          passwordHash: null,
        },
      }),
      prisma.accountRecoveryRequest.update({
        where: { id: request.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Cet e-mail ou ce numéro est déjà associé à un compte",
        "CONTACT_ALREADY_IN_USE",
      );
    }
    throw err;
  }

  await revokeUserSessions(user.id, { reason: "ACCOUNT_RECOVERED" });
  await revokeAllPasskeys(user.id);

  await logActivity({
    userId: user.id,
    event: "ACCOUNT_RECOVERY_COMPLETED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { kind },
  });
  await notifyPrimaryContacts(user, "RECOVERY_COMPLETED");

  return { recovered: true };
}

async function cancelRecovery({ userId }, meta) {
  const { count } = await getPrisma().accountRecoveryRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) {
    throw AppError.notFound("Aucune récupération en cours", "RECOVERY_NOT_FOUND");
  }

  await logActivity({
    userId,
    event: "ACCOUNT_RECOVERY_CANCELLED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { cancelled: true };
}

module.exports = {
  requestRecovery,
  verifyRecoveryContact,
  requestNewPrimaryContact,
  completeRecovery,
  cancelRecovery,
};
