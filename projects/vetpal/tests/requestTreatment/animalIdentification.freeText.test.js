/**
 * TC-AID-CHAR-01/02 — Free Text Animal Identification character limits.
 *
 * Only meaningful when SHOW_CURRENT_ANIMAL_IDENTIFICATION === false (new UI).
 * We don't read the flag or flip it from automation (see prompt §27) — each
 * test detects which UI is live and skips with a clear log line, rather than
 * failing, when the old Tags/Group UI is showing instead.
 *
 * Horse: field caps at 128 chars. Every other category, including Poultry:
 * 256 chars (screenshots "0/128" vs "0/256").
 */
const HomePage = require('../../pages/HomePage');
const RequestTreatmentFlow = require('../../pages/RequestTreatmentFlow');
const AnimalIdentificationPage = require('../../pages/AnimalIdentificationPage');
const FreeTextAnimalIdentificationPage = require('../../pages/FreeTextAnimalIdentificationPage');
const { ui } = require('../../pages/ui');

async function runCharLimitCase(categoryKey) {
  await RequestTreatmentFlow.reachAnimalIdentificationForVetPractice(categoryKey);
  const mode = await AnimalIdentificationPage.detectIdentificationUiMode();

  if (mode !== 'freeText') {
    ui.log(
      'Animal Identification (Free Text)',
      `Skipping char-limit check for ${categoryKey} — detected "${mode}" UI (SHOW_CURRENT_ANIMAL_IDENTIFICATION is likely true)`,
    );
    return;
  }

  await FreeTextAnimalIdentificationPage.assertCharacterLimitEnforced(categoryKey);
}

describe('Request Treatment — Animal Identification — Free Text character limits', () => {
  beforeEach(async () => {
    await HomePage.goHomeFresh();
  });

  it('TC-AID-CHAR-01: Horse Free Text field does not accept more than 128 characters', async () => {
    await runCharLimitCase('Horse');
  });

  it('TC-AID-CHAR-02: Cattle Free Text field does not accept more than 256 characters', async () => {
    await runCharLimitCase('Cattle');
  });

  it('TC-AID-CHAR-03: Poultry Free Text field does not accept more than 256 characters', async () => {
    await runCharLimitCase('Poultry');
  });
});
