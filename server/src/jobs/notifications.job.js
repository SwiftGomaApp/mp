const { UnrecoverableError } = require("bullmq");
const mail = require("../core/mail/mail.service");
const sms = require("../core/messaging/sms.service");
const { NOTIFICATION_JOBS } = require("../core/queue/notifications");
const { AppError } = require("../core/errors/AppError");

const defaultHandlers = {
  [NOTIFICATION_JOBS.EMAIL_OTP]: (data) => mail.sendOtpEmail(data),
  [NOTIFICATION_JOBS.EMAIL_LOGIN_ALERT]: (data) =>
    mail.sendLoginAlertEmail({ ...data, date: new Date(data.date) }),
  [NOTIFICATION_JOBS.SMS_OTP]: (data) => sms.sendOtpSms(data),
  [NOTIFICATION_JOBS.SMS_LOGIN_ALERT]: (data) => sms.sendLoginAlertSms(data),
  [NOTIFICATION_JOBS.EMAIL_WELCOME]: (data) => mail.sendWelcomeEmail(data),
  [NOTIFICATION_JOBS.SMS_WELCOME]: (data) => sms.sendWelcomeSms(data),
  [NOTIFICATION_JOBS.EMAIL_SECURITY_ALERT]: (data) =>
    mail.sendSecurityAlertEmail({ ...data, date: new Date(data.date) }),
  [NOTIFICATION_JOBS.SMS_SECURITY_ALERT]: (data) => sms.sendSecurityAlertSms(data),
  [NOTIFICATION_JOBS.EMAIL_STAFF_SETUP]: (data) => mail.sendStaffSetupEmail(data),
};

function isPermanentFailure(err) {
  return err instanceof AppError && err.status >= 400 && err.status < 500 && err.status !== 429;
}

function createNotificationProcessor(handlers) {
  return async function processNotification(job) {
    const handler = handlers[job.name];
    if (!handler) throw new UnrecoverableError(`Unknown notification job: ${job.name}`);

    try {
      await handler(job.data);
    } catch (err) {
      if (isPermanentFailure(err)) {
        throw new UnrecoverableError(`${err.code}: ${err.message}`);
      }
      throw err;
    }
  };
}

const processNotification = createNotificationProcessor(defaultHandlers);

module.exports = { processNotification, createNotificationProcessor, isPermanentFailure };
