const mail = require("../core/mail/mail.service");
const sms = require("../core/messaging/sms.service");
const { NOTIFICATION_JOBS } = require("../core/queue/notifications");

const handlers = {
  [NOTIFICATION_JOBS.EMAIL_OTP]: (data) => mail.sendOtpEmail(data),
  [NOTIFICATION_JOBS.EMAIL_LOGIN_ALERT]: (data) =>
    mail.sendLoginAlertEmail({ ...data, date: new Date(data.date) }),
  [NOTIFICATION_JOBS.SMS_OTP]: (data) => sms.sendOtpSms(data),
  [NOTIFICATION_JOBS.SMS_LOGIN_ALERT]: (data) => sms.sendLoginAlertSms(data),
};

async function processNotification(job) {
  const handler = handlers[job.name];
  if (!handler) throw new Error(`Unknown notification job: ${job.name}`);
  await handler(job.data);
}

module.exports = { processNotification };
