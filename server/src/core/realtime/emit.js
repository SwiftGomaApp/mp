const { getIo } = require("./io");
const { userRoom, sessionRoom, roleRoom } = require("./rooms");

function emitToUser(userId, event, payload) {
  getIo()?.to(userRoom(userId)).emit(event, payload);
}

function emitToRole(role, event, payload) {
  getIo()?.to(roleRoom(role)).emit(event, payload);
}

async function isUserOnline(userId) {
  const io = getIo();
  if (!io) return false;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
}

function disconnectSession(sessionId) {
  getIo()?.in(sessionRoom(sessionId)).disconnectSockets(true);
}

module.exports = { emitToUser, emitToRole, isUserOnline, disconnectSession };
