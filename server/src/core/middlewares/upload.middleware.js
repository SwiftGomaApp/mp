const multer = require("multer");
const { AppError } = require("../errors/AppError");

const SIGNATURES = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  "application/pdf": (b) => b.subarray(0, 5).toString("ascii") === "%PDF-",
};

function detectMimeType(buffer) {
  return Object.keys(SIGNATURES).find((type) => SIGNATURES[type](buffer)) ?? null;
}

function invalidType() {
  return new AppError(415, "INVALID_FILE_TYPE", "Format de fichier non pris en charge");
}

function fileUpload({ field, maxBytes, mimeTypes }) {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 5 },
    fileFilter: (req, file, cb) => {
      if (mimeTypes.includes(file.mimetype)) return cb(null, true);
      cb(invalidType());
    },
  }).single(field);

  function verify(req, res, next) {
    if (!req.file) {
      return next(AppError.badRequest("Aucun fichier fourni", undefined, "FILE_REQUIRED"));
    }

    const detected = detectMimeType(req.file.buffer);

    if (!detected || !mimeTypes.includes(detected)) return next(invalidType());

    req.file.mimetype = detected;
    next();
  }

  return [parse, verify];
}

module.exports = { fileUpload };
