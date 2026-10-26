import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  alertsFor,
  authApi,
  bootApp,
  createUser,
  lastCode,
  loginByEmailOtp,
  prisma,
  resetState,
  shutdownApp,
  stepUpCode,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

async function signedIn(overrides) {
  const user = await createUser(overrides);
  const login = await loginByEmailOtp(user.email);
  return { user, token: login.body.accessToken, client: login.client };
}

async function requestContact(session, kind, value) {
  return session.client.post("/secondary-contacts/otp", {
    token: session.token,
    body: {
      kind,
      value,
      stepUpCode: await stepUpCode(session.client, session.token, session.user),
    },
  });
}

async function addContact(session, kind, value) {
  const request = await requestContact(session, kind, value);
  expect(request.status).toBe(200);
  return session.client.post("/secondary-contacts/verify", {
    token: session.token,
    body: { kind, value, code: await lastCode(value) },
  });
}

describe("recovery contacts", () => {
  it("starts empty and needs a session", async () => {
    const session = await signedIn();
    const list = await session.client.get("/secondary-contacts", { token: session.token });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ secondaryEmail: null, secondaryPhone: null });

    expect((await authApi().get("/secondary-contacts")).status).toBe(401);
  });

  it("adds a recovery email after a code sent to it", async () => {
    const session = await signedIn();
    const value = uniqueEmail("recovery");

    const added = await addContact(session, "EMAIL", value);
    expect(added.status).toBe(200);
    expect(added.body.verified).toBe(true);

    const stored = await prisma().user.findUnique({ where: { id: session.user.id } });
    expect(stored.secondaryEmail).toBe(value);
    expect(stored.secondaryEmailVerifiedAt).not.toBeNull();

    const event = await prisma().activityLog.findFirst({
      where: { userId: session.user.id, event: "SECONDARY_EMAIL_ADDED" },
    });
    expect(event).not.toBeNull();
  });

  it("adds a recovery phone number", async () => {
    const session = await signedIn();
    const value = uniquePhone();
    const added = await addContact(session, "PHONE", value);
    expect(added.status).toBe(200);
    const stored = await prisma().user.findUnique({ where: { id: session.user.id } });
    expect(stored.secondaryPhone).toBe(value);
  });

  it("warns the primary contact only once the change is confirmed", async () => {
    const session = await signedIn();
    const value = uniqueEmail("recovery");

    await requestContact(session, "EMAIL", value);
    expect(await alertsFor(session.user.email)).toHaveLength(0);

    await session.client.post("/secondary-contacts/verify", {
      token: session.token,
      body: { kind: "EMAIL", value, code: await lastCode(value) },
    });
    const alerts = await alertsFor(session.user.email);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].data.type).toBe("SECONDARY_CONTACT_ADDED");
  });

  it("requires a fresh code from the account holder", async () => {
    const session = await signedIn();
    const res = await session.client.post("/secondary-contacts/otp", {
      token: session.token,
      body: { kind: "EMAIL", value: uniqueEmail("recovery"), stepUpCode: "123456" },
    });
    expect(res.status).toBe(400);
  });

  it("must differ from the primary contacts", async () => {
    const phone = uniquePhone();
    const session = await signedIn({ phone, email: uniqueEmail() });

    const sameEmail = await requestContact(session, "EMAIL", session.user.email);
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.code).toBe("CONTACT_SAME_AS_PRIMARY");

    const samePhone = await requestContact(session, "PHONE", phone);
    expect(samePhone.status).toBe(409);
    expect(samePhone.body.error.code).toBe("CONTACT_SAME_AS_PRIMARY");
  });

  it("cannot belong to someone else", async () => {
    const other = await createUser();
    const session = await signedIn();

    const res = await requestContact(session, "EMAIL", other.email);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONTACT_ALREADY_IN_USE");

    await addContact(await signedIn(), "EMAIL", "shared@example.com");
    const again = await requestContact(session, "EMAIL", "shared@example.com");
    expect(again.status).toBe(409);
  });

  it("only accepts phone numbers from the DRC", async () => {
    const session = await signedIn();
    const res = await session.client.post("/secondary-contacts/otp", {
      token: session.token,
      body: { kind: "PHONE", value: "+33612345678", stepUpCode: "123456" },
    });
    expect(res.status).toBe(422);
  });

  it("rejects a wrong code and a different value than the one requested", async () => {
    const session = await signedIn();
    const value = uniqueEmail("recovery");
    await requestContact(session, "EMAIL", value);

    const wrong = await session.client.post("/secondary-contacts/verify", {
      token: session.token,
      body: { kind: "EMAIL", value, code: "000000" },
    });
    expect(wrong.status).toBe(400);

    const other = await session.client.post("/secondary-contacts/verify", {
      token: session.token,
      body: { kind: "EMAIL", value: uniqueEmail("elsewhere"), code: await lastCode(value) },
    });
    expect(other.status).toBe(400);
    expect(other.body.error.code).toBe("SECONDARY_CONTACT_REQUEST_EXPIRED");
  });

  it("replaces the contact when it is changed", async () => {
    const session = await signedIn();
    await addContact(session, "EMAIL", uniqueEmail("old"));
    const newValue = uniqueEmail("new");

    const changed = await addContact(session, "EMAIL", newValue);
    expect(changed.status).toBe(200);

    const stored = await prisma().user.findUnique({ where: { id: session.user.id } });
    expect(stored.secondaryEmail).toBe(newValue);
    expect(
      await prisma().activityLog.count({
        where: { userId: session.user.id, event: "SECONDARY_EMAIL_CHANGED" },
      }),
    ).toBe(1);
    const alerts = await alertsFor(session.user.email);
    expect(alerts.map((a) => a.data.type)).toContain("SECONDARY_CONTACT_CHANGED");
  });

  it("refuses to re-register the contact it already has", async () => {
    const session = await signedIn();
    const value = uniqueEmail("same");
    await addContact(session, "EMAIL", value);
    const res = await requestContact(session, "EMAIL", value);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SECONDARY_CONTACT_UNCHANGED");
  });

  it("removes a contact with a fresh code and alerts the primary contact", async () => {
    const session = await signedIn();
    await addContact(session, "EMAIL", uniqueEmail("gone"));

    const res = await session.client.post("/secondary-contacts/remove", {
      token: session.token,
      body: {
        kind: "EMAIL",
        stepUpCode: await stepUpCode(session.client, session.token, session.user),
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.secondaryEmail).toBeNull();

    const alerts = await alertsFor(session.user.email);
    expect(alerts.map((a) => a.data.type)).toContain("SECONDARY_CONTACT_REMOVED");
    expect(
      await prisma().activityLog.count({
        where: { userId: session.user.id, event: "SECONDARY_EMAIL_REMOVED" },
      }),
    ).toBe(1);
  });

  it("reports when there is nothing to remove", async () => {
    const session = await signedIn();
    const res = await session.client.post("/secondary-contacts/remove", {
      token: session.token,
      body: {
        kind: "PHONE",
        stepUpCode: await stepUpCode(session.client, session.token, session.user),
      },
    });
    expect(res.status).toBe(404);
  });
});
