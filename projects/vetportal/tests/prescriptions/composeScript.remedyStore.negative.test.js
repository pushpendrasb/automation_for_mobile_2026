/**
 * Compose New Script → Animal Remedy Store (Prescribing) — negative cases.
 * Nothing is submitted: every case stops at a validation toast.
 * Address / Herd No behave as in Veterinary Practice (VPO-CS-N02, VPO-CS-N03).
 */
const LoginPage = require('../../pages/LoginPage');
const ComposeScriptPage = require('../../pages/ComposeScriptPage');
const { testData, composeData } = require('../../data/testData');

describe('VetPortal Compose Script (Animal Remedy Store) — Negative', () => {
  before(async () => {
    // Reuse an existing session; sign in with .env credentials only if signed out.
    await LoginPage.ensureLoggedIn(() => ({ email: testData.email, password: testData.password }));
  });

  beforeEach(async () => {
    await ComposeScriptPage.openFromHome({ format: 'remedyStore' });
    await ComposeScriptPage.goToClientTab();
  });

  afterEach(async () => {
    await ComposeScriptPage.leave();
  });

  it('VPO-CR-N01: Remedy Store: Next with no client picked shows "Enter/select client name"', async () => {
    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.clientBlankToast);
    expect(await ComposeScriptPage.isOnMedicineTab()).toBe(false);
  });

  it('VPO-CR-N02: Next without a dispenser shows "Please select a dispenser"', async () => {
    await ComposeScriptPage.selectClient(composeData.remedyClientName);
    await ComposeScriptPage.selectAnimal(composeData.animal);
    expect(await ComposeScriptPage.getDispenser()).toBe('');

    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.dispenserBlankToast);
    expect(await ComposeScriptPage.isOnMedicineTab()).toBe(false);
  });

  it('VPO-CR-N03: Compose and Prescribe with no medicine shows "Please add medicines or upload script"', async () => {
    await ComposeScriptPage.selectClient(composeData.remedyClientName);
    await ComposeScriptPage.selectAnimal(composeData.animal);
    await ComposeScriptPage.selectDispenser(composeData.dispenserName);
    await ComposeScriptPage.selectBranch(composeData.branchName);
    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForMedicineTab();

    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForToast(composeData.noMedicineToast);
    expect(await ComposeScriptPage.medicineCount()).toBe(0);
  });
});
