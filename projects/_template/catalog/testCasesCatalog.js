/**
 * Test catalog for HTML reports — extend as you add cases.
 */

/** @type {Array<Record<string, unknown>>} */
const ALL_TEST_CASES = [
  {
    caseId: 'SM-001',
    module: 'Smoke',
    type: 'smoke',
    title: 'starts a session and reports the current app id',
    understanding:
      'Appium can open a session and we can read the active app bundle/package id.',
    steps: [
      'Start Appium session for the configured app',
      'Wait briefly for launch',
      'Read active iOS bundle id or Android package',
    ],
    expected: 'Session starts; app id is logged',
    passWhen: 'No session / launch error',
    failWhen: 'Appium cannot start session or app is missing',
  },
];

/**
 * @param {string} title
 * @returns {Record<string, unknown>|null}
 */
function findCaseByTitle(title) {
  const t = String(title || '').toLowerCase();
  return (
    ALL_TEST_CASES.find((c) => String(c.title || '').toLowerCase() === t) ||
    ALL_TEST_CASES.find((c) => t.includes(String(c.title || '').toLowerCase())) ||
    null
  );
}

module.exports = { ALL_TEST_CASES, findCaseByTitle };
