# Mobile Automation — Full Handoff Guide

Use this document when moving the automation workspace to another folder or machine.
**Open this folder in Cursor/IDE — not inside a React Native app repo.**

---

## 1. Main folder location (move this entire directory)

```text
/Users/pushpendrasb/Documents/React_Native/RosKids/mobile-automation/
```

**To relocate:** copy or move the whole `mobile-automation` folder anywhere, e.g.:

```text
~/Documents/mobile-automation/
~/Automation/mobile-appium/
```

After moving, run `npm install` inside each project:

```bash
cd /path/to/mobile-automation/projects/roskids && npm install
cd /path/to/mobile-automation/projects/vetpal && npm install
```

Framework is linked via `"@mobile-automation/appium-core": "file:../../framework"` — keep `framework/` and `projects/` as siblings.

---

## 2. Folder structure

```text
mobile-automation/
├── HANDOFF.md                 ← this file
├── README.md
├── .gitignore
│
├── framework/                 # SHARED — do not put app-specific pages here
│   ├── package.json           # @mobile-automation/appium-core
│   ├── index.js
│   ├── config/
│   │   ├── ios.config.js      # XCUITest capabilities
│   │   ├── android.config.js  # UiAutomator2 capabilities
│   │   └── createWdioConfig.js
│   ├── hooks/
│   │   └── reporterHooks.js   # Screenshots + HTML/JSON reports
│   └── utils/
│       ├── testReport.js      # Report builder (catalog-aware)
│       └── checkDevices.js    # iOS UDID / Android adb check
│
└── projects/
    ├── roskids/               # RosKids app automation
    │   ├── project.config.js
    │   ├── wdio.ios.conf.js
    │   ├── wdio.android.conf.js
    │   ├── package.json
    │   ├── .env.example       # Copy to .env (never commit .env)
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   └── BookServicePage.js
    │   ├── tests/
    │   │   ├── auth/signIn.positive.test.js
    │   │   ├── auth/signIn.negative.test.js
    │   │   └── booking/bookService.test.js
    │   ├── data/testData.js
    │   ├── catalog/testCasesCatalog.js
    │   ├── helpers/slotSelection.js
    │   ├── reports/
    │   └── screenshots/
    │
    └── vetpal/                # Vet-Pal Animal Owner automation
        ├── project.config.js
        ├── wdio.ios.conf.js
        ├── wdio.android.conf.js
        ├── package.json
        ├── .env.example
        ├── pages/LoginPage.js
        ├── tests/auth/signIn.positive.test.js
        ├── tests/auth/signIn.negative.test.js
        ├── data/testData.js
        ├── catalog/testCasesCatalog.js
        ├── reports/
        └── screenshots/
```

---

## 3. Related app repos (separate from automation)

| App | Source code path | Bundle / package ID |
|-----|------------------|---------------------|
| **RosKids** | `/Users/pushpendrasb/Documents/React_Native/RosKids/RoskidsReactnativeApp` | `ie.myroskids` |
| **Vet-Pal Owner** | `/Users/pushpendrasb/Documents/React_Native/Vet_Pal_Animal_Owner/vetpal-animal-owner` | `ie.vetpal` |

Automation does **not** live inside app repos. Old RosKids in-app folder `RoskidsReactnativeApp/automation/` is deprecated (README redirect only).

---

## 4. Prerequisites (install once per machine)

```bash
node -v          # >= 18
npm -v
appium -v        # Appium 2.x global

npm install -g appium
appium driver install xcuitest
appium driver install uiautomator2
```

| Platform | Host OS |
|----------|---------|
| **iOS** tests | **macOS only** (Xcode + WebDriverAgent signing) |
| **Android** tests | macOS or Linux |
| **TestFlight iOS** | Still needs Mac for Appium/WDA |

---

## 5. How to run (any project)

**Terminal 1 — Appium server**

```bash
appium
```

**Terminal 2 — pick a project**

```bash
cd /path/to/mobile-automation/projects/roskids   # or vetpal
cp .env.example .env    # first time only — fill credentials
npm install             # first time only
npm run check:devices:ios
npm run test:ios:signin
```

