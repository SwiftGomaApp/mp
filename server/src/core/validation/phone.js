const DRC_PHONE = /^\+243[0-9]{9}$/;

function isValidDrcPhone(phone) {
  return DRC_PHONE.test(String(phone || ""));
}

module.exports = { DRC_PHONE, isValidDrcPhone };
