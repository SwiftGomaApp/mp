const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");

const notFound = () => AppError.notFound("Modèle introuvable", "TEMPLATE_NOT_FOUND");

const CONTENT_FIELDS = ["subject", "preheader", "html", "text"];

async function createTemplate({ key, name, description, ...content }, actorId) {
  const prisma = getPrisma();

  if (await prisma.emailTemplate.findUnique({ where: { key }, select: { id: true } })) {
    throw AppError.conflict("Un modèle avec cette clé existe déjà", "TEMPLATE_KEY_TAKEN");
  }

  return prisma.emailTemplate.create({
    data: {
      key,
      name,
      description: description ?? null,
      createdBy: actorId,
      versions: {
        create: {
          version: 1,
          subject: content.subject,
          preheader: content.preheader ?? null,
          html: content.html,
          text: content.text ?? null,
          createdBy: actorId,
        },
      },
    },
    include: { versions: true },
  });
}

async function listTemplates({ page, limit }) {
  const prisma = getPrisma();
  const [items, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailTemplate.count(),
  ]);
  return { items, page, limit, total };
}

async function getTemplate(key) {
  const template = await getPrisma().emailTemplate.findUnique({
    where: { key },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!template) throw notFound();
  return template;
}

async function getVersion(key, version) {
  const template = await getPrisma().emailTemplate.findUnique({
    where: { key },
    select: { id: true, currentVersion: true },
  });
  if (!template) throw notFound();

  const found = await getPrisma().emailTemplateVersion.findUnique({
    where: {
      templateId_version: { templateId: template.id, version: version ?? template.currentVersion },
    },
  });
  if (!found) throw notFound();
  return found;
}

/** Every edit of the content creates a new version; campaigns keep the copy they were made from. */
async function updateTemplate(key, patch, actorId) {
  const prisma = getPrisma();
  const template = await getTemplate(key);
  const current = template.versions.find((v) => v.version === template.currentVersion);

  const touchesContent = CONTENT_FIELDS.some((field) => patch[field] !== undefined);
  const nextVersion = template.currentVersion + 1;

  const operations = [
    prisma.emailTemplate.update({
      where: { id: template.id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(touchesContent ? { currentVersion: nextVersion } : {}),
      },
    }),
  ];

  if (touchesContent) {
    const pick = (field) => (patch[field] !== undefined ? patch[field] : current[field]);
    operations.push(
      prisma.emailTemplateVersion.create({
        data: {
          templateId: template.id,
          version: nextVersion,
          subject: pick("subject"),
          preheader: pick("preheader"),
          html: pick("html"),
          text: pick("text"),
          createdBy: actorId,
        },
      }),
    );
  }

  await prisma.$transaction(operations);
  return getTemplate(key);
}

module.exports = { createTemplate, listTemplates, getTemplate, getVersion, updateTemplate };
