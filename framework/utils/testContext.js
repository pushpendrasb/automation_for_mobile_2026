/**
 * Per-test extra report fields a spec can attach before it finishes (e.g. a
 * negative test's expected vs. actual error text, the page it happened on).
 * The wdio local runner keeps the spec file and its hooks in the same worker
 * process, so a module-level bag is enough to carry this from the test into
 * `afterTest` without changing every call site that doesn't need it.
 */
let pending = null;

/**
 * @param {Record<string, unknown>} fields
 */
function setTestExtras(fields) {
  pending = { ...(pending || {}), ...fields };
}

/**
 * Reads and clears the pending extras. Called once per test from `afterTest`.
 * @returns {Record<string, unknown>}
 */
function takeTestExtras() {
  const value = pending;
  pending = null;
  return value || {};
}

module.exports = { setTestExtras, takeTestExtras };
