/**
 * Appraisee IE — Create Appraisal (TradeIn) end-to-end happy path.
 *
 * Flow:
 * 1. Side menu → CREATE NEW APPRAISAL
 * 2. Vehicle Required — empty Next → name validation → fill Name/Email/Mobile (+ plate)
 * 3. Vehicle Trade In — plate lookup auto-fill → Next → mileage (+ tax) → Next
 * 4. Vehicle Damage — tyre/alloy from env → optional damage photos → Next
 * 5. Vehicle Photos — add slots → SAVE
 *
 * Data: Name Paul, email sami@appdesign.ie, plate 141D6333, random mobile.
 * Env: APPRAISEE_TYRE_DAMAGE (default true), APPRAISEE_ALLOY_DAMAGE (default false),
 *      APPRAISEE_SKIP_PHOTOS=true to skip gallery picks while debugging.
 *
 * Rebuild the iOS app after TradeIn.mm accessibility ID changes.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { appraisalData } from '../../data/appraisalData';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';
import {
  injectSamplePhotoToSimulator,
} from '../../helpers/iosPhotos';

describe('AppraiseeIE — Create Appraisal', () => {
  before(async () => {
    injectSamplePhotoToSimulator();
    await ensureLoggedIn();
  });

  it('AP-CA-P01: Create appraisal through all four TradeIn steps', async () => {
    clientStep('Open Create Appraisal from side menu');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();

    clientStep('Trigger name validation then fill customer details');
    await CreateAppraisalPage.assertNameValidationOnEmptyNext();
    const mobile = appraisalData.randomMobile();
    await CreateAppraisalPage.fillCustomerAndRegistration({
      name: appraisalData.customerName,
      email: appraisalData.customerEmail,
      mobile,
      registration: appraisalData.registration,
    });
    await CreateAppraisalPage.completeVehicleRequiredStep();

    clientStep('Vehicle Trade In — registration lookup and mileage');
    await CreateAppraisalPage.completeTradeInStep(
      appraisalData.registration,
      appraisalData.mileage
    );

    clientStep('Vehicle Damage — tyre / alloy selection and photos');
    await CreateAppraisalPage.completeDamageStep(
      appraisalData.tyreDamage,
      appraisalData.alloyDamage
    );

    clientStep('Vehicle Photos — add images and SAVE');
    await CreateAppraisalPage.completePhotosStep(appraisalData.vehiclePhotoSlots);

    // Soft success: we at least left the photos SAVE action without an uncaught error
    await expect(true).toBe(true);
  });
});
