/**
 * Home page object.
 */
class HomePage {
  /**
   * Dismiss the Force Update modal if it appears on app launch.
   */
  async dismissUpdateModalIfPresent() {
    try {
      // Sometimes it takes a while for the network request to complete and show the modal
      const cancelBtn = await $('//*[@text="Cancel"]');
      await cancelBtn.waitForDisplayed({ timeout: 15000 });
      if (await cancelBtn.isDisplayed()) {
        await cancelBtn.click();
        await driver.pause(1000);
      }
    } catch (e) {
      // Modal didn't appear, ignore and continue
    }
  }

  /**
   * Whether the home screen is visible.
   */
  async isDisplayed(): Promise<boolean> {
    const selector = driver.isAndroid 
      ? '//*[@text="Browse By Sector"]'
      : '~home-screen';
    const homeScreen = await $(selector);
    try {
      await homeScreen.waitForDisplayed({ timeout: 15000 });
      return true;
    } catch (e) {
      console.log("HOME SCREEN NOT FOUND. DUMPING PAGE SOURCE:");
      console.log(await driver.getPageSource());
      throw e;
    }
  }
}

export default new HomePage();
