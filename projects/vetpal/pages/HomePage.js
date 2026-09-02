/**
 * Home / dashboard — Request Treatment tile.
 * Source: vetpal-animal-owner/src/Screens/Home.js (read-only; no app changes).
 *
 * First tile is index 0: title "Request", sub_title "Treatment". Labels are
 * inside TouchableOpacity so iOS does not expose them as StaticText. Tap uses
 * the Home.js 2-column layout (left column, first row).
 */
const { ui } = require('./ui');
const LoginPage = require('./LoginPage');
const { testData } = require('../data/testData');

class HomePage {
  async isHomeVisible() {
    return LoginPage.isHomeVisibleFast();
  }

  /**
   * Login when needed. Does not reset a session that is already on Home.
   */
  async ensureLoggedIn() {
    if (await this.isHomeVisible()) {
      ui.log('Home', 'Already on dashboard');
      return;
    }
    ui.log('Home', 'Signing in');
    await LoginPage.ensureSignInMode();
    await LoginPage.enterMobile(testData.mobileNumber);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    const ok = await LoginPage.isLoginSuccessful(25000);
    if (!ok) {
      throw new Error('Could not reach Vet-Pal Home after Sign In');
    }
  }

  /**
   * Land on Home while staying logged in.
   * If the session is already authenticated (Home or an inner screen), do not
   * logout or Sign In again. Only sign in when the Sign In form is showing.
   */
  async goHomeFresh() {
    if (await this.isHomeVisible()) {
      ui.log('Home', 'Already logged in on dashboard — skip logout');
      return;
    }
    if (await LoginPage.isOnLoginScreenFast()) {
      await this.ensureLoggedIn();
      return;
    }
    ui.log('Home', 'Already logged in — return to Home without logout');
    await this.#returnToHomeWithoutLogout();
    if (!(await this.isHomeVisible())) {
      await this.ensureLoggedIn();
    }
  }

  /**
   * Tap the header back control until the dashboard is visible.
   * Never opens Logout.
   */
  async #returnToHomeWithoutLogout() {
    for (let i = 0; i < 8; i += 1) {
      if (await this.isHomeVisible()) {
        return;
      }
      await ui.pressAt(32, 90);
      await browser.pause(280);
    }
  }

  /**
   * MyPrescriptions header after opening the Request Treatment tile.
   * One Appium query (same pattern as LoginPage home check).
   */
  async isPendingPrescriptionsVisible() {
    return ui.anyDisplayed(ui.pendingPrescriptionsSelector());
  }

  /**
   * Home → first tile (Request / Treatment) → Pending Prescriptions.
   */
  async openRequestTreatment() {
    ui.log('Request Treatment', 'Tapping first dashboard tile');
    await this.ensureLoggedIn();

    if (await this.isPendingPrescriptionsVisible()) {
      ui.log('Request Treatment', 'Already on Pending Prescriptions');
      return;
    }

    await ui.tapDashboardTile();

    const opened = await browser
      .waitUntil(async () => this.isPendingPrescriptionsVisible(), {
        timeout: 3000,
        interval: 200,
        timeoutMsg: 'Pending Prescriptions not visible after tile tap',
      })
      .then(() => true)
      .catch(() => false);

    if (opened) {
      ui.log('Request Treatment', 'Pending Prescriptions opened');
      return;
    }

    ui.log('Request Treatment', 'Retry tile tap (lower on card)');
    await ui.tapFirstDashboardTileByGrid(0.55);

    await browser.waitUntil(async () => this.isPendingPrescriptionsVisible(), {
      timeout: 4000,
      interval: 200,
      timeoutMsg: 'Pending Prescriptions / Request Vet Advice button not visible',
    });
    ui.log('Request Treatment', 'Pending Prescriptions opened');
  }
}

module.exports = new HomePage();
