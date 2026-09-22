/**
 * Vehicle Photos (page 4) in isolation — jumps straight to the tab instead
 * of running the full 3-step wizard first, for fast iteration on just the
 * photo-upload process. Uses the same page-object methods as the full flow
 * (createAppraisal.flow.test.ts), so a fix here applies to both.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { appraisalData } from '../../data/appraisalData';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';
import { injectVehiclePhotoFixturesToSimulator } from '../../helpers/iosPhotos';

describe('AppraiseeIE — Vehicle Photos (direct)', () => {
  before(async () => {
    injectVehiclePhotoFixturesToSimulator();
    await ensureLoggedIn();
  });

  it('AP-CA-P01b: jump to Vehicle Photos tab and fill every slot', async () => {
    clientStep('Open Create Appraisal, jump straight to Vehicle Photos');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();
    await CreateAppraisalPage.jumpToVehiclePhotosTab();
    await CreateAppraisalPage.waitForPhotosStep();

    clientStep('Add a photo to every vehicle-photo slot');
    await CreateAppraisalPage.addVehiclePhotosForSlots(appraisalData.vehiclePhotoSlots);
  });
});
