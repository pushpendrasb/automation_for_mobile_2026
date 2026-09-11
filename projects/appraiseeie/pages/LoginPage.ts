/**
 * Login screen Page Object — Appraisee IE (ViewController).
 *
 * Prefer accessibilityIdentifier (`login_email`, …). If the device build
 * does not include those IDs yet, fall back to storyboard placeholders
 * ("E-mail" / "Password") and the LOGIN button title.
 */
import { TEST_IDS } from '../data/testIds';
import { clientLog } from '../helpers/clientLog';
import SystemAlertsPage from './SystemAlertsPage';

export class LoginPage {
  private id(value: string): string {
    return `~${value}`;
  }

  /**
   * Locators tried in order for the email field.
   */
  private emailSelectors(): string[] {
    return [
      this.id(TEST_IDS.login.email),
      '-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "E-mail"',
      '-ios class chain:**/XCUIElementTypeTextField[`placeholderValue == "E-mail"`]',
      '~E-mail',
    ];
  }

  /**
   * Locators tried in order for the password field (secure).
   */
  private passwordSelectors(): string[] {
    return [
      this.id(TEST_IDS.login.password),
      '-ios predicate string:type == "XCUIElementTypeSecureTextField" AND placeholderValue == "Password"',
      '-ios class chain:**/XCUIElementTypeSecureTextField[`placeholderValue == "Password"`]',
      '-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "Password"',
      '~Password',
    ];
  }

  /**
   * Locators tried in order for the Login / submit control.
   * Storyboard title is "LOGIN"; some builds only expose the checkmark image.
   */
  private submitSelectors(): string[] {
    return [
      this.id(TEST_IDS.login.submit),
      '~LOGIN',
      '-ios predicate string:type == "XCUIElementTypeButton" AND (name == "LOGIN" OR label == "LOGIN" OR name == "Login" OR label == "Login")',
      '-ios class chain:**/XCUIElementTypeButton[`name == "LOGIN" OR label == "LOGIN"`]',
    ];
  }

  /**
   * Return the first selector that is displayed within the timeout budget.
   * Uses short probes so many fallbacks can be tried before the overall timeout.
   */
  private async findDisplayed(selectors: string[], timeoutMs: number) {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      for (const sel of selectors) {
        try {
          const el = await $(sel);
          const exists = await el.isExisting().catch(() => false);
          if (!exists) continue;
          const shown = await el.isDisplayed().catch(() => false);
          if (shown) return el;
        } catch (err) {
          lastError = err;
        }
      }
      await browser.pause(400);
    }

