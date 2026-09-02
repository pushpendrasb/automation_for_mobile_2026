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

| Category | Default mode | Tag/ID fields | Group fields | Multiple | Required |
|----------|--------------|---------------|--------------|----------|----------|
| Horse | Tag/ID | **Name 1–4** + **Tag/ID 1–4** | GROUP NAME, NO. OF ANIMALS (min 5) | 4 slots; Group **Add More** | Name required; tag optional (no special chars) |
| Cattle | Tag/ID | Tag/ID 1–4 | GROUP NAME, NO. OF ANIMALS | 4 slots / Add More | Tag required |
| Sheep | Tag/ID | Tag/ID 1–4 | same | same | Tag required |
| Goat | Tag/ID | Tag/ID 1–4 | same | same | Tag required |
| Deer | Tag/ID | Tag/ID 1–4 | same | same | Tag required |
| Pig | **Group** | Tag/ID 1–4 if switched | GROUP NAME, NO. OF ANIMALS (min 5) | Add More | Group name + count ≥ 5 |
| Poultry | **Group** | Tag/ID + Age + Age unit | GROUP NAME, NO. OF ANIMALS, **AVERAGE AGE**, **AGE UNIT** | Add More | Group: name, count ≥ 5, age > 0, unit |

Positive data uses Tag/ID for Horse–Deer (3 entries) and Group for Pig/Poultry.

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
- Horse identification: Name 1–4 and Tag/ID 1–4 are already on step 2 (Tag/ID mode is the default). Type into those TextInput placeholders. Do not `scrollToText("Name 1")` — that placeholder is not StaticText, so swipeUp hides the cards and `isDisplayed` stays false.
- Remedy store (Vet Practice path): tap **Select Dispense Store** → type **`REMEDY_STORE_NAME`** in Search → tap card at **`REMEDY_STORE_INDEX`** (0 = first match) → **Save**. Card text is not in the iOS tree; search filters the list so index 0 is the named store.
- Branch: **one** branch auto-fills after tapping the field (no sheet). **Several** branches → field stays **Select Branch** → tap the gray row under the **Branch** title → CatPopup row at **`BRANCH_INDEX`** (default 0) → **Save**. Do not skip when the placeholder is missing from the iOS tree. Override with `--branch=1` or `BRANCH_INDEX` in `.env`.
- Vet Practice: **one** subscribed vet auto-fills the field — skip the popup. **Several** vets → field stays **Select** → tap field → `SelectVetPopup` row at **`VET_PRACTICE_INDEX`** → **Save** (same pattern as the store modal). This popup has no search box.
- Vet Practice popup: tap row at **`VET_PRACTICE_INDEX`** (0 = first) then **Save**. Skip the popup when the field is already filled (one subscribed vet).
- The store modal is an 88% bottom sheet. The top ~12% is a dismiss overlay (`remedyModalDismissArea`). Keyboard dismiss must tap the sheet header / Return key — never y≈80–90, which closes the modal.
- Nearby path uses inline pharmacy cards (`NewPrescriptionForRemedyStore.js`), not the modal.
- Exact picker strings (`Cattle - Dairy` vs other subtypes) come from the API — tests match **Horse / Cattle / Sheep / Goat / Deer / Pig / Poultry**
- Nearby Step 3 HTML fields change per species (e.g. Horse antiparasitic age groups). Filled generically; a new required widget can still fail until inspected on device
- No production app changes (no new testIDs). Dedicated IDs would help: provider cards, practice/store/branch fields, category dropdown, identification inputs, Submit

## Run commands

```bash
cd projects/vetpal
appium   # other terminal

npm run test:ios:rt:vet
npm run test:ios:rt:vet:neg
npm run test:ios:rt:nearby
npm run test:ios:rt:nearby:neg
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
# names (search) for this run:
npm run test:ios:rt:cattle -- --practice-name="Dev Test Account-U" --store-name="Southwood Pharmacy"
npm run test:android:rt:vet
npm run test:android:rt:nearby
npm run report:open
```
