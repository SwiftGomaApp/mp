const {
  uploadFile,
  destroyFile,
  signedDownloadUrl,
  folderPath,
} = require("../../../core/storage/cloudinary");
const { verificationConfig: cfg } = require("../config/verification.config");

const publicIdFor = (caseId, type) => folderPath("verification", caseId, type);

async function storeDocument({ buffer, caseId, type }) {
  const result = await uploadFile(buffer, {
    public_id: publicIdFor(caseId, type),
    type: "authenticated",
    overwrite: true,
    invalidate: true,
  });
  return result.publicId;
}

const removeStoredDocument = (storageId) =>
  destroyFile({ publicId: storageId, type: "authenticated" });

const documentViewUrl = (storageId) =>
  signedDownloadUrl({ publicId: storageId, ttlSeconds: cfg.signedUrlTtlSeconds });

module.exports = { storeDocument, removeStoredDocument, documentViewUrl };