---

## 6. RosKids project

### Path

```text
mobile-automation/projects/roskids/
```

### npm scripts

| Command | What it runs |
|---------|----------------|
| `npm run test:ios` | All specs iOS |
| `npm run test:android` | All specs Android |
| `npm run test:ios:positive` | SI-P01, SI-P02 |
| `npm run test:ios:negative` | SI-N01 … SI-N05 |
| `npm run test:ios:signin` | All Sign-In iOS |
| `npm run test:ios:bookservice` | Book Service E2E (keeps session: `APPIUM_NO_RESET=true`) |
| `npm run check:devices:ios` | Validate UDID |
| `npm run report:open` | Open HTML report |

### .env keys (RosKids)

| Variable | Purpose |
|----------|---------|
| `ROS_KIDS_TEST_EMAIL` | Valid login email |
| `ROS_KIDS_TEST_PASSWORD` | Valid login password |
| `ROS_KIDS_INVALID_EMAIL` / `ROS_KIDS_WRONG_PASSWORD` | Negative tests |
| `IOS_DEVICE_UDID` | iPhone UDID |
| `IOS_TEAM_ID` | Apple Team ID for WDA |
| `IOS_BUNDLE_ID` | `ie.myroskids` |
| `ANDROID_APP_PACKAGE` | `ie.myroskids` |
| `ANDROID_DEVICE_ID` | adb serial |
| `BOOK_SERVICE_SLOT_MINUTES` | Default `120` (2h slots) |
| `APPIUM_NO_RESET` | `true` for Book Service (stay logged in) |

### Test cases

**Sign In**

| ID | Type | Description |
|----|------|-------------|
| SI-P01 | Positive | Login form visible |
| SI-P02 | Positive | Valid credentials → Home |
| SI-N01 | Negative | Empty fields → email toast |
| SI-N02 | Negative | Email only → password toast |
| SI-N03 | Negative | Invalid email + password |
| SI-N04 | Negative | Valid email + wrong password |
| SI-N05 | Negative | Unknown email |

**Book Service**

| ID | Type | Description |
|----|------|-------------|
| BS-E2E-01 | E2E | Full flow to payment gateway |

### Reports

- `projects/roskids/reports/roskids-report.html`
- `projects/roskids/reports/test-catalog.html`
- `projects/roskids/reports/roskids-report.json`
- Failure screenshots: `projects/roskids/screenshots/`

### Design notes

- No React Native app source changes required (visible text / accessibility only).
- Login uses email + password; home checks `My Children` / `Book A Service`.
- Book Service uses `helpers/slotSelection.js` for 2-hour slot selection.

---

## 7. Vet-Pal Animal Owner project

### Path

```text
mobile-automation/projects/vetpal/
```

### npm scripts

| Command | What it runs |
|---------|----------------|
| `npm run test:ios:signin` | All Sign-In iOS |
| `npm run test:ios:positive` | VP-SI-P01, VP-SI-P02 |
| `npm run test:ios:negative` | VP-SI-N01 … VP-SI-N05 |
| `npm run test:android:signin` | All Sign-In Android |
| `npm run check:devices:ios` | Validate UDID |
| `npm run report:open` | Open HTML report |

### .env keys (Vet-Pal)

| Variable | Example / notes |
|----------|-----------------|
| `VETPAL_COUNTRY_CODE` | `+353` (default in app) |
| `VETPAL_TEST_MOBILE` | `811111111` (9 digits, starts with 8 for IE) |
| `VETPAL_TEST_PASSWORD` | Your test password |
| `VETPAL_HOME_INDICATORS` | `VETPAL,Request Treatment,My Appointments,...` |
| `VETPAL_SIGN_IN_BUTTON` | `Sign In Now` |
| `VETPAL_MOBILE_BLANK_TOAST` | `Please enter mobile number` |
| `VETPAL_PASSWORD_BLANK_TOAST` | `Please enter password` |
| `IOS_BUNDLE_ID` | `ie.vetpal` |
| `ANDROID_APP_PACKAGE` | `ie.vetpal` |
| `IOS_DEVICE_UDID` | Your iPhone UDID |
| `IOS_TEAM_ID` | Your Apple Team ID |

