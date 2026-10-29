import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const config = {
  apiBaseUrl: "https://api.test",
  auth: { accessSecret: "a".repeat(40) },
  marketing: { linkSecret: "marketing-secret", from: "", perMinute: 120, maxRecipients: 1000, smtp: null },
  mail: {
    supportEmail: "support@swiftgoma.test",
    logoUrl: "https://cdn.test/logo.png",
    logoWidth: 140,
    logoHeight: 40,
    privacyUrl: "https://swiftgoma.test/privacy",
  },
};
const envMock = { "config/env.config.js": { getConfig: () => config } };

// ---------------------------------------------------------------- signed links, composition
describe("signed email links", () => {
  const links = loadWithMocks("features/marketing/services/links.js", envMock);

  it("round-trips a payload and rejects tampering", () => {
    const token = links.sign({ t: "c", u: "https://example.com" });
    expect(links.verify(token)).toEqual({ t: "c", u: "https://example.com" });

    const [body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "c", u: "https://evil.test" })).toString("base64url");
    expect(links.verify(`${forged}.${signature}`)).toBeNull();
    expect(links.verify(`${body}.${signature}x`)).toBeNull();
    expect(links.verify("garbage")).toBeNull();
    expect(links.verify(undefined)).toBeNull();
  });

  it("builds public URLs under the API", () => {
    expect(links.openUrl("abc")).toBe("https://api.test/api/v1/marketing/p/o/abc");
    expect(links.clickUrl("abc")).toBe("https://api.test/api/v1/marketing/p/c/abc");
    expect(links.unsubscribeUrl("abc")).toBe("https://api.test/api/v1/marketing/p/u/abc");
  });
});

