const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");
const { createRedisConnection } = require("../cache/redis");
const { getIo, setIo } = require("./io");
const { userRoom, sessionRoom, roleRoom } = require("./rooms");
const { authenticateSocket, verifySocketToken } = require("./socketAuth");
const { allowHandshake } = require("./handshakeLimit");

const EXPIRY_WARNING_MS = 60_000;
const MAX_SOCKETS_PER_USER = 5;

let pub = null;
let sub = null;

function createClients() {
  pub = createRedisConnection();
  sub = pub.duplicate();
  for (const client of [pub, sub]) {
    client.on("error", (err) => logger.error({ err }, "Realtime Redis error"));
  }
  return createAdapter(pub, sub);
}

async function enforceConnectionCap(userId) {
  const sockets = await getIo()?.in(userRoom(userId)).fetchSockets();
  if (!sockets || sockets.length <= MAX_SOCKETS_PER_USER) return;

  sockets
    .sort((a, b) => a.handshake.issued - b.handshake.issued)
    .slice(0, sockets.length - MAX_SOCKETS_PER_USER)
    .forEach((oldest) => oldest.disconnect(true));
}

function onConnection(socket) {
  const { userId, role, sessionId } = socket.data.auth;
  socket.join([userRoom(userId), sessionRoom(sessionId), roleRoom(role)]);
  enforceConnectionCap(userId).catch((err) => {
    logger.warn({ err, userId }, "Could not enforce the connection cap");
  });

  let warnTimer = null;
  let expireTimer = null;

  function watchExpiry() {
    clearTimeout(warnTimer);
    clearTimeout(expireTimer);
    const remaining = Math.max(socket.data.auth.expiresAt - Date.now(), 0);
    warnTimer = setTimeout(
      () => socket.emit("auth:expiring"),
      Math.max(remaining - EXPIRY_WARNING_MS, 0),
    );
    expireTimer = setTimeout(() => {
      socket.emit("auth:expired");
      socket.disconnect(true);
    }, remaining);
  }

  watchExpiry();

  socket.on("auth:refresh", async (payload, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      const next = await verifySocketToken(payload?.token);
      const current = socket.data.auth;
      if (next.userId !== current.userId || next.sessionId !== current.sessionId) {
        return reply({ ok: false, code: "UNAUTHORIZED" });
      }
      socket.data.auth = next;
      watchExpiry();
      reply({ ok: true });
    } catch (err) {
      reply({ ok: false, code: err.data?.code ?? "UNAVAILABLE" });
    }
  });

  socket.on("disconnect", (reason) => {
    clearTimeout(warnTimer);
    clearTimeout(expireTimer);
    logger.debug({ userId, reason }, "Socket disconnected");
  });

  logger.debug({ userId, role }, "Socket connected");
}

function attachRealtime(httpServer) {
  const { corsOrigins } = getConfig();

  const io = new Server(httpServer, {
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 1e5,
    cors: { origin: corsOrigins, credentials: true },
    allowRequest: async (req, callback) => {
      const origin = req.headers.origin;
      if (origin && !corsOrigins.includes(origin)) return callback(null, false);
      callback(null, await allowHandshake(req));
    },
    adapter: createClients(),
  });

  io.use(authenticateSocket);
  io.on("connection", onConnection);

  setIo(io);
  return io;
}

function startRealtimeClient() {
  const io = new Server({ adapter: createClients() });
  setIo(io);
  return io;
}

function disconnectAllSockets() {
  getIo()?.local.disconnectSockets(true);
}

async function closeRealtime() {
  setIo(null);
  await Promise.allSettled([pub?.quit(), sub?.quit()]);
  pub = null;
  sub = null;
}

module.exports = { attachRealtime, startRealtimeClient, disconnectAllSockets, closeRealtime };
