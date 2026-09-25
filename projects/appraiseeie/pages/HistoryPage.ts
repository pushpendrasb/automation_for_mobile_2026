/**
 * Appraisals History — HistoryViewController.
 *
 * Opened from the side menu row APPRAISALS HISTORY. The screen shows:
 * - APPRAISEE HISTORY (default) and APPRAISEE ARCHIVES tabs
 * - My Appraisals / All Appraisals (managers and garage admins only)
 * - A search field
 * - Either history rows (APPR-ID) or the empty copy
 *   "You will see your historical appraisal list here…"
 *
 * First visit can cover the list with TutorialVC. Skip dismisses it.
 */
import { TEST_IDS } from '../data/testIds';
import { clientLog } from '../helpers/clientLog';

/** One visible history row, read from the APPR-ID label. */
export type HistoryRowSummary = {
  appraisalId: string;
};

export class HistoryPage {
  /**
   * First-time history overlay (TutorialVC, tutType 3). Button title is "Skip".
   */
  private skipSelectors(): string[] {
    return [
      '~Skip',
      '-ios predicate string:label == "Skip" OR name == "Skip"',
      '-ios class chain:**/XCUIElementTypeButton[`label == "Skip" OR name == "Skip"`]',
    ];
  }

  private searchSelectors(): string[] {
    return [
      '-ios class chain:**/XCUIElementTypeSearchField',
      '-ios predicate string:type == "XCUIElementTypeSearchField"',
    ];
  }

  private historyTabSelectors(): string[] {
    return [
      '~APPRAISEE HISTORY',
      '-ios predicate string:label == "APPRAISEE HISTORY" OR name == "APPRAISEE HISTORY"',
    ];
  }

  private emptySelectors(): string[] {
    return [
      '-ios predicate string:label CONTAINS[c] "historical appraisal" OR name CONTAINS[c] "historical appraisal" OR value CONTAINS[c] "historical appraisal"',
      '-ios predicate string:label CONTAINS[c] "no appraisals" OR name CONTAINS[c] "no appraisals"',
    ];
  }

