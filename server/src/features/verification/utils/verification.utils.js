const { verificationConfig: cfg } = require("../config/verification.config");

function normalizePlate(plate) {
  return String(plate ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

function allowedDocumentTypes(type) {
  const { required, optional } = cfg.documents[type];
  return [...required, ...optional];
}

function checkSubmission({ type, documents, vehicleType, plateNumber }) {
  const problems = [];
  const given = new Map(documents.map((d) => [d.type, d]));

  for (const t of given.keys()) {
    if (!allowedDocumentTypes(type).includes(t))
      problems.push({ code: "DOCUMENT_NOT_ALLOWED", field: t });
  }
  for (const t of cfg.documents[type].required) {
    if (!given.has(t)) problems.push({ code: "DOCUMENT_MISSING", field: t });
  }
  for (const t of cfg.expiryRequired) {
    if (given.has(t) && !given.get(t).expiresAt)
      problems.push({ code: "EXPIRY_REQUIRED", field: t });
  }
  // the tax number is optional for a seller: not everyone has one
  if (type === "RIDER") {
    if (!vehicleType) problems.push({ code: "VEHICLE_TYPE_REQUIRED", field: "vehicleType" });
    if (!plateNumber) problems.push({ code: "PLATE_REQUIRED", field: "plateNumber" });
  }
  return problems;
}

function canTransition(from, to) {
  return cfg.transitions[from]?.includes(to) ?? false;
}

function hasReachedPerson(calls) {
  return calls.some((c) => c.outcome === "REACHED");
}

function isExpiringSoon(expiresAt, now = new Date()) {
  return Boolean(expiresAt) && expiresAt.getTime() - now.getTime() <= cfg.expiryReminderMs;
}

function toPublicCase(c) {
  return {
    ...c,
    documents: c.documents?.map((d) =>
      Object.fromEntries(Object.entries(d).filter(([key]) => key !== "storageId")),
    ),
  };
}

module.exports = {
  normalizePlate,
  allowedDocumentTypes,
  checkSubmission,
  canTransition,
  hasReachedPerson,
  isExpiringSoon,
  toPublicCase,
};
