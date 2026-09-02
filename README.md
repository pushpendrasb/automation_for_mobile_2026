# Mobile automation (shared framework + per-app projects)

Appium + WebdriverIO automation lives **outside** the React Native app repos.

```text
mobile-automation/
├── framework/              # Shared — same for every app
│   ├── config/             # iOS/Android capabilities, WDIO factory
│   ├── hooks/              # Screenshots + HTML/JSON reports
│   └── utils/              # testReport, checkDevices
└── projects/
    ├── roskids/            # RosKids pages + tests
    └── vetpal/             # Vet-Pal Animal Owner pages + tests
        ├── pages/
        ├── tests/
        ├── data/
        ├── catalog/
        ├── helpers/
        ├── .env            # credentials + device IDs (not committed)
        └── project.config.js
```

## Quick start (RosKids)

**Terminal 1 — Appium**

```bash
appium
```

**Terminal 2 — tests**

```bash
cd ~/Documents/React_Native/RosKids/mobile-automation/projects/roskids
npm install
cp .env.example .env
# Edit .env — copy from old automation/.env if you had one
npm run check:devices:ios
npm run test:ios:positive
```

## Add a new app later

1. Copy `projects/roskids/` → `projects/your-app/`
2. Update `project.config.js` (name, bundle IDs, report filename)
3. Replace `pages/`, `tests/`, `data/`, `catalog/`, `helpers/`
4. Create `.env` for that app
5. `npm install` in the new project folder

Framework code stays unchanged.

## Platform notes

| Platform | Host OS |
|----------|---------|
| Android | Linux or macOS |
| iOS | **macOS only** (Xcode + WebDriverAgent) |

## RosKids app repo

The React Native app at `RoskidsReactnativeApp/` no longer needs an `automation/` folder.
See `automation/README.md` inside the app for the redirect path.
