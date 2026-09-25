/**
 * Appraisee IE — Create Appraisal (TradeIn) end-to-end happy path.
 *
 * Flow:
 * 1. Side menu → CREATE NEW APPRAISAL
 * 2. Vehicle Required — fill Name/Email/Mobile (+ plate) while they are on screen, then Next
 * 3. Vehicle Trade In — plate lookup auto-fill → Next → mileage (+ tax) → Next
 * 4. Vehicle Damage — tyre/alloy from env; all 5 damage photos when DAMAGE → Next
 * 5. Vehicle Photos — add as many photos as app_images_mandatory, then SAVE
 *
 * Data: Name Paul, email sami@appdesign.ie, Vehicle Required plate 141KY51,
 *       Vehicle Trade In plate 141D6333, random mobile.
 * Env: APPRAISEE_TYRE_DAMAGE (default true), APPRAISEE_ALLOY_DAMAGE (default false),
 *      APPRAISEE_SKIP_PHOTOS=true to skip gallery picks while debugging.
 *
 * Rebuild the iOS app after TradeIn.mm accessibility ID changes.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { appraisalData } from '../../data/appraisalData';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep, clientLog } from '../../helpers/clientLog';
import {
  injectSamplePhotoToSimulator,
  injectVehiclePhotoFixturesToSimulator,
} from '../../helpers/iosPhotos';

describe('AppraiseeIE — Create Appraisal', () => {
  before(async () => {
    const damageSlots = appraisalData.damagePhotoSlotsFor(
      appraisalData.tyreDamage,
      appraisalData.alloyDamage
    );
    clientLog(
      `Photos — step 3: tyres ${appraisalData.tyreDamage ? 'DAMAGE' : 'OK'}, alloys ${appraisalData.alloyDamage ? 'DAMAGE' : 'OK'} → ` +
        `${damageSlots.length} damage slot(s); step 4: vehicle photos follow app_images_mandatory`
    );
    injectSamplePhotoToSimulator();
    injectVehiclePhotoFixturesToSimulator();
    await ensureLoggedIn();
  });

  it('AP-CA-P01: Create appraisal through all four TradeIn steps', async () => {
    clientStep('Open Create Appraisal from side menu');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();

    clientStep('Fill customer details on Vehicle Required, then continue');
    const mobile = appraisalData.randomMobile();
    await CreateAppraisalPage.fillCustomerAndRegistration({
      name: appraisalData.customerName,
      email: appraisalData.customerEmail,
      mobile,
      registration: appraisalData.registrationRequired,
    });
    await CreateAppraisalPage.completeVehicleRequiredStep();

    clientStep('Vehicle Trade In — registration lookup and mileage');
    await CreateAppraisalPage.completeTradeInStep(
      appraisalData.registrationTradeIn,
      appraisalData.mileage
    );

    clientStep('Vehicle Damage — tyre / alloy selection and photos');
    await CreateAppraisalPage.completeDamageStep(
      appraisalData.tyreDamage,
      appraisalData.alloyDamage
    );

    clientStep('Vehicle Photos — add each mandatory photo from the gallery and SAVE');
    // completePhotosStep reads the grid size (app_images_mandatory) and throws
    // if fewer photos were added than that count, or if SAVE does not submit.
    await CreateAppraisalPage.completePhotosStep();
  });
});
