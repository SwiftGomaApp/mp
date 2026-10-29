/**
 * The verified addresses a person can currently be reached at.
 */
function verifiedReach(user) {
  return {
    email: user.email && user.emailVerifiedAt ? user.email : null,
    phone: user.phone && user.phoneVerifiedAt ? user.phone : null,
  };
}

/**
 * Where a notification should go. Callers normally let the system use the person's current
 * contacts. A caller can pass the addresses to use instead, for example the previous contacts
 * after an account recovery replaced them, so the previous owner is still warned.
 */
function resolveReach(user, contacts) {
  if (!contacts) return verifiedReach(user);
  return { email: contacts.email ?? null, phone: contacts.phone ?? null };
}

function contactIssue(channel, reach) {
  if (channel === "EMAIL" && !reach.email) return "no_email";
  if (channel === "SMS" && !reach.phone) return "no_phone";
  return null;
}

function targetFor(channel, reach) {
  if (channel === "EMAIL") return reach.email;
  if (channel === "SMS") return reach.phone;
  return null;
}

module.exports = { verifiedReach, resolveReach, contactIssue, targetFor };
