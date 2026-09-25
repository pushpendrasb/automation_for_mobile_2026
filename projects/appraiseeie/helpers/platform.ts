/**
 * Platform checks and locators that work on both XCUITest and UiAutomator2.
 *
 * iOS strategies (`-ios predicate string`, `-ios class chain`) are rejected
 * by an Android session. Call `forPlatform` before sending a selector list.
 */

/** True when the current Appium session is Android (UiAutomator2). */
export function isAndroid(): boolean {
  const name = String(browser.capabilities?.platformName || '').toLowerCase();
  return name === 'android';
}

/** Escape a label for use inside a quoted UiSelector or iOS predicate. */
export function escapeUi(text: string): string {
  return String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Exact visible label.
 * Android matches `text`; iOS matches `label` or `name`.
 */
export function byExactText(text: string): string {
  const label = escapeUi(text);
  if (isAndroid()) {
    return `android=new UiSelector().text("${label}")`;
  }
  return `-ios predicate string:label == "${label}" OR name == "${label}"`;
}

/**
 * Label that contains `text` (case-sensitive on Android, case-insensitive on iOS).
 */
export function byTextContains(text: string): string {
  const label = escapeUi(text);
  if (isAndroid()) {
    return `android=new UiSelector().textContains("${label}")`;
  }
  return `-ios predicate string:label CONTAINS[c] "${label}" OR name CONTAINS[c] "${label}"`;
}

/**
 * Drop iOS-only strategies when the session is Android so Appium does not
 * answer with "Locator Strategy is not supported".
 */
export function forPlatform(selectors: string[]): string[] {
  const list = selectors.filter(Boolean);
  if (!isAndroid()) return list;
  return list.filter((selector) => !selector.startsWith('-ios '));
}
