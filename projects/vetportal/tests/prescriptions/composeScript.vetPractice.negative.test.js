/**
 * Compose New Script → Veterinary Practice (Dispensing) — negative cases.
 * Nothing is submitted: every case stops at a validation toast.
 *
 * Blank address: the app fills Address from the picked client and only lets
 * a *new* client edit it (isAddNewClient is never set in this flow), so the
 * "Please enter address" toast cannot be reached. VPO-CS-N02 checks that the
 * address is prefilled and read-only instead.
 */
const LoginPage = require('../../pages/LoginPage');
const ComposeScriptPage = require('../../pages/ComposeScriptPage');
const { testData, composeData } = require('../../data/testData');

describe('VetPortal Compose Script (Veterinary Practice) — Negative', () => {
  before(async () => {
    await LoginPage.resetAppToLoginScreen();
    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    expect(await LoginPage.isLoginSuccessful(25000)).toBe(true);
  });

  beforeEach(async () => {
    await ComposeScriptPage.openFromHome();
    await ComposeScriptPage.goToClientTab();
  });

  afterEach(async () => {
    await ComposeScriptPage.leave();
  });

  it('VPO-CS-N01: Next without a client shows "Enter/select client name"', async () => {
    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.clientBlankToast);
    expect(await ComposeScriptPage.isOnMedicineTab()).toBe(false);
  });

  it('VPO-CS-N02: Address is filled from the existing client and cannot be edited', async () => {
    await ComposeScriptPage.selectClient(composeData.clientName);
    expect((await ComposeScriptPage.getAddress()).trim().length).toBeGreaterThan(0);
    expect(await ComposeScriptPage.isAddressEditable()).toBe(false);
  });

  it('VPO-CS-N03: Herd animal without a Herd No shows the Herd No toast', async () => {
    await ComposeScriptPage.selectClient(composeData.clientName);
    await ComposeScriptPage.selectAnimal(composeData.herdAnimal);
    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.herdNoToast);
    expect(await ComposeScriptPage.isOnMedicineTab()).toBe(false);
  });

  it('VPO-CS-N04: Compose and Dispense with no medicine shows "Please add medicines or upload script"', async () => {
    await ComposeScriptPage.selectClient(composeData.clientName);
    await ComposeScriptPage.selectAnimal(composeData.animal);
    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForMedicineTab();

    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.noMedicineToast);
    expect(await ComposeScriptPage.medicineCount()).toBe(0);
  });
});
