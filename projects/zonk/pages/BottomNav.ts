class BottomNav {
  get accountTab() {
    return $('~Account Tab');
  }

  async tapAccount() {
    await this.accountTab.waitForDisplayed({ timeout: 15000 });
    
    if (driver.isAndroid) {
      // Workaround for Android tap not registering in React Navigation tabs
      // Directly deep link to the login screen
      await driver.execute('mobile: deepLink', { url: 'zonk://login', package: 'com.zonk.mobile' });
      await driver.pause(1000);
    } else {
      await this.accountTab.click();
    }
  }
}

export default new BottomNav();
