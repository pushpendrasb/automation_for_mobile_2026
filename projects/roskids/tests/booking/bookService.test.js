/**
 * E2E: RosKids Book Service (positive path from the 6 step screenshots).
 *
 * Flow: Login → Book A Service → Week →
 *   1 Parent/Carer/Child Details
 *   2 Allergy Details (No)
 *   3 Breakfast Club (Yes + morning slots)
 *   4 Morning Transport (No)
 *   5 Afterschool Club (Yes + afternoon slots)
 *   6 Afternoon Transport (No)
 *   then consent checkboxes → Summary terms → Submit →
 *   another child No → Continue → Pay Now → Payment Gateway.
 *
 * Every button tap uses a testID (data/testIds.js). Rebuild the app so
 * those ids are in the binary.
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

    // —— Step 1: Parent / child / location / school ——
    await BookServicePage.waitForStep(1);
    await BookServicePage.selectFirstChild();
    await BookServicePage.tapNext(1);
    await BookServicePage.waitForStep(2);

    // —— Step 2: Allergy Details → No ——
    await BookServicePage.confirmAllergyNo();
    await BookServicePage.tapNext(2);
    await BookServicePage.waitForStep(3);

    // —— Step 3: Breakfast Club → Yes + morning slots ——
    await BookServicePage.completeMorningSlots();
    await BookServicePage.tapNext(3);
    await BookServicePage.waitForStep(4);

    // —— Step 4: Morning Transport → No ——
    await BookServicePage.confirmMorningTransportNo();
    await BookServicePage.tapNext(4);
    await BookServicePage.waitForStep(5);

    // —— Step 5: Afterschool Club → Yes + afternoon slots ——
    await BookServicePage.completeAfternoonSlots();
    await BookServicePage.tapNext(5);
    await BookServicePage.waitForStep(6);

    // —— Step 6: Afternoon Transport → No ——
    await BookServicePage.confirmAfternoonTransportNo();
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
