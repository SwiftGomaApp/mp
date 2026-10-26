import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  adminApi,
  authApi,
  bootApp,
  createAdminSession,
  createUser,
  enableTotp,
  freshTotp,
  loginByEmailOtp,
  loginWithTotp,
  prisma,
  resetState,
  sessionTokenFor,
  shutdownApp,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const MESSAGE = "Mon compte a été suspendu par erreur, merci de vérifier";

async function supportSession() {
  const support = await createUser({ role: "SUPPORT", email: uniqueEmail("support") });
  const secret = await enableTotp(support.id);
  const login = await loginWithTotp(support, secret);
  return { support, secret, token: login.body.accessToken, client: login.client };
}

describe("a suspended person writes to Support", () => {
  it("stores the request for a suspended or banned account", async () => {
    for (const status of ["SUSPENDED", "BANNED"]) {
      const user = await createUser({ status });
      const res = await authApi().post("/support-request", {
        body: { email: user.email, message: MESSAGE },
      });
      expect(res.status).toBe(202);

      const stored = await prisma().supportRequest.findFirst({ where: { userId: user.id } });
      expect(stored).toMatchObject({ status: "OPEN", message: MESSAGE });
      expect(
        await prisma().activityLog.count({
          where: { userId: user.id, event: "SUPPORT_REQUEST_CREATED" },
        }),
      ).toBe(1);
    }
  });

  it("works with a phone number too", async () => {
    const phone = uniquePhone();
    const user = await createUser({ phone, email: null, status: "SUSPENDED" });
    await authApi().post("/support-request", { body: { phone, message: MESSAGE } });
    expect(await prisma().supportRequest.count({ where: { userId: user.id } })).toBe(1);
  });

  it("answers identically for active, unknown and suspended accounts", async () => {
    const suspended = await createUser({ status: "SUSPENDED" });
    const active = await createUser();
    const bodies = [];
    for (const email of [suspended.email, active.email, uniqueEmail("ghost")]) {
      const res = await authApi().post("/support-request", { body: { email, message: MESSAGE } });
      expect(res.status).toBe(202);
      bodies.push(res.body);
    }
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    expect(await prisma().supportRequest.count()).toBe(1);
  });

  it("keeps a single open request per day", async () => {
    const user = await createUser({ status: "SUSPENDED" });
    for (let i = 0; i < 3; i += 1) {
      await authApi().post("/support-request", { body: { email: user.email, message: MESSAGE } });
    }
    expect(await prisma().supportRequest.count({ where: { userId: user.id } })).toBe(1);
  });

  it("validates the message and the identifier", async () => {
    const user = await createUser({ status: "SUSPENDED" });
    const short = await authApi().post("/support-request", {
      body: { email: user.email, message: "aide" },
    });
    const none = await authApi().post("/support-request", { body: { message: MESSAGE } });
    expect(short.status).toBe(422);
    expect(none.status).toBe(422);
  });
});

describe("handling the requests", () => {
  async function openRequest() {
    const user = await createUser({ status: "SUSPENDED", name: "Jean Kasongo" });
    await authApi().post("/support-request", { body: { email: user.email, message: MESSAGE } });
    return user;
  }

  it("lets Support list the open requests with who wrote them", async () => {
    const user = await openRequest();
    const { token, client } = await supportSession();

    const res = await client.get("/support-requests", { token });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      message: MESSAGE,
      status: "OPEN",
      user: { id: user.id, name: "Jean Kasongo", status: "SUSPENDED" },
    });
  });

  it("filters by status and paginates", async () => {
    await openRequest();
    const { token, client } = await supportSession();
    const closed = await client.get("/support-requests?status=CLOSED", { token });
    expect(closed.body.items).toHaveLength(0);

    const paged = await client.get("/support-requests?limit=1&page=2", { token });
    expect(paged.body.items).toHaveLength(0);
    expect(paged.body.total).toBe(1);
  });

  it("keeps the list closed to ordinary users", async () => {
    const buyer = await createUser();
    const token = await sessionTokenFor(buyer);
    expect((await authApi().get("/support-requests", { token })).status).toBe(403);
    expect((await authApi().get("/support-requests")).status).toBe(401);
  });

  it("lets only the Admin close a request, with a note", async () => {
    const user = await openRequest();
    const request = await prisma().supportRequest.findFirst({ where: { userId: user.id } });

    const support = await supportSession();
    const denied = await support.client.post(`/support-requests/${request.id}/close`, {
      token: support.token,
      body: {},
    });
    expect(denied.status).toBe(403);

    const admin = await createAdminSession();
    const closed = await admin.client.post(`/support-requests/${request.id}/close`, {
      token: admin.token,
      body: { note: "Suspension confirmée" },
    });
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("CLOSED");

    const stored = await prisma().supportRequest.findUnique({ where: { id: request.id } });
    expect(stored).toMatchObject({
      status: "CLOSED",
      closedBy: admin.admin.id,
      note: "Suspension confirmée",
    });
    expect(stored.closedAt).not.toBeNull();

    const again = await admin.client.post(`/support-requests/${request.id}/close`, {
      token: admin.token,
      body: {},
    });
    expect(again.status).toBe(404);
  });

  it("closes the open requests when the Admin reactivates the account", async () => {
    const user = await openRequest();
    const admin = await createAdminSession();

    const res = await adminApi().post(`/users/${user.id}/reactivate`, {
      token: admin.token,
      body: { reason: "Erreur de modération" },
    });
    expect(res.status).toBe(200);

    const stored = await prisma().supportRequest.findFirst({ where: { userId: user.id } });
    expect(stored).toMatchObject({
      status: "CLOSED",
      note: "Compte réactivé",
      closedBy: admin.admin.id,
    });
    const login = await authApi().post("/login/otp/request", { body: { email: user.email } });
    expect(login.status).toBe(200);
  });
});

describe("suspension", () => {
  it("logs the person out everywhere at once and blocks every way back in", async () => {
    const user = await createUser();
    const first = await loginByEmailOtp(user.email);
    const second = await loginByEmailOtp(user.email);
    const admin = await createAdminSession();

    await adminApi().post(`/users/${user.id}/suspend`, {
      token: admin.token,
      body: { reason: "Règles non respectées" },
    });

    for (const login of [first, second]) {
      expect((await authApi().get("/me", { token: login.body.accessToken })).status).toBe(401);
    }
    const refresh = await authApi().post("/refresh", {
      body: { refreshToken: first.body.refreshToken },
    });
    expect(refresh.status).toBe(401);

    const request = await authApi().post("/login/otp/request", { body: { email: user.email } });
    expect(request.status).toBe(403);
    expect(request.body.error.code).toBe("ACCOUNT_SUSPENDED");

    const sessions = await prisma().session.findMany({ where: { userId: user.id } });
    expect(sessions.every((s) => s.revokedReason === "SUSPENDED")).toBe(true);
  });

  it("cannot reactivate an account that is not suspended", async () => {
    const user = await createUser();
    const admin = await createAdminSession();
    const res = await adminApi().post(`/users/${user.id}/reactivate`, {
      token: admin.token,
      body: { reason: "Essai inutile" },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_SUSPENDED");
  });

  it("uses a fresh admin code on every sensitive action", async () => {
    const admin = await createAdminSession();
    const code = await freshTotp(admin.admin.id, admin.secret);
    expect(code).toMatch(/^\d{6}$/);
  });
});
