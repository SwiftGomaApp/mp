const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { uploadFile, destroyFile } = require("../../../core/storage/cloudinary");
const { logActivity } = require("../../auth/services/activity.service");

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  avatarUrl: true,
  role: true,
  status: true,
  verificationStatus: true,
  createdAt: true,
};

const AVATAR_SIZE = 512;

function avatarPublicId(userId) {
  return folderPath("avatars", userId);
}

function toProfile(user) {
  const { emailVerifiedAt, phoneVerifiedAt, ...rest } = user;

  return {
    ...rest,
    emailVerified: Boolean(emailVerifiedAt),
    phoneVerified: Boolean(phoneVerifiedAt),
  };
}

async function loadActiveUser(userId) {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });

  if (!user || !user.status !== "ACTIVE") {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  return user;
}

async function getProfile(userId) {
  return toProfile(await loadActiveUser(userId));
}

async function updateProfile({ userId, name }, meta = {}) {
  const current = await loadActiveUser(userId);

  if (current.name === name) return toProfile(current);

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { name },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "PROFILE_UPDATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "name",
  });

  return toProfile(updated);
}

async function setAvatar({ userId, file }, meta = {}) {
  await loadActiveUser(userId);

  const uploaded = await uploadFile(file.buffer, {
    resourceType: "image",
    public_id: avatarPublicId(userId),
    overwrite: true,
    invalidate: true,
    transformation: [
      {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        crop: "fill",
        gravity: "face",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { avatarUrl: uploaded.url },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "AVATAR_CHANGED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "avatar",
    metadata: { action: "set" },
  });

  return toProfile(updated);
}

async function removeAvatar({ userId }, meta = {}) {
  const current = await loadActiveUser(userId);
  if (!current.avatarUrl) return toProfile(current);

  await destroyFile({ publicId: avatarPublicId(userId) });

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "AVATAR_CHANGED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "avatar",
    metadata: { action: "removed" },
  });

  return toProfile(updated);
}

module.exports = { getProfile, updateProfile, loadActiveUser, toProfile, setAvatar, removeAvatar };
