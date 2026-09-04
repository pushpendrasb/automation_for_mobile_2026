# Vet-Pal Animal Owner — automation

Sign-In automation for **mobile number + password** login (iOS + Android).

**App source:**  
`/Users/pushpendrasb/Documents/React_Native/Vet_Pal_Animal_Owner/vetpal-animal-owner`

**Bundle ID (iOS + Android):** `ie.vetpal`

## Setup

```bash
cd ~/Documents/React_Native/RosKids/mobile-automation/projects/vetpal
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Your value |
|----------|------------|
| `VETPAL_COUNTRY_CODE` | `+353` (default in app) |
| `VETPAL_TEST_MOBILE` | `811111111` |
| `VETPAL_TEST_PASSWORD` | `H123456789` |
| `IOS_DEVICE_UDID` | `00008120-000109300A00201E` |
| `IOS_TEAM_ID` | `D6J7ZWYT6G` |
| `IOS_BUNDLE_ID` | `ie.vetpal` |
| `ANDROID_APP_PACKAGE` | `ie.vetpal` |

## Run

```bash
# Terminal 1
appium

# Terminal 2
npm run check:devices:ios
npm run test:ios:signin
npm run test:android:signin
```

## Sign-In UI (from app)

| Element | Text |
|---------|------|
| Tab | Sign In / Sign Up |
| Mobile placeholder | Mobile number |
| Password placeholder | Password |
| Button | **Sign In Now** |
| Empty mobile toast | Please enter mobile number |
| Empty password toast | Please enter password |

## Home after login

Looks for: `VETPAL`, `Request Treatment`, `My Appointments`, etc.  
Configure via `VETPAL_HOME_INDICATORS` in `.env`.

## Test cases

| ID | Case |
|----|------|
| VP-SI-P01 | Login form ready |
| VP-SI-P02 | Valid login → Home |
| VP-SI-N01–N05 | Negative Sign-In |

## Request Treatment

Data-driven **Vet Practice** and **Nearby Remedy Store** flows. Identification fields come from the app (`AnimalIdentificationExpandable.js`), not assumed Horse fields for every species.

```bash
# .env — names search/match in the popup; indexes pick which result (0 = first)
VET_PRACTICE_NAME=Dev Test Account-U
VET_PRACTICE_INDEX=0
REMEDY_STORE_NAME=Southwood Pharmacy
REMEDY_STORE_INDEX=0
BRANCH_INDEX=0
TREATMENT_REQUEST=demo treatment request

npm run test:ios:rt:cattle
# override names for this run:
npm run test:ios:rt:cattle -- --practice-name="Dev Test Account-U" --store-name="Southwood Pharmacy"
# override indexes (0 = first practice / store / branch):
npm run test:ios:rt:cattle -- --practice=0 --store=1 --branch=0
npm run test:ios:rt:cattle -- 2 1 0
# Group vs Microchip/ID (all categories):
npm run test:ios:rt:horse -- --mode=group
npm run test:ios:rt:horse -- --mode=tags
npm run test:ios:rt:cattle -- --mode=group --practice=1 --store=1 --branch=0
# all categories, same mode:
ANIMAL_ID_MODE=group npm run test:ios:rt:vet
ANIMAL_ID_MODE=tags npm run test:ios:rt:vet

npm run test:ios:rt:vet          # TC-VP-001…007
npm run test:ios:rt:vet:neg      # provider / category / treatment validation
# Nearby Remedy Store (Choose a Provider → green card → Step 3 WebView)
npm run test:ios:rt:nearby       # TC-NRS-001…007 all categories
npm run test:ios:rt:nearby:neg
npm run test:ios:rt:horse -- --nearby
npm run test:ios:rt:cattle -- --nearby --mode=tags --store=0 --branch=0
npm run test:ios:rt:horse -- --nearby --mode=group --store-name="Southwood Pharmacy"
npm run test:ios:rt:horse        # Horse Vet Practice (TC-VP-001); indexes from .env
npm run test:ios:rt:cattle       # Cattle (TC-VP-002)
npm run test:ios:rt:sheep        # Sheep (TC-VP-003)
npm run test:ios:rt:goat         # Goat (TC-VP-004)
npm run test:ios:rt:deer         # Deer (TC-VP-005)
npm run test:ios:rt:pig          # Pig (TC-VP-006)
npm run test:ios:rt:poultry      # Poultry (TC-VP-007)
npm run test:android:rt:vet
npm run test:android:rt:nearby
```

Details: `REQUEST_TREATMENT.md` (identification matrix, selectors, remaining work).

## Notes

- Login uses **mobile number**, not email (`Login.js` → `app_users/auth/login`).
- No `testID` on login fields — automation uses visible text / field order.
- If account has **OTP enabled** (`otp_status=true`), VP-SI-P02 stops at OTP screen — use a non-OTP test account or extend automation later.
- Sign-In waits for Home with one combined predicate (250ms poll), types the full value in one command, and skips terminate/relaunch when the login form is already showing. Request Treatment skips Sign In when Home is already visible.
