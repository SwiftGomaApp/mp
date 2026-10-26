const { QUEUES, getQueue } = require("./queues");
const { assertSmsBudget } = require("../messaging/smsBudget");

const NOTIFICATION_JOBS = {
  EMAIL_OTP: "email.otp",
  EMAIL_LOGIN_ALERT: "email.login-alert",
  SMS_OTP: "sms.otp",
  SMS_LOGIN_ALERT: "sms.login-alert",
  EMAIL_WELCOME: "email.welcome",
  SMS_WELCOME: "sms.welcome",
  EMAIL_SECURITY_ALERT: "email.security-alert",
  SMS_SECURITY_ALERT: "sms.security-alert",
  EMAIL_STAFF_SETUP: "email.staff-setup",
};

function enqueue(name, data) {
  return getQueue(QUEUES.NOTIFICATIONS).add(name, data);
}

function queueOtpEmail(data) {
  return enqueue(NOTIFICATION_JOBS.EMAIL_OTP, data);
}

function queueLoginAlertEmail({ date, ...rest }) {
  return enqueue(NOTIFICATION_JOBS.EMAIL_LOGIN_ALERT, {
    ...rest,
    date: (date ? new Date(date) : new Date()).toISOString(),
  });
}

async function queueOtpSms(data) {
  await assertSmsBudget();
  return enqueue(NOTIFICATION_JOBS.SMS_OTP, data);
}

function queueLoginAlertSms(data) {
  return enqueue(NOTIFICATION_JOBS.SMS_LOGIN_ALERT, data);
}

function queueWelcomeEmail(data) {
  return enqueue(NOTIFICATION_JOBS.EMAIL_WELCOME, data);
}

function queueWelcomeSms(data) {
  return enqueue(NOTIFICATION_JOBS.SMS_WELCOME, data);
}

function queueSecurityAlertEmail({ date, ...rest }) {
  return enqueue(NOTIFICATION_JOBS.EMAIL_SECURITY_ALERT, {
    ...rest,
    date: (date ? new Date(date) : new Date()).toISOString(),
  });
}

function queueSecurityAlertSms(data) {
  return enqueue(NOTIFICATION_JOBS.SMS_SECURITY_ALERT, data);
}

function queueStaffSetupEmail(data) {
  return enqueue(NOTIFICATION_JOBS.EMAIL_STAFF_SETUP, data);
}

module.exports = {
  NOTIFICATION_JOBS,
  queueOtpEmail,
  queueLoginAlertEmail,
  queueOtpSms,
  queueLoginAlertSms,
  queueWelcomeEmail,
  queueWelcomeSms,
  queueSecurityAlertEmail,
  queueSecurityAlertSms,
  queueStaffSetupEmail,
};
