# Request Treatment — Automation Implementation Report

Inspected `vetpal-animal-owner` first. No `testID`s on this flow (only SideMenu / BannerView). Selectors use visible text and placeholders.

## Confirmed (from source + screenshots)

| Question | Answer |
|----------|--------|
| Request Treatment entry | `Home.js` tile → `MyPrescriptions` (`isFromRequestPendingTreatment: true`) |
| CTA | **Request Vet Advice/Treatment** (`MyPrescriptions.js`) |
| Provider popup | `ChooseProviderPopup.js` — **Vet Practice** / **Nearby Remedy Store** |
| Vet Practice form | `NewPrescription.js` — Step 1 practice + **Remedy Store to Dispense** + **Branch**, Step 2 animal + treatment, **Submit Request** |
| Nearby form | `NewPrescriptionForRemedyStore.js` — Step 3 is `react-native-webview` (`assessment-dev.vetpal.ie/form/…`) |
| Branch 1 vs many | `branchList.length === 1` auto-fills; `> 1` opens `CatPopup` title **Branch** |
| Animal category | `CatPopup` title **Animal Category/ Type**; labels from API (`Horses - Horses`, `Cattle - Dairy`, …) |
| Identification UI | `AnimalIdentificationExpandable.js` + `animalIdentificationUtils.js` |
| Treatment field | Placeholder *Please enter the treatment or the product you are requesting…* |
| Summary | `PrescriptionSummary.js` — **Submit Request Now** |
| Success | Nearby: WebView `postMessage` `formSubmittedSuccess` / success URL; Vet Practice: create-prescription API then back to list |
| Toasts | `Please select a vet practice`, `Please select Remedy Store`, `Please select a Remedy Store`, `Please select Branch`, `Please select animal category / type`, `Please complete animal identification before submitting your request`, `Please enter history or symptoms of animal` |

## Animal Identification Matrix

From `resolveCategory`, `defaultsToGroupIdentification`, `TAG_SLOT_COUNT = 4`, `MIN_GROUP_ANIMAL_COUNT = 5`.

Horse, Pig, and Poultry open in **Group**. Cattle / Sheep / Goat / Deer open in **Microchip/ID**.

| Category | Default mode | Microchip/ID fields | Group fields | Multiple | Required |
|----------|--------------|---------------------|--------------|----------|----------|
| Horse | **Group** | Name 1–4 + Microchip/ID 1–4 if switched | GROUP NAME, NO. OF ANIMALS (min 5) | Group **Add More**; 4 tag slots | Group name + count ≥ 5 |
| Cattle | Microchip/ID | Microchip/ID 1–4 | GROUP NAME, NO. OF ANIMALS | 4 slots / Add More | Tag required |
| Sheep | Microchip/ID | Microchip/ID 1–4 | same | same | Tag required |
| Goat | Microchip/ID | Microchip/ID 1–4 | same | same | Tag required |
| Deer | Microchip/ID | Microchip/ID 1–4 | same | same | Tag required |
| Pig | **Group** | Microchip/ID 1–4 if switched | GROUP NAME, NO. OF ANIMALS (min 5) | Add More | Group name + count ≥ 5 |
| Poultry | **Group** | Microchip/ID + Age + Age unit | GROUP NAME, NO. OF ANIMALS, **AVERAGE AGE**, **AGE UNIT** | Add More | Group: name, count ≥ 5, age > 0, unit |

Positive data uses Group for Horse / Pig / Poultry and Microchip/ID (tags) for Cattle–Deer (3 entries).

## Implemented

Kept the existing project (`projects/vetpal/`), not a new `automation/` tree.

- `data/animalCategories.js`, `data/providerData.js` (`VET_PRACTICE_NAME`, `VET_PRACTICE_INDEX`, `REMEDY_STORE_NAME`, `REMEDY_STORE_INDEX`, `BRANCH_INDEX`, `TREATMENT_REQUEST`)
- Pages: `HomePage`, `ProviderSelectionPage`, `VetPracticeFormPage`, `NearbyRemedyStorePage`, `AnimalIdentificationPage`, `WebTreatmentFormPage`, `RequestSummaryPage`, `RequestTreatmentFlow`, `ui.js`
- Tests: `tests/requestTreatment/*.test.js`
- Catalog merged into HTML report modules
- WebView: `getContexts()`, switch to first `WEBVIEW*`, fill empty controls dynamically

## Remaining (device / API)

