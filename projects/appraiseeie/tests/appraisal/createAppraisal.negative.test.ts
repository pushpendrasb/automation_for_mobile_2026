/**
 * Appraisee IE — Create Appraisal, negative case: duplicate registration
 * carried all the way through to final SAVE.
 *
 * Uses the SAME registration (141KY51) on both Vehicle Required and Vehicle
 * Trade In, then runs the identical flow as the successful happy path
 * (createAppraisal.flow.test.ts, untouched — same helpers, same selectors)
 * through Vehicle Damage → Vehicle Photos → SAVE.
 *
 * completePhotosStep's own SAVE verification (CreateAppraisalPage.
 * verifySaveSucceeded) throws when the app doesn't actually submit. This
 * test expects that throw: PASS when it's thrown (submission rejected),
 * FAIL when completePhotosStep returns normally (submission unexpectedly
 * went through with a duplicate registration).
 *
 * The app does show a dedicated validation message for this case
 * ("Registration Number of Vehicle Required and Vehicle Trade In can't be
 * the same") — verifySaveSucceeded looks for it (and other error phrasing)
 * and surfaces the app's own text in the thrown error, which this test
 * captures verbatim for the report instead of assuming a generic timeout.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { appraisalData } from '../../data/appraisalData';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep, clientLog } from '../../helpers/clientLog';
import { dumpPageSource } from '../../helpers/debugDump';
import {
  injectSamplePhotoToSimulator,
  injectVehiclePhotoFixturesToSimulator,
} from '../../helpers/iosPhotos';
import { setTestExtras } from '@mobile-automation/appium-core/utils/testContext';

const EXPECTED_SAVE_ERROR =
  "Registration Number of Vehicle Required and Vehicle Trade In can't be the same";
const SAVE_ACTION = 'Tapped SAVE on Vehicle Photos step';
const SAVE_PAGE = 'Vehicle Photos (page 4 of 4)';

const DUPLICATE_REGISTRATION = '141KY51';

describe('AppraiseeIE — Create Appraisal (negative: duplicate registration)', () => {
  before(async () => {
    injectSamplePhotoToSimulator();
    injectVehiclePhotoFixturesToSimulator();
    await ensureLoggedIn();
  });

  it('AP-CA-N01: same registration on Vehicle Required and Trade In fails at submission', async () => {
    clientStep('Open Create Appraisal from side menu');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();

    clientStep('Vehicle Required — fill with the duplicate registration');
    await CreateAppraisalPage.assertNameValidationOnEmptyNext();
    const mobile = appraisalData.randomMobile();
    await CreateAppraisalPage.fillCustomerAndRegistration({
      name: appraisalData.customerName,
      email: appraisalData.customerEmail,
      mobile,
      registration: DUPLICATE_REGISTRATION,
    });
    await CreateAppraisalPage.completeVehicleRequiredStep();

    clientStep(
      `Vehicle Trade In — SAME registration (${DUPLICATE_REGISTRATION}) as Vehicle Required`
    );
    await CreateAppraisalPage.completeTradeInStep(
      DUPLICATE_REGISTRATION,
      appraisalData.mileage
    );

    clientStep('Vehicle Damage — tyre / alloy selection and photos');
    await CreateAppraisalPage.completeDamageStep(
      appraisalData.tyreDamage,
      appraisalData.alloyDamage
    );

    clientStep('Vehicle Photos — add images and attempt SAVE (expect rejection)');
    let saveError: Error | null = null;
    try {
      await CreateAppraisalPage.completePhotosStep(appraisalData.vehiclePhotoSlots);
    } catch (err) {
      saveError = err instanceof Error ? err : new Error(String(err));
    }

    // Error detected → capture it, mark PASS, and stop here. No further
    // navigation/interaction happens below — the assertion just records the
    // outcome for mocha/the report before the spec (and its Appium session)
    // closes normally.
    if (!saveError) {
      await dumpPageSource('duplicate_registration_unexpectedly_succeeded');
      clientLog(
        `FAILURE: appraisal was created successfully with duplicate registration ` +
          `${DUPLICATE_REGISTRATION} on both Vehicle Required and Vehicle Trade In — expected rejection.`
      );
      setTestExtras({
        expectedError: EXPECTED_SAVE_ERROR,
        actualError: 'None — SAVE unexpectedly succeeded',
        pageContext: SAVE_PAGE,
        action: SAVE_ACTION,
      });
    } else {
      clientLog(`Confirmed: submission was rejected — ${saveError.message}`);
      setTestExtras({
        expectedError: EXPECTED_SAVE_ERROR,
        actualError: saveError.message,
        pageContext: SAVE_PAGE,
        action: SAVE_ACTION,
      });
    }

    expect(saveError).not.toBe(null);
  });
});
