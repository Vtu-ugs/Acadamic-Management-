// Central password-strength policy, shared by signup/reset/change-password.
// Rule: at least 8 characters, including at least one letter and one number.
const MIN_LENGTH = 8;
const RULE_TEXT = 'Password must be at least 8 characters and include a letter and a number';

// Returns an error string if the password is too weak, or null if it passes.
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) return RULE_TEXT;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return RULE_TEXT;
  return null;
}

module.exports = { validatePassword, RULE_TEXT, MIN_LENGTH };
