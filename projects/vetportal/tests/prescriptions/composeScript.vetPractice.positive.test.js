/**
 * Compose New Script → Veterinary Practice (Dispensing) — positive (VPO-CS-P01).
 * Creates a real prescription on the environment the app points at.
 *
 * Inputs (dashboard or .env): TEST_USER / TEST_PASSWORD, COMPOSE_CLIENT_NAME,
 * COMPOSE_ANIMAL, COMPOSE_MEDICINE_SEARCH, COMPOSE_QUANTITY, COMPOSE_ANIMAL_ID.
 */
const LoginPage = require('../../pages/LoginPage');
const ComposeScriptPage = require('../../pages/ComposeScriptPage');
const { testData, composeData } = require('../../data/testData');

describe('VetPortal Compose Script (Veterinary Practice) — Positive', () => {
  before(async () => {
    await LoginPage.resetAppToLoginScreen();
    await LoginPage.enterEmail(testData.email);
    await LoginPage.enterPassword(testData.password);
    await LoginPage.tapSignIn();
    expect(await LoginPage.isLoginSuccessful(25000)).toBe(true);
  });

  after(async () => {
    await ComposeScriptPage.leave().catch(() => {});
  });

  it('VPO-CS-P01: Existing client + animal + medicine, signed and submitted, creates a prescription', async () => {
    console.log(
      `Compose: client="${composeData.clientName}", animal="${composeData.animal}", ` +
        `medicine search="${composeData.medicineSearch || '(first in list)'}"`,
    );

    await ComposeScriptPage.openFromHome();
    await ComposeScriptPage.goToClientTab();

    await ComposeScriptPage.selectClient(composeData.clientName);
    expect((await ComposeScriptPage.getAddress()).trim().length).toBeGreaterThan(0);

    await ComposeScriptPage.selectAnimal(composeData.animal);
    expect(await ComposeScriptPage.getAnimal()).toContain(composeData.animal);

    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForMedicineTab();

    await ComposeScriptPage.addMedicine({
      search: composeData.medicineSearch,
      quantity: composeData.quantity,
      animalId: composeData.animalId,
    });
    expect(await ComposeScriptPage.medicineCount()).toBe(1);

    await ComposeScriptPage.signAndComplete();
    const rxNo = await ComposeScriptPage.confirmSuccess(composeData.successMessage);
    console.log(`Prescription created — RX NO: ${rxNo ?? '(not shown)'}`);
  });
});
