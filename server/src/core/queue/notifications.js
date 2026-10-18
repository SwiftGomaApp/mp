const { QUEUES, getQueue } = require("./queues");

const NOTIFICATION_JOBS = {
  EMAIL_OTP: "email.otp",
  EMAIL_LOGIN_ALERT: "email.login-alert",
  SMS_OTP: "sms.otp",
  SMS_LOGIN_ALERT: "sms.login-alert",
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

function queueOtpSms(data) {
  return enqueue(NOTIFICATION_JOBS.SMS_OTP, data);
}

function queueLoginAlertSms(data) {
  return enqueue(NOTIFICATION_JOBS.SMS_LOGIN_ALERT, data);
}

module.exports = {
  NOTIFICATION_JOBS,
  queueOtpEmail,
  queueLoginAlertEmail,
  queueOtpSms,
  queueLoginAlertSms,
};
