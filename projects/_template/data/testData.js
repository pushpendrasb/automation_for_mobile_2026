/**
 * Shared test data helpers. Prefer reading from process.env (.env).
 */
module.exports = {
  testUser: process.env.TEST_USER || '',
  testPassword: process.env.TEST_PASSWORD || '',
};
