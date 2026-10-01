/**
 * Find React Native controls by testID.
 * iOS uses the accessibility id. Android uses content-desc, which the app
 * sets from the same id in tapId().
 */

function isAndroid() {
  const name = String(browser.capabilities?.platformName || '').toLowerCase();
  return name === 'android';
}

function escape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** @param {string} id */
function byTestId(id) {
  const value = escape(id);
  if (isAndroid()) {
    return $(`android=new UiSelector().description("${value}")`);
  }
  return $(`~${value}`);
}

/** @param {string} prefix */
function allByTestIdPrefix(prefix) {
  const value = escape(prefix);
  if (isAndroid()) {
    return $$(`android=new UiSelector().descriptionStartsWith("${value}")`);
  }
  return $$(
    `-ios predicate string:name BEGINSWITH "${value}" OR label BEGINSWITH "${value}"`,
  );
}

/**
 * Read the test id back from an element (name on iOS, content-desc on Android).
 * @param {WebdriverIO.Element} el
 */
async function readTestId(el) {
  if (isAndroid()) {
    return (
      (await el.getAttribute('content-desc').catch(() => '')) ||
      (await el.getAttribute('name').catch(() => '')) ||
      ''
    );
  }
  return (
    (await el.getAttribute('name').catch(() => '')) ||
    (await el.getAttribute('label').catch(() => '')) ||
    ''
  );
}

module.exports = {
  isAndroid,
  byTestId,
  allByTestIdPrefix,
  readTestId,
};
