/**
 * Vehicle Photos — WITH damage, via addVehiclePhotoWithDamage. The app has
 * no distinct "Rear damage" / "Front/Rear damage" UI — damage is marked
 * per-photo on EditImageVC (confirmed by inspecting TradeIn.mm/EditImageVC.m
 * and the accessibility tree; see CreateAppraisalPage.addSingleVehiclePhoto).
 * "Rear damage" and "Front/Rear damage" below are covered as: mark Rear,
 * then mark both Front and Rear (two independent per-slot calls — there is
 * no combined "Front/Rear" slot to click as one).
 *
 * Navigation happens once in `before`, not per scenario — see
 * vehiclePhotos.noDamage.test.ts for why: "Create New Appraisal" resumes
 * the in-progress draft rather than starting a new one.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';
import { injectVehiclePhotoFixturesToSimulator } from '../../helpers/iosPhotos';

describe('AppraiseeIE — Vehicle Photos (with damage)', () => {
  before(async () => {
    injectVehiclePhotoFixturesToSimulator();
    await ensureLoggedIn();

    clientStep('Open Create Appraisal, jump straight to Vehicle Photos');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();
    await CreateAppraisalPage.jumpToVehiclePhotosTab();
    await CreateAppraisalPage.waitForPhotosStep();
  });

  it('AP-VP-D01: Rear — add photo with Rear damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithDamage({ side: 'Rear', damage: 'SCRATCH' });
  });

  it('AP-VP-D02: Front/Rear — add photos with Front/Rear damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithDamage({ side: 'Front', damage: 'SCRATCH' });
    await CreateAppraisalPage.addVehiclePhotoWithDamage({ side: 'Rear', damage: 'SCRATCH' });
  });
});
