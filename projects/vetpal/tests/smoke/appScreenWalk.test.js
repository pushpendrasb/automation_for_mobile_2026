/**
 * One-command screen walk: login, every Home tile, every menu screen.
 * Each tile must return to Home before the next `home.tile.N` tap.
 *
 * Run: npm run test:ios:screens
 * Skip: Delete Account, Mail Us, Clear All, password update, Logout OK.
 */
const HomePage = require('../../pages/HomePage');
const ScreenWalkPage = require('../../pages/ScreenWalkPage');
const { HOME_TILES } = require('../../data/screenWalk');

describe('Vet-Pal — login then every tile and screen', () => {
  before(async () => {
    await ScreenWalkPage.loginToHome();
  });

  afterEach(async () => {
    await ScreenWalkPage.returnToHome();
  });

  it('VP-SM-001: Login then Home tiles are present', async () => {
    await ScreenWalkPage.assertHomeTilesPresent();
  });

  HOME_TILES.forEach((tile, index) => {
    const id = `VP-SM-${String(index + 2).padStart(3, '0')}`;
    it(`${id}: ${tile.name}`, async () => {
      await ScreenWalkPage.visitHomeTile(tile);
      if (!(await HomePage.isHomeVisible())) {
        throw new Error(`Did not return to Home after ${tile.name}`);
      }
    });
  });

  it('VP-SM-010: Notifications header', async () => {
    await ScreenWalkPage.visitNotifications();
    if (!(await HomePage.isHomeVisible())) {
      throw new Error('Did not return to Home after Notifications');
    }
  });

  it('VP-SM-011: Side menu screens — skip Logout confirm and Mail Us', async () => {
    await ScreenWalkPage.visitSideMenuScreens();
    if (!(await HomePage.isHomeVisible())) {
      throw new Error('Did not return to Home after side menu walk');
    }
  });
});
