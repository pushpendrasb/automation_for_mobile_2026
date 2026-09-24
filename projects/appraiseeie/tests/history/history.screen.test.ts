/**
 * Appraisee IE — Appraisals History.
 *
 * Flow:
 * 1. Sign in (or reuse the current home session)
 * 2. Side menu → APPRAISALS HISTORY
 * 3. Dismiss the first-visit tutorial (Skip) if it appears
 * 4. My Appraisals — open a random card from the first five
 * 5. On that card, open Vehicle Required, Trade In, Damage, and Photos and scroll each
 * 6. Back, then repeat on All Appraisals
 */
import HomePage from '../../pages/HomePage';
import HistoryPage from '../../pages/HistoryPage';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';

describe('AppraiseeIE — Appraisals History', () => {
  before(async () => {
    await ensureLoggedIn();
  });

  it('AP-HI-P01: Open a random history card on My Appraisals and All Appraisals', async () => {
    clientStep('Open Appraisals History from the side menu');
    await HomePage.openAppraisalsHistory();
    await HistoryPage.waitForHistory();

    clientStep('My Appraisals — open a random card from the first five');
    await HistoryPage.openMyAppraisals();
    await HistoryPage.openRandomCardAndReturn('My Appraisals');

    clientStep('All Appraisals — open a random card from the first five');
    await HistoryPage.openAllAppraisals();
    await HistoryPage.openRandomCardAndReturn('All Appraisals');
  });
});
