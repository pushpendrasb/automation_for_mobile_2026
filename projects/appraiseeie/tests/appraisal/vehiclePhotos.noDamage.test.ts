/**
 * Vehicle Photos — WITHOUT damage, one dedicated call per slot via
 * addVehiclePhotoWithoutDamage. Jumps straight to the tab (same shortcut as
 * vehiclePhotos.direct.test.ts) for fast iteration; does not touch the
 * existing addVehiclePhotosForSlots flow used by that file or by
 * createAppraisal.flow.test.ts.
 *
 * Navigation happens once in `before`, not per scenario: "Create New
 * Appraisal" from the side menu resumes the in-progress draft rather than
 * starting a new one, so re-opening it between `it`s would land back on
 * Vehicle Photos instead of Vehicle Required and hang waiting for a screen
 * that never appears. All four slots are filled in the same appraisal
 * session, same as the existing addVehiclePhotosForSlots flow.
 */
import HomePage from '../../pages/HomePage';
import CreateAppraisalPage from '../../pages/CreateAppraisalPage';
import { ensureLoggedIn } from '../../helpers/session';
import { clientStep } from '../../helpers/clientLog';
import { injectVehiclePhotoFixturesToSimulator } from '../../helpers/iosPhotos';

describe('AppraiseeIE — Vehicle Photos (without damage)', () => {
  before(async () => {
    injectVehiclePhotoFixturesToSimulator();
    await ensureLoggedIn();

    clientStep('Open Create Appraisal, jump straight to Vehicle Photos');
    await HomePage.openCreateAppraisal();
    await CreateAppraisalPage.waitForVehicleRequired();
    await CreateAppraisalPage.jumpToVehiclePhotosTab();
    await CreateAppraisalPage.waitForPhotosStep();
  });

  it('AP-VP-N01: Front — add photo without damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithoutDamage({ side: 'Front' });
  });

  it('AP-VP-N02: Rear — add photo without damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithoutDamage({ side: 'Rear' });
  });

  it('AP-VP-N03: Driver Front — add photo without damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithoutDamage({ side: 'DriverFront' });
  });

  it('AP-VP-N04: Driver Rear — add photo without damage', async () => {
    await CreateAppraisalPage.addVehiclePhotoWithoutDamage({ side: 'DriverRear' });
  });
});
