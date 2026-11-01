const { v2: cloudinary } = require("cloudinary");
const { getConfig } = require("../../config/env.config");
const { AppError } = require("../errors/AppError");
const { logger } = require("../logger/logger");

let configured = false;

function getClient() {
  const { cloudName, apiKey, apiSecret } = getConfig().media;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      503,
      "STORAGE_NOT_CONFIGURED",
      "Le stockage de fichiers n'est pas disponible",
    );
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

function folderPath(...parts) {
  return [getConfig().media.folder, ...parts].join("/");
}

function uploadFile(buffer, { resourceType = "image", ...options } = {}) {
  const client = getClient();

  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      { resource_type: resourceType, ...options },
      (err, result) => {
        if (err) {
          logger.error({ err }, "Cloudinary upload failed");
          return reject(
            new AppError(502, "STORAGE_UPLOAD_FAILED", "Impossible d'enregistrer le fichier"),
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          type: result.type,
          bytes: result.bytes,
        });
      },
    );

    stream.end(buffer);
  });
}

async function destroyFile({ publicId, resourceType = "image", type = "upload" }) {
  try {
    await getClient().uploader.destroy(publicId, {
      resource_type: resourceType,
      type,
      invalidate: true,
    });
  } catch (err) {
    logger.warn({ err, publicId }, "Cloudinary delete failed");
  }
}

function signedDownloadUrl({
  publicId,
  resourceType = "image",
  type = "authenticated",
  format = "",
  ttlSeconds = 120,
}) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  return getClient().utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type,
    expires_at: expiresAt,
    attachment: true,
  });
}

module.exports = { uploadFile, destroyFile, signedDownloadUrl, folderPath };
