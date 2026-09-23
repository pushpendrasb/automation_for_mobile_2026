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
 * Note: the app has no dedicated "duplicate registration" error distinct
 * from any other SAVE failure (see verifySaveSucceeded's own comment) — a
 * PASS here means "SAVE was rejected", and the captured error message is
 * logged so the actual reason is visible rather than assumed.
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

    if (!saveError) {
      await dumpPageSource('duplicate_registration_unexpectedly_succeeded');
      clientLog(
        `FAILURE: appraisal was created successfully with duplicate registration ` +
          `${DUPLICATE_REGISTRATION} on both Vehicle Required and Vehicle Trade In — expected rejection.`
      );
    } else {
      clientLog(`Confirmed: submission was rejected — ${saveError.message}`);
    }

    expect(saveError).not.toBe(null);
  });
});