### Test cases

| ID | Type | Description |
|----|------|-------------|
| VP-SI-P01 | Positive | Mobile + Password + Sign In Now visible |
| VP-SI-P02 | Positive | Valid mobile login → Home |
| VP-SI-N01 | Negative | Empty mobile toast |
| VP-SI-N02 | Negative | Password blank toast |
| VP-SI-N03 | Negative | Invalid mobile + password |
| VP-SI-N04 | Negative | Valid mobile + wrong password |
| VP-SI-N05 | Negative | Unknown mobile |

### Login differences from RosKids

- Uses **mobile number**, not email.
- Button text: **Sign In Now** (not "Sign In").
- API: `app_users/auth/login` with `phone_number` + `country_code`.
- Toasts: message text only (no "Error" title).
- App source: `vetpal-animal-owner/src/Screens/Login.js`
- **OTP:** if test account has `otp_status=true`, P02 stops at OTP screen.

### Reports

- `projects/vetpal/reports/vetpal-report.html`
- `projects/vetpal/reports/test-catalog.html`

---

## 8. Adding a third app later

1. Copy `projects/roskids/` → `projects/new-app/`
2. Edit `project.config.js` (`displayName`, `reportBaseName`, bundle defaults)
3. Replace `pages/`, `tests/`, `data/`, `catalog/`
4. Copy `.env.example` → `.env`
5. `npm install` in new project folder

Framework stays unchanged.

---

## 9. WebDriverAgent (iOS real device) troubleshooting

If session fails with `xcodebuild code 70`:

1. Set in project `.env`: `IOS_TEAM_ID`, `IOS_DEVICE_UDID`
2. Set `APPIUM_SHOW_XCODE_LOG=true`
3. Xcode → Settings → Accounts → download profiles
4. iPhone: Trust Mac, Developer Mode ON
5. Optional: `IOS_USE_PREBUILT_WDA=true` + `IOS_WDA_DERIVED_DATA_PATH` after first successful WDA build

Check device:

```bash
xcrun xctrace list devices
adb devices
```

---

## 10. What was built in this automation thread (history)

1. **RosKids Sign-In** — positive + negative cases, fast keyboard dismiss, API error detection.
2. **RosKids Book Service E2E** — week → child → steps → 2h slots → payment gateway.
3. **Custom reports** — HTML/JSON with QA "understanding", pass/fail criteria, test catalog.
4. **Moved automation outside app** — shared `framework/` + per-app `projects/`.
5. **Vet-Pal Owner Sign-In** — mobile +353 login, Home tile checks, both iOS/Android configs.

---

## 11. Quick copy checklist when moving folder

- [ ] Copy entire `mobile-automation/` directory
- [ ] Copy `.env` files separately (not in git) OR recreate from `.env.example`
- [ ] Run `npm install` in `projects/roskids` and `projects/vetpal`
- [ ] Install Appium + drivers on new machine if needed
- [ ] Update `IOS_DEVICE_UDID` if using a different iPhone
- [ ] Open `mobile-automation/` as workspace root in IDE (not RosKids app repo)

---

## 12. Contact / paths summary

| Item | Path |
|------|------|
| Automation root | `~/Documents/React_Native/RosKids/mobile-automation/` |
| RosKids tests | `.../mobile-automation/projects/roskids/` |
| Vet-Pal tests | `.../mobile-automation/projects/vetpal/` |
| Shared framework | `.../mobile-automation/framework/` |
| RosKids app | `~/Documents/React_Native/RosKids/RoskidsReactnativeApp` |
| Vet-Pal app | `~/Documents/React_Native/Vet_Pal_Animal_Owner/vetpal-animal-owner` |

---

*Last updated: automation handoff for RosKids + Vet-Pal Appium/WebdriverIO setup.*