  /**
   * Tap Skip once if the history tutorial is showing right now.
   */
  private async tapSkipIfVisible(): Promise<boolean> {
    for (const sel of this.skipSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) {
          await el.click();
          clientLog('History tutorial dismissed (Skip)');
          await browser.pause(300);
          return true;
        }
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Dismiss the history tutorial if Skip appears within a short window.
   * No-op when the tutorial was already seen.
   */
  async dismissTutorialIfVisible(timeoutMs = 4000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.tapSkipIfVisible()) return;
      await browser.pause(200);
    }
  }

  /**
   * True when the APPRAISEE HISTORY tab is on screen.
   */
  async isDisplayed(): Promise<boolean> {
    for (const sel of this.historyTabSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Wait until HistoryViewController is on screen (menu closed, tutorial gone).
   */
  async waitForHistory(timeoutMs = 20000): Promise<void> {
    clientLog('Waiting for the Appraisals History screen');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.tapSkipIfVisible();
      if (await this.isDisplayed()) {
        clientLog('Appraisals History screen is ready');
        return;
      }
      await browser.pause(250);
    }
    throw new Error(
      'Appraisals History did not open. Expected the APPRAISEE HISTORY tab.'
    );
  }

  /**
   * Visible texts that include an appraisal id.
   */
  private async appraisalIdLabels(): Promise<string[]> {
    const nodes = await $$(
      '-ios predicate string:label CONTAINS "APPR-ID" OR name CONTAINS "APPR-ID" OR value CONTAINS "APPR-ID"'
    );
    const labels: string[] = [];
    for (const node of nodes) {
      if (!(await node.isDisplayed().catch(() => false))) continue;
      const text =
        (await node.getText().catch(() => '')) ||
        (await node.getAttribute('label').catch(() => '')) ||
        (await node.getAttribute('name').catch(() => '')) ||
        '';
      const trimmed = text.replace(/\s+/g, ' ').trim();
      if (trimmed) labels.push(trimmed);
    }
    return labels;
  }

  /**
   * True when the empty-state copy is on screen.
   */
  async isEmptyMessageVisible(): Promise<boolean> {
    for (const sel of this.emptySelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Wait until the list has finished loading: rows, or the empty message.
   */
  async waitForListSettled(timeoutMs = 25000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ids = await this.appraisalIdLabels();
      if (ids.length > 0) return;
      if (await this.isEmptyMessageVisible()) return;
      await browser.pause(400);
    }
    throw new Error(
      'History list did not settle. No APPR-ID rows and no empty-state message.'
    );
  }

  /**
   * Read the on-screen history rows.
   */
  async readVisibleRows(): Promise<HistoryRowSummary[]> {
    const idLabels = await this.appraisalIdLabels();
    const rows: HistoryRowSummary[] = [];
    for (const label of idLabels) {
      const match = label.match(/APPR-ID:\s*(\S+)/i);
      rows.push({
        appraisalId: match ? match[1] : label,
      });
    }
    return rows;
  }

  /**
   * Search field on the history table header.
   */
  async isSearchVisible(): Promise<boolean> {
    for (const sel of this.searchSelectors()) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Confirm search is present and the list is either populated or empty.
   * Returns how many appraisal rows were visible.
   */
  async checkHistoryList(): Promise<{ empty: boolean; count: number; sample: string[] }> {
    const searchVisible = await this.isSearchVisible();
    if (!searchVisible) {
      throw new Error('History search field is not visible');
    }
    clientLog('History search field is visible');

    await this.waitForListSettled();
    const empty = await this.isEmptyMessageVisible();
    const rows = await this.readVisibleRows();

    if (empty && rows.length === 0) {
      clientLog('History list is empty — no appraisals to view');
      return { empty: true, count: 0, sample: [] };
    }

    if (rows.length === 0) {
      throw new Error('History screen is up but no rows and no empty message were found');
    }

    const sample = rows.slice(0, 5).map((row) => row.appraisalId);
    clientLog(
      `History list shows ${rows.length} visible appraisal(s): ${sample.join(', ')}`
    );
    return { empty: false, count: rows.length, sample };
  }

  /**
   * Tap a labeled button if it is on screen. Returns false when the role
   * does not show that control (sales people have no My/All tabs).
   */
  private async tapIfVisible(selectors: string[], log: string): Promise<boolean> {
    for (const sel of selectors) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) {
          await el.click();
          clientLog(log);
          await browser.pause(400);
          return true;
        }
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Managers: switch to All Appraisals and wait for that list to settle.
   * Sales accounts do not have this tab — returns false and does nothing.
   */
  async openAllAppraisalsIfPresent(): Promise<boolean> {
    const opened = await this.tapIfVisible(
      [
        '~All Appraisals',
        '-ios predicate string:label == "All Appraisals" OR name == "All Appraisals"',
      ],
      'Opened All Appraisals'
    );
    if (!opened) {
      clientLog('All Appraisals tab is not on this account — staying on My history');
      return false;
    }
    await this.waitForListSettled();
    return true;
  }

  /**
   * Open APPRAISEE ARCHIVES, confirm that list loads, then return to history.
   */
  async checkArchivesThenReturn(): Promise<void> {
    const opened = await this.tapIfVisible(
      [
        '-ios predicate string:label CONTAINS "ARCHIVES" OR name CONTAINS "ARCHIVES"',
        '-ios class chain:**/XCUIElementTypeButton[`label CONTAINS "ARCHIVES"`]',
      ],
      'Opened Appraisee Archives'
    );
    if (!opened) {
      throw new Error('APPRAISEE ARCHIVES tab was not found on the history screen');
    }
    await this.waitForListSettled();
    const rows = await this.readVisibleRows();
    const empty = await this.isEmptyMessageVisible();
    if (rows.length === 0 && empty) {
      clientLog('Archives list is empty');
    } else {
      clientLog(`Archives list shows ${rows.length} visible appraisal(s)`);
    }

    const back = await this.tapIfVisible(
      this.historyTabSelectors(),
      'Returned to Appraisee History'
    );
    if (!back) {
      throw new Error('Could not return to APPRAISEE HISTORY from Archives');
    }
    await this.waitForListSettled();
  }

  /**
   * Visible history cards, top to bottom. Short chrome rows are ignored.
   */
  private async historyCards(): Promise<WebdriverIO.Element[]> {
    const cells = await $$('-ios class chain:**/XCUIElementTypeCell');
    const ranked: { el: WebdriverIO.Element; y: number }[] = [];
    for (const cell of cells) {
      if (!(await cell.isDisplayed().catch(() => false))) continue;
      const size = await cell.getSize().catch(() => ({ width: 0, height: 0 }));
      const loc = await cell.getLocation().catch(() => ({ x: 0, y: 0 }));
      if (size.height < 100 || size.width < 180) continue;
      ranked.push({ el: cell, y: loc.y });
    }
    ranked.sort((a, b) => a.y - b.y);
    return ranked.map((row) => row.el);
  }

  /**
   * Wait until at least one history card is on screen.
   */
  async waitForCards(timeoutMs = 25000): Promise<WebdriverIO.Element[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cards = await this.historyCards();
      if (cards.length > 0) return cards;
      await browser.pause(400);
    }
    throw new Error('No appraisal cards on this history tab');
  }

  /**
   * Open My Appraisals (first tab) and wait for its cards.
   */
  async openMyAppraisals(): Promise<void> {
    const opened = await this.tapIfVisible(
      [
        '~My Appraisals',
        '-ios predicate string:label == "My Appraisals" OR name == "My Appraisals"',
      ],
      'Opened My Appraisals'
    );
    if (!opened) {
      throw new Error('My Appraisals tab was not found on the history screen');
    }
    await this.waitForCards();
  }

  /**
   * Open All Appraisals (second tab) and wait for its cards.
   */
  async openAllAppraisals(): Promise<void> {
    const opened = await this.tapIfVisible(
      [
        '~All Appraisals',
        '-ios predicate string:label == "All Appraisals" OR name == "All Appraisals"',
      ],
      'Opened All Appraisals'
    );
    if (!opened) {
      throw new Error('All Appraisals tab was not found on the history screen');
    }
    await this.waitForCards();
  }

  /**
   * Tap the left side of a card so row selection fires, not the chat/price buttons.
   */
  private async tapCard(card: WebdriverIO.Element): Promise<void> {
    const loc = await card.getLocation();
    const size = await card.getSize();
    const x = Math.round(loc.x + Math.min(size.width * 0.28, 120));
    const y = Math.round(loc.y + size.height * 0.45);
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ duration: 0, x, y })
      .down({ button: 0 })
      .pause(80)
      .up({ button: 0 })
      .perform();
    await browser.releaseActions().catch(() => undefined);
  }

  /**
   * True when TradeDetailVC is showing (required details copy or the back button).
   */
  async isDetailDisplayed(): Promise<boolean> {
    const selectors = [
      `~${TEST_IDS.tradeDetail.screen}`,
      `~${TEST_IDS.tradeDetail.back}`,
      '~Back',
      '-ios predicate string:label CONTAINS "VEHICLE REQUIRED DETAILS" OR name CONTAINS "VEHICLE REQUIRED DETAILS"',
      '-ios predicate string:label CONTAINS "VEHICLE TRADE IN DETAILS" OR name CONTAINS "VEHICLE TRADE IN DETAILS"',
    ];
    for (const sel of selectors) {
      try {
        const el = await $(sel);
        if (await el.isDisplayed().catch(() => false)) return true;
      } catch {
        /* next */
      }
    }
    return false;
  }

  /**
   * Wait until the tapped card has opened its detail screen.
   */
  async waitForDetail(timeoutMs = 20000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isDetailDisplayed()) {
        clientLog('Appraisal detail screen is open');
        return;
      }
      await browser.pause(300);
    }
    throw new Error('Appraisal detail did not open after tapping a history card');
  }

  /**
   * Leave TradeDetailVC and return to the history list.
   * Uses trade_detail_back when the app was rebuilt with that id, otherwise
   * the small button in the top-left of the detail header.
   */

  /**
   * The four TradeDetailVC pages, left to right.
   * Section titles are the headings we scroll until they appear.
   */
  private detailTabs(): { name: string; id: string; index: number; sections: string[] }[] {
    return [
      {
        name: 'Vehicle Required',
        id: TEST_IDS.tradeDetail.tabRequired,
        index: 0,
        sections: ['CUSTOMER DETAILS', 'VEHICLE REQUIRED DETAILS', 'PRICING', 'NOTES'],
      },
      {
        name: 'Vehicle Trade In',
        id: TEST_IDS.tradeDetail.tabTradeIn,
        index: 1,
        sections: ['VEHICLE TRADE IN DETAILS', 'NCT EXPIRY', 'TAX EXPIRY'],
      },
      {
        name: 'Vehicle Damage',
        id: TEST_IDS.tradeDetail.tabDamage,
        index: 2,
        sections: ['TYRES', 'TYRES THREAD', 'SERVICE HISTORY', 'INVENTORY'],
      },
      {
        name: 'Vehicle Photos',
        id: TEST_IDS.tradeDetail.tabPhotos,
        index: 3,
        sections: [],
      },
    ];
  }

  /**
   * True when a section heading is on screen.
   */
  private async isSectionVisible(title: string): Promise<boolean> {
    const sel = `-ios predicate string:label == "${title}" OR name == "${title}"`;
    try {
      const el = await $(sel);
      return await el.isDisplayed().catch(() => false);
    } catch {
      return false;
    }
  }

  /**
   * The four icon tabs under the detail header, left to right.
   * Used when the app build does not yet have trade_detail_tab_* ids.
   */
  private async detailTabButtons(): Promise<WebdriverIO.Element[]> {
    const buttons = await $$('-ios class chain:**/XCUIElementTypeButton');
    const { width, height } = await browser.getWindowSize();
    const ranked: { el: WebdriverIO.Element; x: number; y: number }[] = [];
    for (const btn of buttons) {
      if (!(await btn.isDisplayed().catch(() => false))) continue;
      const loc = await btn.getLocation().catch(() => null);
      const size = await btn.getSize().catch(() => null);
      if (!loc || !size) continue;
      if (size.height < 50 || size.width < width * 0.12 || size.width > width * 0.4) continue;
      if (loc.y < 40 || loc.y > height * 0.34) continue;
      ranked.push({ el: btn, x: loc.x, y: loc.y });
    }
    ranked.sort((a, b) => a.x - b.x);
    return ranked.slice(0, 4).map((row) => row.el);
  }

  /**
   * Open one detail tab by accessibility id, or by its place in the icon row.
   */
  private async openDetailTab(tab: { name: string; id: string; index: number }): Promise<void> {
    const byId = await $(`~${tab.id}`);
    if (await byId.isDisplayed().catch(() => false)) {
      await byId.click();
      clientLog(`Opened ${tab.name}`);
      await browser.pause(600);
      return;
    }
    const buttons = await this.detailTabButtons();
    if (!buttons[tab.index]) {
      throw new Error(`${tab.name} tab was not found on the detail screen`);
    }
    await buttons[tab.index].click();
    clientLog(`Opened ${tab.name}`);
    await browser.pause(600);
  }

  /**
   * One upward swipe on the detail body (below the icon tabs).
   */
  private async swipeDetailUp(): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    const x = Math.floor(width * 0.5);
    const fromY = Math.floor(height * 0.78);
    const toY = Math.floor(height * 0.46);
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ duration: 0, x, y: fromY })
      .down({ button: 0 })
      .pause(80)
      .move({ duration: 450, x, y: toY })
      .up({ button: 0 })
      .perform();
    await browser.releaseActions().catch(() => undefined);
    await browser.pause(500);
  }

  /**
   * Scroll the current detail page until its section headings have been shown.
   * Photos has no headings — a short scroll is enough to show the images.
   */
  private async scrollDetailSections(name: string, sections: string[]): Promise<void> {
    const seen: string[] = [];
    const note = async () => {
      for (const section of sections) {
        if (seen.includes(section)) continue;
        if (await this.isSectionVisible(section)) {
          seen.push(section);
          clientLog(`${name}: showing ${section}`);
        }
      }
    };

    await note();
    const maxSwipes = sections.length === 0 ? 2 : 5;
    for (let i = 0; i < maxSwipes; i++) {
      if (sections.length > 0 && seen.length === sections.length) break;
      await this.swipeDetailUp();
      await note();
    }

    if (sections.length === 0) {
      clientLog(`${name}: scrolled the photo page`);
      return;
    }
    if (seen.length === 0) {
      throw new Error(`${name} opened but none of its sections were on screen`);
    }
    clientLog(`${name}: scrolled ${seen.length} section(s)`);
  }

  /**
   * Walk Vehicle Required, Vehicle Trade In, Vehicle Damage, and Vehicle Photos.
   */
  async reviewAllDetailTabs(): Promise<void> {
    for (const tab of this.detailTabs()) {
      await this.openDetailTab(tab);
      await this.scrollDetailSections(tab.name, tab.sections);
      await browser.pause(800);
    }
  }

  async goBackFromDetail(): Promise<void> {
    const byId = await $(`~${TEST_IDS.tradeDetail.back}`);
    if (await byId.isDisplayed().catch(() => false)) {
      await byId.click();
      clientLog('Back from appraisal detail');
      await browser.pause(500);
      return;
    }

    const buttons = await $$('-ios class chain:**/XCUIElementTypeButton');
    const { height } = await browser.getWindowSize();
    let best: WebdriverIO.Element | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const btn of buttons) {
      if (!(await btn.isDisplayed().catch(() => false))) continue;
      const loc = await btn.getLocation().catch(() => null);
      const size = await btn.getSize().catch(() => null);
      if (!loc || !size) continue;
      if (loc.y > height * 0.22) continue;
      if (size.width > 70 || size.height > 70) continue;
      const score = loc.x + loc.y;
      if (score < bestScore) {
        bestScore = score;
        best = btn;
      }
    }
    if (!best) {
      throw new Error('Could not find the detail Back button');
    }
    await best.click();
    clientLog('Back from appraisal detail');
    await browser.pause(500);
  }

  /**
   * On the current tab, open a random card from the first five,
   * stay on details for 2–3 seconds, then go back to the list.
   */
  async openRandomCardAndReturn(tabName: string): Promise<void> {
    const cards = await this.waitForCards();
    const pool = Math.min(5, cards.length);
    const index = Math.floor(Math.random() * pool);
    clientLog(
      `${tabName}: opening card ${index + 1} of the first ${pool} (${cards.length} visible)`
    );
    await this.tapCard(cards[index]);
    await this.waitForDetail();
    await this.reviewAllDetailTabs();
    await this.goBackFromDetail();
    await this.waitForHistory(20000);
    clientLog(`Returned to the history list from ${tabName}`);
  }
}

export default new HistoryPage();
