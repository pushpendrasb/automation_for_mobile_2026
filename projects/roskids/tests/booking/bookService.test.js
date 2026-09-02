/**
 * E2E: RosKids Book Service (positive path).
 *
 * Flow: Login → Book A Service → Week → Steps 1–7 → Summary →
 * Add-child No → Continue → Pay Now → Payment Gateway
 * (stops at gateway unless Thank you appears).
 *
 * Requires valid credentials in projects/roskids/.env.
 * Uses visible text / accessibility labels (no app source changes required).
 */
const BookServicePage = require('../../pages/BookServicePage');

describe('RosKids - Book Service', () => {
  it('BS-E2E-01: should successfully book a service through to payment gateway', async () => {
    // —— Home (skip Sign In if already logged in) ——
    await BookServicePage.ensureOnHome();

    // —— Open Book Service ——
    await BookServicePage.openBookService();

    // —— Step 0: week ——
    await BookServicePage.selectFirstWeek();

    // —— Step 1: Add Child ——
    await BookServicePage.waitForStep(1);
    await BookServicePage.selectFirstChild();
    await BookServicePage.tapNext(1);
    await BookServicePage.waitForStep(2);

    // —— Step 2: Allergy (default No) ——
    await BookServicePage.tapNext(2);
    await BookServicePage.waitForStep(3);

    // —— Step 3: Morning slots — 2 hours every available day ——
    await BookServicePage.completeMorningSlots();
    await BookServicePage.tapNext(3);
    await BookServicePage.waitForStep(4);

    // —— Step 4: Morning transport (default No) ——
    await BookServicePage.tapNext(4);
    await BookServicePage.waitForStep(5);

    // —— Step 5: Afternoon childcare → No ——
    await BookServicePage.selectAfternoonChildcareNo();
    await BookServicePage.tapNext(5);
    await BookServicePage.waitForStep(6);

    // —— Step 6: Afternoon transport (default No) ——
    await BookServicePage.tapNext(6);
    await BookServicePage.waitForStep(7);

    // —— Step 7: both consent terms ——
    await BookServicePage.completeStep7Terms();
    await BookServicePage.tapNext(7);

    // —— Summary ——
    await BookServicePage.acceptSummaryTermsAndSubmit();

    // —— One more child? No → Continue ——
    await BookServicePage.declineAddAnotherChildAndContinue();

    // —— Payment ——
    await BookServicePage.payNowAndVerifyGateway();

    // —— Final validation (optional if gateway needs manual auth) ——
    await BookServicePage.assertBookingSuccessIfPresent(90000);
  });
});
