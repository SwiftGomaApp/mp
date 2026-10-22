const { verifySignupBody, resendSignupBody } = require("./signup.validator");

const loginOtpRequestBody = resendSignupBody;
const loginOtpVerifyBody = verifySignupBody;

module.exports = { loginOtpRequestBody, loginOtpVerifyBody };
