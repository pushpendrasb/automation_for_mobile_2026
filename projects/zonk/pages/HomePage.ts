/**
 * Home page object.
 */
class HomePage {
  /**
   * Whether the home screen is visible.
   */
  async isDisplayed(): Promise<boolean> {
    // Use text-based locator for Android to avoid issues with testID stripping in React Native release builds
    const selector = driver.isAndroid 
      ? '//*[@text="Browse By Sector"]'
      : '~home-screen';
    const homeScreen = await $(selector);
    return homeScreen.waitForDisplayed({ timeout: 15000 });
  }
}

export default new HomePage();