- Subscribed **Dev Test Account-U** / **Dev Test Account - U** and **Southwood Pharmacy** must exist on the test account
- Vet Practice: `NewPrescription.js` auto-fills when there is one subscribed vet. If the field is not exact **Select**, the script skips `SelectVetPopup`.
- **Next / Submit Request** are a fixed footer (`footerWrap` absolute). Do not swipe the ScrollView looking for them — tap the footer.
- Horse identification: **Group** is the default. Fill `animalId.group.groupName.0` and `animalId.group.number.0` (min 5). After NO. OF ANIMALS, dismiss the number pad: KeyboardToolbar **Done** is not in the XCUITest tree, so the script taps the accessory bar of `XCUIElementTypeKeyboard` and the **New Request** header (`rt.header`). Rebuild the app to also get `animalId.dismissKeyboard` on the GROUP NAME label (`Keyboard.dismiss()`, same pattern as login).
- Remedy store (Vet Practice path): tap **Select Dispense Store** → type **`REMEDY_STORE_NAME`** in Search → tap card at **`REMEDY_STORE_INDEX`** (0 = first match) → **Save**. Card text is not in the iOS tree; search filters the list so index 0 is the named store.
- Branch: **one** branch auto-fills after tapping the field (no sheet). **Several** branches → field stays **Select Branch** → tap the gray row under the **Branch** title → CatPopup row at **`BRANCH_INDEX`** (default 0) → **Save**. Do not skip when the placeholder is missing from the iOS tree. Override with `--branch=1` or `BRANCH_INDEX` in `.env`.
- Vet Practice: **one** subscribed vet auto-fills the field — skip the popup. **Several** vets → field stays **Select** → tap field → `SelectVetPopup` row at **`VET_PRACTICE_INDEX`** → **Save** (same pattern as the store modal). This popup has no search box.
- Vet Practice popup: tap row at **`VET_PRACTICE_INDEX`** (0 = first) then **Save**. Skip the popup when the field is already filled (one subscribed vet).
- The store modal is an 88% bottom sheet. The top ~12% is a dismiss overlay (`remedyModalDismissArea`). Keyboard dismiss must tap the sheet header / Return key — never y≈80–90, which closes the modal.
- Nearby path uses inline pharmacy cards (`NewPrescriptionForRemedyStore.js`), not the Remedy Store modal. After a card tap, one branch auto-fills; two or more opens CatPopup by itself. There is **no** `rt.branch.field` on Nearby (that ID is Vet Practice only). Rebuild for `rt.nearby.branch` on the Branch line (re-open the sheet).
- Nearby `callGetPharmaList` is **subscribed pharmacies**, not the Vet Practice dispense-store modal. `REMEDY_STORE_NAME` (e.g. Southwood Pharmacy) may match nothing — the script clears search and taps `rt.nearby.store.0` (or `--store=N`).
- Exact picker strings (`Cattle - Dairy` vs other subtypes) come from the API — tests match **Horse / Cattle / Sheep / Goat / Deer / Pig / Poultry**
- Nearby Step 3 HTML fields change per species (e.g. Horse antiparasitic age groups). Filled generically; a new required widget can still fail until inspected on device
- No production app changes (no new testIDs). Dedicated IDs would help: provider cards, practice/store/branch fields, category dropdown, identification inputs, Submit

## Run commands

```bash
cd projects/vetpal
appium   # other terminal

npm run test:ios:rt:vet
npm run test:ios:rt:vet:neg
# Nearby Remedy Store (Choose a Provider → Nearby Remedy Store):
npm run test:ios:rt:nearby
npm run test:ios:rt:nearby:neg
npm run test:ios:rt:horse -- --nearby
npm run test:ios:rt:cattle -- --nearby --store=0 --branch=0
npm run test:ios:rt:horse
npm run test:ios:rt:cattle
npm run test:ios:rt:sheep
npm run test:ios:rt:goat
npm run test:ios:rt:deer
npm run test:ios:rt:pig
npm run test:ios:rt:poultry
# both indexes in one command (0 = first row/card):
npm run test:ios:rt:cattle -- 2 1
# practice, store, branch (0 = first branch):
npm run test:ios:rt:cattle -- --practice=0 --store=1 --branch=0
npm run test:ios:rt:cattle -- 2 1 0
# identification mode (group | tags) for any category:
npm run test:ios:rt:horse -- --mode=tags
npm run test:ios:rt:cattle -- --mode=group --practice=1 --store=1 --branch=0
ANIMAL_ID_MODE=group npm run test:ios:rt:vet
# names (search) for this run:
npm run test:ios:rt:cattle -- --practice-name="Dev Test Account-U" --store-name="Southwood Pharmacy"
npm run test:android:rt:vet
npm run test:android:rt:nearby
npm run report:open
```
