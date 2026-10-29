const userRoom = (userId) => `user:${userId}`;
const sessionRoom = (sessionId) => `session:${sessionId}`;
const roleRoom = (role) => `role:${role}`;

module.exports = { userRoom, sessionRoom, roleRoom };