    throw new Error(
      `Login control not found after ${timeoutMs}ms. Tried: ${selectors.join(' | ')}. Last error: ${String(lastError)}`
    );
  }

  /**
   * Hide the iOS keyboard so the LOGIN button is not covered.
   */
  private async dismissKeyboardIfNeeded(): Promise<void> {
    try {
      // XCUITest: hideKeyboard may no-op if already hidden
      await browser.hideKeyboard('pressKey', 'Return');
    } catch {
      try {
        await browser.hideKeyboard();
      } catch {
        try {
          await browser.execute('mobile: tap', { x: 20, y: 100 });
        } catch {
          /* ignore */
        }
      }
    }
    await browser.pause(400);
    clientLog('Keyboard is hidden');
  }

  /**
   * Wait until the email field is visible (login form ready).
   */
  async waitForLoginScreen(timeoutMs = 30000): Promise<void> {
    clientLog('Waiting for the login screen');
    await this.findDisplayed(this.emailSelectors(), timeoutMs);
    clientLog('Login screen is ready');
  }

  /**
   * Assert core login controls are on screen.
   */
  async assertLoginFormVisible(): Promise<void> {
    await this.waitForLoginScreen();
    await this.findDisplayed(this.emailSelectors(), 10000);
    await this.findDisplayed(this.passwordSelectors(), 10000);
    await this.dismissKeyboardIfNeeded();
    await this.findDisplayed(this.submitSelectors(), 10000);
    clientLog('Email, password, and Login button are visible');
  }

  /**
   * Type email into the login field.
   */
  async enterEmail(email: string): Promise<void> {
    const field = await this.findDisplayed(this.emailSelectors(), 15000);
    await field.click();
    await field.clearValue().catch(() => undefined);
    await field.setValue(email);
    clientLog('Email has been entered');
  }

  /**
   * Type password into the login field.
   */
  async enterPassword(password: string): Promise<void> {
    const field = await this.findDisplayed(this.passwordSelectors(), 15000);
    await field.click();
    await field.clearValue().catch(() => undefined);
    await field.setValue(password);
    clientLog('Password has been entered');
  }

  /**
   * Tap the Login / Sign In button (dismiss keyboard first if needed).
   */
  async tapLogin(): Promise<void> {
    await this.dismissKeyboardIfNeeded();
    const btn = await this.findDisplayed(this.submitSelectors(), 15000);
    await btn.click();
    clientLog('Login button has been tapped');
  }

  /**
   * Full login: email + password + submit.
   * Not Now is handled quickly in UserRolePage.dismissNotNowAndSelectRole /
   * a short optional dismiss here (does not wait the full timeout if gone).
   */
  async login(email: string, password: string): Promise<void> {
    await this.waitForLoginScreen();
    await this.enterEmail(email);
    await this.enterPassword(password);
    await this.tapLogin();
    // Short probe only — do not delay role selection
    await SystemAlertsPage.dismissNotNowIfPresent(1500, async () => {
      try {
        const cell = await $(`~${TEST_IDS.userRole.cellPrefix}0`);
        return await cell.isDisplayed();
      } catch {
        return false;
      }
    });
  }

  /**
   * True when any known email locator is currently displayed.
   */
  async isLoginFormVisible(): Promise<boolean> {
    for (const sel of this.emailSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed()) return true;
      } catch {
        /* try next */
      }
    }
    return false;
  }

  /**
   * True when the login email field is no longer the primary screen
   * (navigated away after success, or role picker shown).
   */
  async isLoginFormGone(timeoutMs = 25000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await this.isLoginFormVisible())) return true;
      await browser.pause(500);
    }
    return false;
  }

  /**
   * Locators for the show/hide password eye button.
   */
  private showHideSelectors(): string[] {
    return [
      this.id(TEST_IDS.login.showHidePassword),
      '-ios predicate string:label CONTAINS[c] "password" AND type == "XCUIElementTypeButton"',
    ];
  }

  /**
   * Tap show/hide password (btnShowAndHidePassword).
   */
  async tapShowHidePassword(): Promise<void> {
    const btn = await this.findDisplayed(this.showHideSelectors(), 10000);
    await btn.click();
    await browser.pause(300);
    clientLog('Show / hide password eye has been tapped');
  }

  /**
   * True when password field is secure (hidden).
   */
  async isPasswordSecure(): Promise<boolean> {
    try {
      const secure = await $(
        '-ios predicate string:type == "XCUIElementTypeSecureTextField" AND (placeholderValue == "Password" OR name == "login_password" OR label == "Password")'
      );
      if (await secure.isDisplayed().catch(() => false)) return true;
    } catch {
      /* fall through */
    }
    // If only a normal text field with password placeholder, text is visible
    try {
      const plain = await $(
        '-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "Password"'
      );
      if (await plain.isDisplayed().catch(() => false)) return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  /**
   * App shows toast alerts via createAlertView (bottom banner label).
   * Wait until any static text contains the expected message.
   */
  async waitForToastContaining(
    text: string,
    timeoutMs = 8000
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const needle = text.toLowerCase();
    while (Date.now() < deadline) {
      try {
        const labels = await $$(
          '-ios class chain:**/XCUIElementTypeStaticText'
        );
        for (const label of labels) {
          const t = ((await label.getText().catch(() => '')) || '').toLowerCase();
          if (t.includes(needle)) return;
        }
      } catch {
        /* retry */
      }
      await browser.pause(250);
    }
    throw new Error(`Toast/alert containing "${text}" not found`);
  }

  /**
   * Clear email/password fields for negative cases.
   */
  async clearLoginFields(): Promise<void> {
    try {
      const email = await this.findDisplayed(this.emailSelectors(), 5000);
      await email.click();
      await email.clearValue().catch(() => undefined);
      await email.setValue('');
    } catch {
      /* ignore */
    }
    try {
      const pass = await this.findDisplayed(this.passwordSelectors(), 5000);
      await pass.click();
      await pass.clearValue().catch(() => undefined);
      await pass.setValue('');
    } catch {
      /* ignore */
    }
  }
}

export default new LoginPage();
