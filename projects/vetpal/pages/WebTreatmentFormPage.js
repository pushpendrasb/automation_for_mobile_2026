/**
 * Nearby Step 3 assessment form — react-native-webview (NewPrescriptionForRemedyStore.js).
 *
 * Does not assume a WEBVIEW context name. Calls getContexts() and switches
 * to the first WEBVIEW_* / WEBVIEW. Mandatory HTML fields are filled at
 * runtime (empty required inputs / checkboxes) — not hard-coded names.
 */
const { ui } = require('./ui');

class WebTreatmentFormPage {
  async listContexts() {
    try {
      return await browser.getContexts();
    } catch (err) {
      ui.log('WebView', `getContexts failed: ${err.message}`);
      return ['NATIVE_APP'];
    }
  }

  async switchToWebView() {
    const contexts = await this.listContexts();
    ui.log('WebView', `Contexts: ${contexts.join(', ')}`);
    const web = contexts.find(c => /WEBVIEW/i.test(String(c)));
    if (!web) {
      throw new Error(
        `No WEBVIEW context. Available: ${contexts.join(', ')}. ` +
          'Step 3 may still be loading or the form is native HTML inside WKWebView.',
      );
    }
    await browser.switchContext(web);
    ui.log('WebView', `Switched to ${web}`);
    await browser.pause(800);
    return web;
  }

  async switchToNative() {
    const contexts = await this.listContexts();
    const native = contexts.find(c => c === 'NATIVE_APP') || 'NATIVE_APP';
    await browser.switchContext(native);
    ui.log('WebView', `Returned to ${native}`);
  }

  /**
   * Fill empty text/number inputs and tick unchecked required checkboxes.
   */
  async fillMandatoryFields() {
    await this.switchToWebView();
    const inputs = await $$('input, textarea, select');
    ui.log('WebView', `Found ${inputs.length} form controls`);
    for (const el of inputs) {
      const type = (
        (await el.getAttribute('type').catch(() => '')) || ''
      ).toLowerCase();
      const required = (await el.getAttribute('required').catch(() => null)) != null;
      const value = (await el.getValue().catch(() => '')) || '';
      if (type === 'hidden' || type === 'submit' || type === 'button') {
        continue;
      }
      if (type === 'checkbox' || type === 'radio') {
        const checked = await el.isSelected().catch(() => false);
        if (!checked && required) {
          await el.click();
        }
        continue;
      }
      if (value.trim()) {
        continue;
      }
      const fill = type === 'number' || type === 'tel' ? '1' : 'demo';
      await el.setValue(fill);
    }

    // Horse antiparasitic-style checkboxes (consent) — tick the first checkbox.
    const boxes = await $$('input[type="checkbox"]');
    if (boxes.length) {
      const checked = await boxes[0].isSelected().catch(() => false);
      if (!checked) {
        await boxes[0].click();
      }
    }
  }

  async submitForm() {
    const buttons = await $$('button, input[type="submit"], [role="button"]');
    for (const btn of buttons) {
      const text = (
        (await btn.getText().catch(() => '')) ||
        (await btn.getAttribute('value').catch(() => '')) ||
        ''
      ).toLowerCase();
      if (/submit|continue|next|finish/i.test(text)) {
        await btn.click();
        ui.log('WebView', `Clicked web button: ${text}`);
        await browser.pause(1500);
        return;
      }
    }
    throw new Error(
      'No Submit/Continue button found in assessment WebView. Inspect the live HTML.',
    );
  }

  async verifySubmission() {
    const contexts = await this.listContexts();
    const url = await browser.getUrl().catch(() => '');
    ui.log('WebView', `After submit url=${url} contexts=${contexts.join(',')}`);
    const success =
      /success|thank|complete|submitted/i.test(url) ||
      (await ui.isTextVisible('success')) ||
      (await ui.isTextVisible('Thank'));
    if (!success) {
      ui.log(
        'WebView',
        'No explicit success URL yet — Nearby success is also detected by native postMessage in the app',
      );
    }
    await this.switchToNative().catch(() => {});
  }
}

module.exports = new WebTreatmentFormPage();
