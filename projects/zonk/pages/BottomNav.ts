class BottomNav {
  get accountTab() {
    return driver.isAndroid
      ? $('//*[@text="Account"]')
      : $('~Account');
  }

  async tapAccount() {
    await this.accountTab.waitForDisplayed({ timeout: 15000 });
    await this.accountTab.click();
  }
}

export default new BottomNav();