describe("campaign email composition", () => {
  const links = loadWithMocks("features/marketing/services/links.js", envMock);
  const { composeCampaignEmail } = loadWithMocks("features/marketing/services/compose.js", envMock);

  const campaign = {
    id: "camp-1",
    subject: "Bonjour {{firstName}} !",
    preheader: "Promo pour {{name}}",
    html: '<p>Salut {{name}}</p><a href="https://swiftgoma.test/promo?a=1&amp;b=2">Voir</a>',
    text: null,
  };
  const recipient = { id: "rec-1", email: "a@x.test", name: "Alice Mukendi" };

  it("personalises, tracks links, adds an open pixel and unsubscribe headers", () => {
    const { subject, html, text, headers } = composeCampaignEmail({ campaign, recipient });

    expect(subject).toBe("Bonjour Alice !");
    expect(html).toContain("Salut Alice Mukendi");
    expect(html).not.toContain('href="https://swiftgoma.test/promo');
    expect(html).toContain("/api/v1/marketing/p/c/");
    expect(html).toContain("/api/v1/marketing/p/o/");
    expect(html).toContain("Se désabonner");
    expect(text).toContain("Se désabonner :");
    expect(headers["List-Unsubscribe"]).toMatch(/^<https:\/\/api\.test\/api\/v1\/marketing\/p\/u\/.+>, <mailto:/);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("keeps the real destination (decoded) inside the signed click token", () => {
    const { html } = composeCampaignEmail({ campaign, recipient });
    const token = html.match(/\/marketing\/p\/c\/([^"]+)"/)[1];
    expect(links.verify(token)).toMatchObject({
      t: "c",
      c: "camp-1",
      r: "rec-1",
      u: "https://swiftgoma.test/promo?a=1&b=2",
    });
  });

  it("does not track the unsubscribe link, and a preview carries no tracking at all", () => {
    const real = composeCampaignEmail({ campaign, recipient });
    expect(real.html.match(/\/marketing\/p\/u\//g)).toHaveLength(1);

    const preview = composeCampaignEmail({ campaign, recipient, preview: true });
    expect(preview.subject.startsWith("[TEST] ")).toBe(true);
    expect(preview.html).not.toContain("/marketing/p/o/");
    expect(preview.html).toContain("https://swiftgoma.test/promo?a=1&amp;b=2");
  });

  it("cannot be hijacked through the recipient's name", () => {
    const { html } = composeCampaignEmail({
      campaign,
      recipient: { ...recipient, name: '<img src=x onerror="alert(1)">' },
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("makes a text version from the HTML when none is given", () => {
    const { text } = composeCampaignEmail({ campaign, recipient });
    expect(text).toContain("Salut Alice Mukendi");
    expect(text).not.toContain("<p>");
  });
});

describe("tracking", () => {
  const create = vi.fn(async () => ({}));
  const links = loadWithMocks("features/marketing/services/links.js", envMock);
  const tracking = loadWithMocks("features/marketing/services/tracking.service.js", {
    ...envMock,
    "core/db/prisma.js": { getPrisma: () => ({ trackingEvent: { create } }) },
  });

  beforeEach(() => create.mockClear());

  it("serves a real GIF", () => {
    expect(tracking.PIXEL.subarray(0, 6).toString()).toBe("GIF89a");
  });

  it("only follows links that were signed into an email, and only http(s)", async () => {
    const good = links.sign({ t: "c", c: "camp", r: "rec", u: "https://swiftgoma.test/x" });
    expect(await tracking.resolveClick(good, "UA")).toBe("https://swiftgoma.test/x");
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ campaignId: "camp", recipientId: "rec", type: "CLICK" }),
    });

    create.mockClear();
    const script = links.sign({ t: "c", c: "camp", r: "rec", u: "javascript:alert(1)" });
    expect(await tracking.resolveClick(script)).toBeNull();
    expect(await tracking.resolveClick("forged.token")).toBeNull();
    const wrongType = links.sign({ t: "o", c: "camp", r: "rec", u: "https://swiftgoma.test" });
    expect(await tracking.resolveClick(wrongType)).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("still redirects when saving the event fails", async () => {
    create.mockRejectedValueOnce(new Error("db down"));
    const token = links.sign({ t: "c", c: "camp", r: "rec", u: "https://swiftgoma.test/y" });
    expect(await tracking.resolveClick(token)).toBe("https://swiftgoma.test/y");
  });

  it("records opens only for valid open tokens", async () => {
    expect(await tracking.recordOpen(links.sign({ t: "o", c: "camp", r: "rec" }), "UA")).toBe(true);
    expect(await tracking.recordOpen(links.sign({ t: "c", c: "camp" }))).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------- unsubscribe
describe("unsubscribe", () => {
  const prisma = {
    emailSuppression: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) },
    notificationSettings: { updateMany: vi.fn(async () => ({})) },
    trackingEvent: { create: vi.fn(async () => ({})) },
  };
  const service = loadWithMocks("features/marketing/services/unsubscribe.service.js", {
    "core/db/prisma.js": { getPrisma: () => prisma },
  });

  beforeEach(() => vi.clearAllMocks());

  it("suppresses the address, switches consent off, and never overwrites a stronger reason", async () => {
    await service.unsubscribeEmail({ email: " A@X.test ", campaignId: "camp", recipientId: "rec" });
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith({
      where: { email: "a@x.test" },
      create: { email: "a@x.test", reason: "UNSUBSCRIBED", source: "link" },
      update: {},
    });
    expect(prisma.notificationSettings.updateMany).toHaveBeenCalledWith({
      where: { user: { email: "a@x.test" } },
      data: { marketingEmailOptIn: false, marketingEmailOptedAt: null },
    });
    expect(prisma.trackingEvent.create).toHaveBeenCalled();
  });

  it("ignores empty addresses and survives a missing campaign", async () => {
    expect(await service.unsubscribeEmail({ email: "  " })).toEqual({ unsubscribed: false });
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();

    prisma.trackingEvent.create.mockRejectedValueOnce(new Error("fk"));
    await expect(service.unsubscribeEmail({ email: "a@x.test", campaignId: "gone" })).resolves.toEqual({
      unsubscribed: true,
    });
  });

  it("lets a person opt back in without lifting bounces or complaints", async () => {
    await service.allowEmailAgain("A@X.test");
    expect(prisma.emailSuppression.deleteMany).toHaveBeenCalledWith({
      where: { email: "a@x.test", reason: "UNSUBSCRIBED" },
    });
  });
});

describe("public email links controller", () => {
  const unsubscribeEmail = vi.fn(async () => ({}));
  const links = loadWithMocks("features/marketing/services/links.js", envMock);
  const tracking = { PIXEL: Buffer.from("GIF89a"), recordOpen: vi.fn(), resolveClick: vi.fn() };
  const controller = loadWithMocks("features/marketing/controllers/public.controller.js", {
    ...envMock,
    "features/marketing/services/tracking.service.js": tracking,
    "features/marketing/services/unsubscribe.service.js": { unsubscribeEmail },
  });

  const response = () => {
    const res = { status: vi.fn(() => res), set: vi.fn(() => res), type: vi.fn(() => res), send: vi.fn(() => res), redirect: vi.fn(() => res) };
    return res;
  };

  beforeEach(() => vi.clearAllMocks());

  it("asks for confirmation on GET and only unsubscribes on POST", async () => {
    const token = links.sign({ t: "u", e: "a@x.test", c: "camp", r: "rec" });

    const page = response();
    controller.unsubscribePage({ params: { token } }, page);
    expect(page.status).toHaveBeenCalledWith(200);
    expect(page.send.mock.calls[0][0]).toContain("<form");
    expect(unsubscribeEmail).not.toHaveBeenCalled();

    const done = response();
    await controller.unsubscribe({ params: { token } }, done, vi.fn());
    expect(unsubscribeEmail).toHaveBeenCalledWith({ email: "a@x.test", campaignId: "camp", recipientId: "rec" });
    expect(done.send.mock.calls[0][0]).toContain("Désabonnement confirmé");
  });

  it("rejects links that are not unsubscribe tokens", async () => {
    const res = response();
    await controller.unsubscribe({ params: { token: links.sign({ t: "c", u: "https://x.test" }) } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(unsubscribeEmail).not.toHaveBeenCalled();
  });

  it("redirects clicks and 404s on bad ones", async () => {
    tracking.resolveClick.mockResolvedValueOnce("https://swiftgoma.test/promo");
    const ok = response();
    await controller.click({ params: { token: "t" }, get: () => "UA" }, ok, vi.fn());
    expect(ok.redirect).toHaveBeenCalledWith(302, "https://swiftgoma.test/promo");

    tracking.resolveClick.mockResolvedValueOnce(null);
    const bad = response();
    await controller.click({ params: { token: "t" }, get: () => "UA" }, bad, vi.fn());
    expect(bad.status).toHaveBeenCalledWith(404);
  });
});

// ---------------------------------------------------------------- audience rules
describe("segment audience", () => {
  const segments = loadWithMocks("features/marketing/services/segment.service.js", {
    "core/db/prisma.js": { getPrisma: () => ({}) },
  });
  const now = new Date("2026-10-29T12:00:00Z");

  it("always limits the audience to opted-in, verified, active customers", () => {
    const where = segments.buildAudienceWhere({}, now);
    expect(where).toMatchObject({
      status: "ACTIVE",
      role: { in: ["BUYER", "SELLER", "RIDER"] },
      email: { not: null },
      emailVerifiedAt: { not: null },
      notificationSettings: { is: { marketingEmailOptIn: true } },
    });
  });

  it("never lets staff roles in, whatever the rules say", () => {
    const where = segments.buildAudienceWhere({ roles: ["ADMIN", "SUPPORT", "SELLER"] }, now);
    expect(where.role).toEqual({ in: ["SELLER"] });
    expect(segments.buildAudienceWhere({ roles: ["ADMIN"] }, now).role).toEqual({
      in: ["BUYER", "SELLER", "RIDER"],
    });
  });

  it("translates activity, platform and city rules", () => {
    const where = segments.buildAudienceWhere(
      {
        platforms: ["ANDROID"],
        cities: ["Goma"],
        lastLoginWithinDays: 30,
        inactiveForDays: 90,
        signedUpWithinDays: 7,
        verificationStatuses: ["APPROVED"],
      },
      now,
    );
    expect(where.sessions.some.platform).toEqual({ in: ["ANDROID"] });
    expect(where.sessions.some.OR[0].city).toEqual({ equals: "Goma", mode: "insensitive" });
    expect(where.verificationStatus).toEqual({ in: ["APPROVED"] });
    expect(where.AND).toContainEqual({ lastLoginAt: { gte: new Date("2026-09-29T12:00:00Z") } });
    expect(where.AND).toContainEqual({ createdAt: { gte: new Date("2026-10-22T12:00:00Z") } });
    expect(where.AND).toContainEqual({
      OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: new Date("2026-07-31T12:00:00Z") } }],
    });
  });

  it("walks the audience page by page with a cursor", async () => {
    const pages = [
      Array.from({ length: 2 }, (_, i) => ({ id: `u${i}`, email: `${i}@x.test`, name: null })),
      [{ id: "u2", email: "2@x.test", name: null }],
    ];
    const findMany = vi.fn(async () => pages.shift() ?? []);
    const { iterateAudience } = loadWithMocks("features/marketing/services/segment.service.js", {
      "core/db/prisma.js": { getPrisma: () => ({ user: { findMany } }) },
    });

    const seen = [];
    for await (const page of iterateAudience({}, 2)) seen.push(...page.map((u) => u.id));
    expect(seen).toEqual(["u0", "u1", "u2"]);
    expect(findMany.mock.calls[1][0]).toMatchObject({ skip: 1, cursor: { id: "u1" } });
  });
});

// ---------------------------------------------------------------- templates
describe("email templates", () => {
  let template;
  const operations = [];
  const prisma = {
    emailTemplate: {
      findUnique: vi.fn(async () => template),
      update: vi.fn((args) => ({ op: "template", args })),
    },
    emailTemplateVersion: { create: vi.fn((args) => ({ op: "version", args })) },
    $transaction: vi.fn(async (ops) => operations.push(...ops)),
  };
  const service = loadWithMocks("features/marketing/services/template.service.js", {
    "core/db/prisma.js": { getPrisma: () => prisma },
  });

  beforeEach(() => {
    operations.length = 0;
    vi.clearAllMocks();
    template = {
      id: "t1",
      key: "welcome",
      currentVersion: 2,
      versions: [
        { version: 2, subject: "Salut", preheader: null, html: "<p>v2</p>", text: null },
        { version: 1, subject: "Old", preheader: null, html: "<p>v1</p>", text: null },
      ],
    };
  });

  it("creates a new version when the content changes, keeping untouched fields", async () => {
    await service.updateTemplate("welcome", { html: "<p>v3</p>" }, "admin");
    const created = operations.find((o) => o.op === "version").args.data;
    expect(created).toMatchObject({ version: 3, subject: "Salut", html: "<p>v3</p>", createdBy: "admin" });
    expect(operations.find((o) => o.op === "template").args.data.currentVersion).toBe(3);
  });

  it("does not create a version for a rename", async () => {
    await service.updateTemplate("welcome", { name: "Nouveau nom" }, "admin");
    expect(operations.some((o) => o.op === "version")).toBe(false);
    expect(operations[0].args.data).toEqual({ name: "Nouveau nom" });
  });

  it("rejects a duplicate key and an unknown template", async () => {
    await expect(service.createTemplate({ key: "welcome", name: "x", subject: "s", html: "<p>h</p>" }, "a")).rejects.toMatchObject({
      status: 409,
    });
    template = null;
    await expect(service.getTemplate("nope")).rejects.toMatchObject({ status: 404 });
  });
});

// ---------------------------------------------------------------- campaigns
describe("campaign lifecycle", () => {
  let campaign;
  const prisma = {
    campaign: {
      findUnique: vi.fn(async () => campaign),
      create: vi.fn(async ({ data }) => ({ id: "c-new", ...data })),
      update: vi.fn(async ({ data }) => ({ ...campaign, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      delete: vi.fn(async () => ({})),
    },
    campaignRecipient: { updateMany: vi.fn(async () => ({ count: 3 })) },
    user: { findUnique: vi.fn(async () => ({ name: "Admin", email: "admin@x.test", emailVerifiedAt: new Date() })) },
  };
  const segments = {
    previewAudience: vi.fn(async () => ({ count: 10, sample: [] })),
    getSegment: vi.fn(async () => ({ id: "seg", rules: { roles: ["BUYER"] } })),
  };
  const templates = {
    getVersion: vi.fn(async () => ({ version: 4, subject: "T", preheader: "p", html: "<p>t</p>", text: null })),
  };
  const queueCampaignStart = vi.fn(async () => undefined);
  const sendMarketingMail = vi.fn(async () => ({ messageId: "m1" }));

  const service = loadWithMocks("features/marketing/services/campaign.service.js", {
    ...envMock,
    "core/db/prisma.js": { getPrisma: () => prisma },
    "core/queue/marketing.js": { queueCampaignStart },
    "core/mail/mailer.js": { sendMarketingMail },
    "features/marketing/services/segment.service.js": segments,
    "features/marketing/services/template.service.js": templates,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    campaign = { id: "c1", status: "DRAFT", segmentId: "seg", subject: "S", html: "<p>h</p>", preheader: null, text: null };
    segments.previewAudience.mockResolvedValue({ count: 10, sample: [] });
    prisma.campaign.updateMany.mockResolvedValue({ count: 1 });
  });

  it("copies a template's current content into the campaign", async () => {
    await service.createCampaign({ name: "Promo", templateKey: "welcome" }, "admin");
    expect(prisma.campaign.create.mock.calls[0][0].data).toMatchObject({
      templateKey: "welcome",
      templateVersion: 4,
      subject: "T",
      html: "<p>t</p>",
      createdBy: "admin",
    });
  });

  it("only edits and deletes drafts (deletes cancelled ones too)", async () => {
    campaign.status = "SENT";
    await expect(service.updateCampaign("c1", { name: "x" })).rejects.toMatchObject({ code: "CAMPAIGN_NOT_EDITABLE" });
    await expect(service.deleteCampaign("c1")).rejects.toMatchObject({ code: "CAMPAIGN_NOT_DELETABLE" });
    campaign.status = "CANCELLED";
    await expect(service.deleteCampaign("c1")).resolves.toEqual({ id: "c1" });
  });

  it("refuses to schedule too soon, to an empty audience, or to a huge one", async () => {
    await expect(service.scheduleCampaign("c1", new Date(Date.now() + 5000))).rejects.toMatchObject({ code: "INVALID_SCHEDULE" });

    segments.previewAudience.mockResolvedValueOnce({ count: 0, sample: [] });
    await expect(service.scheduleCampaign("c1", new Date(Date.now() + 3_600_000))).rejects.toMatchObject({ code: "EMPTY_AUDIENCE" });

    segments.previewAudience.mockResolvedValueOnce({ count: 5000, sample: [] });
    await expect(service.scheduleCampaign("c1", new Date(Date.now() + 3_600_000))).rejects.toMatchObject({ code: "AUDIENCE_TOO_LARGE" });
    expect(prisma.campaign.updateMany).not.toHaveBeenCalled();
  });

  it("schedules, and sends now by queueing the start", async () => {
    const when = new Date(Date.now() + 3_600_000);
    expect(await service.scheduleCampaign("c1", when)).toMatchObject({ status: "SCHEDULED", audience: 10 });
    expect(queueCampaignStart).not.toHaveBeenCalled();

    expect(await service.sendCampaignNow("c1")).toMatchObject({ status: "SCHEDULED" });
    expect(queueCampaignStart).toHaveBeenCalledWith("c1");
  });

  it("does not schedule a campaign that already moved on", async () => {
    prisma.campaign.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.sendCampaignNow("c1")).rejects.toMatchObject({ code: "CAMPAIGN_NOT_SCHEDULABLE" });
    expect(queueCampaignStart).not.toHaveBeenCalled();
  });

  it("cancels and skips what is still pending", async () => {
    campaign.status = "SENDING";
    expect(await service.cancelCampaign("c1")).toEqual({ id: "c1", status: "CANCELLED" });
    expect(prisma.campaignRecipient.updateMany).toHaveBeenCalledWith({
      where: { campaignId: "c1", status: "PENDING" },
      data: { status: "SKIPPED", skipReason: "cancelled" },
    });

    prisma.campaign.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.cancelCampaign("c1")).rejects.toMatchObject({ code: "CAMPAIGN_NOT_CANCELLABLE" });
  });

  it("sends a test to the admin's own verified address only", async () => {
    const result = await service.sendTest("c1", "admin");
    expect(result.sentTo).toBe("a***@x.test");
    expect(sendMarketingMail.mock.calls[0][0]).toMatchObject({ to: "admin@x.test" });
    expect(sendMarketingMail.mock.calls[0][0].subject.startsWith("[TEST]")).toBe(true);

    prisma.user.findUnique.mockResolvedValueOnce({ email: "admin@x.test", emailVerifiedAt: null });
    await expect(service.sendTest("c1", "admin")).rejects.toMatchObject({ code: "CONTACT_NOT_AVAILABLE" });
  });
});

// ---------------------------------------------------------------- sending engine
describe("campaign sending", () => {
  const state = { campaigns: new Map(), recipients: [], suppressed: new Set(), optedIn: new Set() };
  let audience = [];

  const matches = (value, filter) => (filter?.in ? filter.in.includes(value) : value === filter);
  const prisma = {
    campaign: {
      updateMany: vi.fn(async ({ where, data }) => {
        const found = [...state.campaigns.values()].filter(
          (c) => (!where.id || c.id === where.id) && (!where.status || matches(c.status, where.status)),
        );
        found.forEach((c) => Object.assign(c, data));
        return { count: found.length };
      }),
      findUnique: vi.fn(async ({ where }) => state.campaigns.get(where.id) ?? null),
      update: vi.fn(async ({ where, data }) => Object.assign(state.campaigns.get(where.id), data)),
      findMany: vi.fn(async ({ where }) =>
        [...state.campaigns.values()].filter((c) => {
          if (where.status !== c.status) return false;
          if (where.scheduledAt) return c.scheduledAt <= where.scheduledAt.lte;
          return c.updatedAt < where.updatedAt.lt;
        }),
      ),
    },
    campaignRecipient: {
      createMany: vi.fn(async ({ data }) => {
        state.recipients.push(...data.map((d, i) => ({ id: `r${state.recipients.length + i}`, ...d })));
        return { count: data.length };
      }),
      findMany: vi.fn(async ({ where, take }) =>
        state.recipients.filter((r) => r.campaignId === where.campaignId && r.status === where.status).slice(0, take),
      ),
      update: vi.fn(async ({ where, data }) =>
        Object.assign(state.recipients.find((r) => r.id === where.id), data),
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        const found = state.recipients.filter((r) => r.campaignId === where.campaignId && r.status === where.status);
        found.forEach((r) => Object.assign(r, data));
        return { count: found.length };
      }),
      groupBy: vi.fn(async ({ where }) => {
        const counts = {};
        state.recipients.filter((r) => r.campaignId === where.campaignId).forEach((r) => {
          counts[r.status] = (counts[r.status] ?? 0) + 1;
        });
        return Object.entries(counts).map(([status, total]) => ({ status, _count: { _all: total } }));
      }),
    },
    emailSuppression: {
      findMany: vi.fn(async ({ where }) =>
        where.email.in.filter((e) => state.suppressed.has(e)).map((email) => ({ email })),
      ),
    },
    notificationSettings: {
      findMany: vi.fn(async ({ where }) =>
        where.userId.in.filter((id) => state.optedIn.has(id)).map((userId) => ({ userId })),
      ),
    },
  };

  const queueCampaignStart = vi.fn(async () => undefined);
  const queueCampaignBatch = vi.fn(async () => undefined);
  const sendMarketingMail = vi.fn(async () => ({ messageId: "m-1" }));

  const sender = loadWithMocks("features/marketing/services/sender.service.js", {
    ...envMock,
    "core/db/prisma.js": { getPrisma: () => prisma },
    "core/mail/mailer.js": { sendMarketingMail },
    "core/queue/marketing.js": { queueCampaignStart, queueCampaignBatch },
    "features/marketing/services/segment.service.js": {
      iterateAudience: async function* () {
        yield audience;
      },
    },
  });

  const makeUsers = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `u${i}`, email: `User${i}@X.test`, name: `User ${i}` }));
  const seed = (overrides = {}) => {
    state.campaigns.set("c1", {
      id: "c1",
      status: "SCHEDULED",
      segment: { rules: {} },
      subject: "S",
      html: "<p>Hi</p>",
      preheader: null,
      text: null,
      recipientCount: 0,
      updatedAt: new Date(),
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state.campaigns.clear();
    state.recipients.length = 0;
    state.suppressed.clear();
    state.optedIn.clear();
    config.marketing.perMinute = 120;
    config.marketing.maxRecipients = 1000;
    audience = makeUsers(3);
    audience.forEach((u) => state.optedIn.add(u.id));
    seed();
  });

  it("freezes the audience, skipping suppressed addresses, and queues the first batch", async () => {
    state.suppressed.add("user1@x.test");
    expect(await sender.startCampaign({ campaignId: "c1" })).toEqual({ status: "started", recipients: 3 });

    expect(state.campaigns.get("c1")).toMatchObject({ status: "SENDING", recipientCount: 3 });
    expect(state.recipients.map((r) => [r.email, r.status, r.skipReason])).toEqual([
      ["user0@x.test", "PENDING", null],
      ["user1@x.test", "SKIPPED", "suppressed"],
      ["user2@x.test", "PENDING", null],
    ]);
    expect(queueCampaignBatch).toHaveBeenCalledWith("c1");
  });

  it("starts a campaign only once", async () => {
    await sender.startCampaign({ campaignId: "c1" });
    expect(await sender.startCampaign({ campaignId: "c1" })).toEqual({ status: "not_scheduled" });
    expect(queueCampaignBatch).toHaveBeenCalledTimes(1);
  });

  it("fails a campaign whose audience grows past the limit", async () => {
    config.marketing.maxRecipients = 2;
    expect(await sender.startCampaign({ campaignId: "c1" })).toEqual({ status: "failed" });
    expect(state.campaigns.get("c1").status).toBe("FAILED");
    expect(queueCampaignBatch).not.toHaveBeenCalled();
  });

  it("finishes straight away when everybody is suppressed", async () => {
    audience.forEach((u) => state.suppressed.add(u.email.toLowerCase()));
    expect(await sender.startCampaign({ campaignId: "c1" })).toEqual({ status: "empty" });
    expect(state.campaigns.get("c1").status).toBe("SENT");
  });

  it("sends a batch, counts results, and finishes when nothing is pending", async () => {
    await sender.startCampaign({ campaignId: "c1" });
    const result = await sender.sendBatch({ campaignId: "c1" });

    expect(result.status).toBe("finished");
    expect(sendMarketingMail).toHaveBeenCalledTimes(3);
    expect(sendMarketingMail.mock.calls[0][0]).toMatchObject({ to: "user0@x.test" });
    expect(state.campaigns.get("c1")).toMatchObject({ status: "SENT", sentCount: 3, failedCount: 0 });
  });

  it("keeps going in paced batches until everyone is done", async () => {
    audience = makeUsers(120);
    audience.forEach((u) => state.optedIn.add(u.id));
    config.marketing.perMinute = 60;
    await sender.startCampaign({ campaignId: "c1" });

    const first = await sender.sendBatch({ campaignId: "c1" });
    expect(first).toEqual({ status: "continues", pending: 70 });
    expect(sendMarketingMail).toHaveBeenCalledTimes(50);
    expect(queueCampaignBatch).toHaveBeenLastCalledWith("c1", Math.ceil((50 / 60) * 60_000));
    expect(state.campaigns.get("c1").status).toBe("SENDING");
  });

  it("re-checks consent at send time", async () => {
    await sender.startCampaign({ campaignId: "c1" });
    state.suppressed.add("user0@x.test");
    state.optedIn.delete("u1");

    await sender.sendBatch({ campaignId: "c1" });
    expect(sendMarketingMail).toHaveBeenCalledTimes(1);
    expect(state.recipients.map((r) => r.skipReason)).toEqual(["suppressed", "opted_out", null]);
  });

  it("records a failed email and carries on", async () => {
    await sender.startCampaign({ campaignId: "c1" });
    sendMarketingMail.mockRejectedValueOnce(new Error("mailbox full"));
    await sender.sendBatch({ campaignId: "c1" });

    expect(state.recipients[0]).toMatchObject({ status: "FAILED", error: "mailbox full" });
    expect(state.campaigns.get("c1")).toMatchObject({ sentCount: 2, failedCount: 1 });
  });

  it("does nothing for a cancelled campaign", async () => {
    await sender.startCampaign({ campaignId: "c1" });
    state.campaigns.get("c1").status = "CANCELLED";
    expect(await sender.sendBatch({ campaignId: "c1" })).toEqual({ status: "stopped" });
    expect(sendMarketingMail).not.toHaveBeenCalled();
  });

  it("starts due campaigns and recovers stalled ones", async () => {
    seed({ scheduledAt: new Date(Date.now() - 1000) });
    state.campaigns.set("stalled", {
      id: "stalled",
      status: "SENDING",
      recipientCount: 5,
      updatedAt: new Date(Date.now() - 3_600_000),
    });
    state.campaigns.set("broken", {
      id: "broken",
      status: "SENDING",
      recipientCount: 0,
      updatedAt: new Date(Date.now() - 3_600_000),
    });

    expect(await sender.dispatchDue()).toEqual({ started: 1, recovered: 2 });
    expect(queueCampaignStart).toHaveBeenCalledWith("c1");
    expect(queueCampaignBatch).toHaveBeenCalledWith("stalled");
    expect(state.campaigns.get("broken").status).toBe("FAILED");
  });
});

// ---------------------------------------------------------------- analytics
describe("campaign analytics", () => {
  const prisma = {
    campaignRecipient: {
      groupBy: vi.fn(async () => [
        { status: "SENT", _count: { _all: 200 } },
        { status: "FAILED", _count: { _all: 5 } },
        { status: "SKIPPED", _count: { _all: 15 } },
      ]),
    },
    $queryRaw: vi.fn(async () => [
      { type: "OPEN", total: 150, uniq: 80 },
      { type: "CLICK", total: 60, uniq: 30 },
      { type: "UNSUBSCRIBE", total: 2, uniq: 2 },
    ]),
    trackingEvent: {
      groupBy: vi.fn(async () => [{ url: "https://swiftgoma.test/promo", _count: { _all: 40 } }]),
    },
  };
  const analytics = loadWithMocks("features/marketing/services/analytics.service.js", {
    "core/db/prisma.js": { getPrisma: () => prisma },
    "features/marketing/services/campaign.service.js": {
      getCampaign: async () => ({ id: "c1", name: "Promo", status: "SENT", recipientCount: 220 }),
    },
  });

  it("computes rates from what was actually sent", async () => {
    const stats = await analytics.campaignStats("c1");
    expect(stats.recipients).toEqual({ total: 220, sent: 200, failed: 5, skipped: 15, pending: 0 });
    expect(stats.engagement).toMatchObject({
      uniqueOpens: 80,
      uniqueClicks: 30,
      unsubscribes: 2,
      openRate: 40,
      clickRate: 15,
      unsubscribeRate: 1,
    });
    expect(stats.topLinks).toEqual([{ url: "https://swiftgoma.test/promo", clicks: 40 }]);
  });

  it("does not divide by zero", () => {
    expect(analytics.rate(5, 0)).toBe(0);
    expect(analytics.rate(1, 3)).toBe(33.33);
  });
});
