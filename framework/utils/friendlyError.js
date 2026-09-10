/**
 * Turn Appium / WebDriver / Node errors into short plain-English messages
 * for HTML reports and console (keep the technical text available separately).
 */

/**
 * @param {unknown} error
 * @returns {string}
 */
function rawErrorText(error) {
  if (error == null) {
    return '';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || String(error);
  }
  if (typeof error === 'object' && error.message) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Plain-English summary for non-engineers.
 * @param {unknown} error
 * @returns {string}
 */
function friendlyErrorMessage(error) {
  const raw = rawErrorText(error);
  if (!raw.trim()) {
    return 'The test failed, but no error message was recorded.';
  }

  const text = raw.toLowerCase();

  if (
    /unable to launch webdriveragent|xcodebuild failed with code 65|wda|webdriveragent/.test(
      text,
    )
  ) {
    return (
      'Could not start test control on the iPhone (WebDriverAgent / signing). ' +
      'Check Apple Team ID in .env, trust this Mac on the phone, turn on Developer Mode, ' +
      'and download profiles in Xcode → Settings → Accounts.'
    );
  }

  if (
    /could not find a connected|device .* not found|udid|unknown device|no devices/.test(
      text,
    )
  ) {
    return (
      'The phone was not found. Plug it in, unlock it, trust this computer, ' +
      'and confirm IOS_DEVICE_UDID in .env matches this device.'
    );
  }

  if (/econnrefused|connect econnrefused|127\.0\.0\.1:4723|appium/.test(text)) {
    return (
      'Appium is not running (or not reachable on port 4723). ' +
      'Open another terminal and run: appium'
    );
  }

  if (
    /bundle.?id|application is not installed|is not installed|unknown bundle/.test(
      text,
    )
  ) {
    return (
      'The app is missing or the bundle ID is wrong. Install the app on the phone ' +
      'and check IOS_BUNDLE_ID in .env.'
    );
  }

  if (
    /nosuchelement|no such element|element not found|element(?:\s+\S+)*\s+could not be located|could not be located on the page|accessibility id/.test(
      text,
    )
  ) {
    return (
      'A button or field the test expected was not on screen. ' +
      'The app UI may have changed, or the screen did not load in time.'
    );
  }

  if (/timeout|timed out|waituntil|waiting for/.test(text)) {
    return (
      'The test waited too long for the next screen or control. ' +
      'The app may be slow, offline, or stuck on a popup.'
    );
  }

  if (/session .* deleted|invalid session|session does not exist/.test(text)) {
    return (
      'The phone session ended early (app crash, disconnect, or Appium restart). ' +
      'Re-run the test with the device unlocked.'
    );
  }

  if (/assertion|expect\(|expected .* received/.test(text)) {
    return (
      'The app did not match what the test expected (wrong screen, message, or value).'
    );
  }

  // Keep short: first sentence / first line only for unknown errors.
  const firstLine = raw.split(/\r?\n/)[0].trim();
  if (firstLine.length <= 180) {
    return firstLine;
  }
  return `${firstLine.slice(0, 177)}…`;
}

module.exports = {
  rawErrorText,
  friendlyErrorMessage,
};
