const { EVENTS } = require("../config/events.config");

/** What an app may know about an event: never the render functions or the dedupe rules. */
function listCatalog(role) {
  const events = Object.values(EVENTS)
    .filter((event) => !event.roles || event.roles.includes(role))
    .map((event) => ({
      type: event.key,
      context: event.context,
      priority: event.priority,
      mandatory: event.mandatory,
      channels: event.channels,
      escalation: event.escalation ?? null,
    }));

  return { events };
}

module.exports = { listCatalog };
