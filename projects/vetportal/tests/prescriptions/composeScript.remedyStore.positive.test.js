/**
 * Compose New Script → Animal Remedy Store (Prescribing) — positive (VPO-CR-P01).
 * Same flow as Veterinary Practice (VPO-CS-P01); tab 2 also needs Dispenser
 * Details (dispenser + branch) and the client's mobile number.
 * Creates a real prescription on the environment the app points at.
 *
 * Inputs (dashboard or .env): COMPOSE_REMEDY_CLIENT_NAME (falls back to
 * COMPOSE_CLIENT_NAME), COMPOSE_ANIMAL, COMPOSE_DISPENSER_NAME,
 * COMPOSE_BRANCH_NAME, COMPOSE_MEDICINE_SEARCH, COMPOSE_QUANTITY, COMPOSE_ANIMAL_ID.
 */
const LoginPage = require('../../pages/LoginPage');
const ComposeScriptPage = require('../../pages/ComposeScriptPage');
const { testData, composeData } = require('../../data/testData');

describe('VetPortal Compose Script (Animal Remedy Store) — Positive', () => {
  before(async () => {
    // Reuse an existing session; sign in with .env credentials only if signed out.
    await LoginPage.ensureLoggedIn(() => ({ email: testData.email, password: testData.password }));
  });

  after(async () => {
    await ComposeScriptPage.leave().catch(() => {});
  });

  it('VPO-CR-P01: Existing client + animal + dispenser + medicine, signed and submitted, creates a prescription', async () => {
    const client = composeData.remedyClientName;
    console.log(
      `Compose (Remedy Store): client="${client}", animal="${composeData.animal}", ` +
        `dispenser="${composeData.dispenserName || '(first in list)'}", ` +
        `medicine search="${composeData.medicineSearch || '(first in list)'}"`,
    );

    await ComposeScriptPage.openFromHome({ format: 'remedyStore' });
    await ComposeScriptPage.goToClientTab();

    await ComposeScriptPage.selectClient(client);
    expect((await ComposeScriptPage.getAddress()).trim().length).toBeGreaterThan(0);
    const mobile = await ComposeScriptPage.getMobile();
    if (!mobile) {
      // Read-only for an existing client, so the app would stop at "Please enter mobile number."
      throw new Error(
        `Client "${client}" has no mobile number on file — Remedy Store needs one. ` +
          'Set COMPOSE_REMEDY_CLIENT_NAME to a client with a mobile number.',
      );
    }

    await ComposeScriptPage.selectAnimal(composeData.animal);
    expect(await ComposeScriptPage.getAnimal()).toContain(composeData.animal);

    // Step 2 difference from Veterinary Practice: Dispenser Details.
    await ComposeScriptPage.selectDispenser(composeData.dispenserName);
    const branch = await ComposeScriptPage.selectBranch(composeData.branchName);
    expect(branch.length).toBeGreaterThan(0);

    await ComposeScriptPage.tapSubmit();
    await ComposeScriptPage.waitForMedicineTab();

    await ComposeScriptPage.addMedicine({
      search: composeData.medicineSearch,
      quantity: composeData.quantity,
      animalId: composeData.animalId,
    });
    expect(await ComposeScriptPage.medicineCount()).toBe(1);

    // "Compose and Prescribe" → signature → Complete Script Now.
    await ComposeScriptPage.signAndComplete();
    const rxNo = await ComposeScriptPage.confirmSuccess(composeData.successMessage);
    console.log(`Prescription created — RX NO: ${rxNo ?? '(not shown)'}`);
  });
});
