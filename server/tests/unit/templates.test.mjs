import { describe, expect, it } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const mail = {
  logoUrl: "https://cdn.example.com/logo.png",
  logoWidth: 140,
  logoHeight: 40,
  supportEmail: "support@swiftgoma.com",
  privacyUrl: "https://swiftgoma.com/privacy",
  activityUrl: "https://swiftgoma.com/compte/activite",
};
const config = { "config/env.config.js": { getConfig: () => ({ mail }) } };

const load = (name) => loadWithMocks(`core/mail/templates/${name}.js`, config);
const { escapeHtml } = load("escape");
const { otpTemplate } = load("otp.template");
const { loginAlertTemplate } = load("loginAlert.template");
const { securityAlertTemplate } = load("securityAlert.template");
const { welcomeTemplate } = load("welcome.template");
const { staffSetupTemplate } = load("staffSetup.template");
const { renderLayout, textFooter } = load("layout");

describe("escapeHtml", () => {
  it("neutralises markup and quotes", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });

  it("copes with missing values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("layout", () => {
  it("carries the logo, the help address, the privacy link and the year", () => {
    const html = renderLayout({ preheader: "Salut <b>", content: "<p>Bonjour</p>" });
    expect(html).toContain(mail.logoUrl);
    expect(html).toContain(`mailto:${mail.supportEmail}`);
    expect(html).toContain(mail.privacyUrl);
    expect(html).toContain(String(new Date().getFullYear()));
    expect(html).toContain("<p>Bonjour</p>");
    expect(html).toContain("Salut &lt;b&gt;");
  });

  it("has a plain-text footer too", () => {
    const footer = textFooter();
    expect(footer).toContain(mail.supportEmail);
    expect(footer).toContain(mail.privacyUrl);
  });
});

describe("code email", () => {
  it("shows the code and how long it lasts", () => {
    const { subject, html, text } = otpTemplate({
      name: "Alice",
      code: "123456",
      expiresMinutes: 10,
    });
    expect(subject).toBe("Votre code de confirmation SwiftGoma");
    for (const body of [html, text]) {
      expect(body).toContain("123456");
      expect(body).toContain("10 minutes");
    }
    expect(text).toContain("Bonjour Alice,");
  });

  it("uses the singular for one minute and greets anonymously without a name", () => {
    const { html, text } = otpTemplate({ code: "654321", expiresMinutes: 1 });
    expect(html).toContain("1 minute.");
    expect(html).not.toContain("1 minutes");
    expect(text.startsWith("Bonjour,")).toBe(true);
  });

  it("cannot be hijacked through the name", () => {
    const { html } = otpTemplate({
      name: '<img src=x onerror="alert(1)">',
      code: "111111",
      expiresMinutes: 5,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("new login alert", () => {
  const date = new Date("2026-10-26T10:30:00Z");

  it("lists the device, place and time in Goma's time zone", () => {
    const { html, text, subject } = loginAlertTemplate({
      name: "Alice",
      deviceName: "Tecno Spark",
      location: "Goma",
      country: "Congo-Kinshasa",
      date,
      activityUrl: mail.activityUrl,
    });
    expect(subject).toMatch(/Nouvelle connexion/);
    for (const body of [html, text]) {
      expect(body).toContain("Tecno Spark");
      expect(body).toContain("Goma");
      expect(body).toContain("12:30");
      expect(body).toContain("26 octobre 2026");
      expect(body).toContain(mail.activityUrl);
    }
  });

  it("escapes the device name chosen by the visitor", () => {
    const { html } = loginAlertTemplate({
      deviceName: "<b>evil</b>",
      location: "Goma",
      country: null,
      date,
      activityUrl: mail.activityUrl,
    });
    expect(html).toContain("&lt;b&gt;evil&lt;/b&gt;");
  });
});

describe("security alert", () => {
  it.each([
    "PASSWORD_CHANGED",
    "TWO_FACTOR_DISABLED",
    "RECOVERY_REQUESTED",
    "SECONDARY_CONTACT_REMOVED",
  ])("explains %s and links to the activity page", (type) => {
    const { subject, html, text } = securityAlertTemplate({
      name: "Alice",
      type,
      date: new Date("2026-10-26T10:30:00Z"),
      activityUrl: mail.activityUrl,
    });
    expect(subject.length).toBeGreaterThan(10);
    expect(html).toContain(mail.activityUrl);
    expect(text).toContain(mail.activityUrl);
    expect(text).toContain("12:30");
  });

  it("uses a generic message for unknown events", () => {
    const { subject } = securityAlertTemplate({ type: "UNKNOWN", activityUrl: mail.activityUrl });
    expect(subject).toMatch(/Changement de sécurité/);
  });
});

describe("welcome email", () => {
  it.each([
    ["BUYER", "Comment acheter"],
    ["SELLER", "Comment vendre"],
    ["RIDER", "Comment livrer"],
    ["UNKNOWN", "Comment acheter"],
  ])("gives a %s the right guide", (role, title) => {
    const { html, text, subject } = welcomeTemplate({ name: "Alice", role });
    expect(subject).toBe("Bienvenue sur SwiftGoma MarketPlace");
    expect(html).toContain(title);
    expect(text).toContain(title);
    expect(text).toContain("Bienvenue Alice,");
  });

  it("tells riders about documents, the contract and shop requests", () => {
    const { text } = welcomeTemplate({ role: "RIDER" });
    expect(text).toMatch(/permis de conduire/);
    expect(text).toMatch(/contrat livreur/);
    expect(text).toMatch(/demande/);
    expect(text).toMatch(/24 heures/);
  });

  it("numbers the steps", () => {
    const { text } = welcomeTemplate({ role: "SELLER" });
    expect(text).toMatch(/^1\. Envoyez vos documents/m);
    expect(text).toMatch(/^6\. /m);
  });
});

describe("team setup email", () => {
  const data = {
    name: "Aline",
    email: "aline@swiftgoma.com",
    setupUrl: "https://admin.swiftgoma.com/activation?token=abc",
    expiresHours: 72,
  };

  it("gives the login, the link, the lifetime and the 2FA rules", () => {
    const { subject, html, text } = staffSetupTemplate(data);
    expect(subject).toBe("Votre compte Support SwiftGoma");
    for (const body of [html, text]) {
      expect(body).toContain("aline@swiftgoma.com");
      expect(body).toContain("72 heures");
      expect(body).toMatch(/Double vérification obligatoire/i);
      expect(body).toMatch(/codes de secours/);
    }
    expect(html).toContain('href="https://admin.swiftgoma.com/activation?token=abc"');
    expect(text).toContain("https://admin.swiftgoma.com/activation?token=abc");
  });

  it("escapes the link and the name", () => {
    const { html } = staffSetupTemplate({
      ...data,
      name: "<i>x</i>",
      setupUrl: 'https://a.example.com/?q="><script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;i&gt;");
  });
});
