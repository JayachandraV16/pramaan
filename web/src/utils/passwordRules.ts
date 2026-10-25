// Same rule as the server (api/src/utils/passwordPolicy.js): 8-128 characters, at least one letter and one digit.
// Pure and import-free so the API test suite can run it too (see api/test/registration.test.js).

/** @returns the message to show, or null when the password is acceptable */
export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 128) return 'Password must be between 8 and 128 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one digit.';
  return null;
}
