# Mobile automation (shared framework + per-app projects)

Appium + WebdriverIO automation lives **outside** the React Native app repos.

```text
automation_for_mobile_2026/
├── SETUP.md                # Fresh Mac + new project (start here)
├── scripts/
│   ├── bootstrap.sh        # No Node yet? Run this
│   ├── setup-mac.js        # Appium + .env wizard
│   └── new-project.js      # Scaffold projects/<id>
├── framework/              # Shared — same for every app
└── projects/
    ├── _template/          # Used by npm run new-project
    ├── roskids/
    └── vetpal/
```

## Fresh Mac (no Node / Appium)

```bash
cd /path/to/automation_for_mobile_2026
bash scripts/bootstrap.sh
```

See **[SETUP.md](./SETUP.md)** for the full wizard flow, Cursor one-prompt, and troubleshooting.

## Already have Node

```bash
npm run setup                          # pick project interactively
npm run setup -- --project vetpal      # VetPal on this Mac
npm run new-project                    # scaffold a new app
```

## Run tests (after setup)

**Terminal 1 — Appium**

```bash
appium
```

**Terminal 2**

```bash
cd projects/vetpal   # or roskids / your new project
npm run check:devices:ios
npm run test:ios:signin
```

## Add a new app

```bash
npm run new-project
# then replace pages/, tests/, data/ for that app
```

Or use the wizard option **Create a new project from template**.

Framework code stays unchanged.

## Platform notes

| Platform | Host OS |
|----------|---------|
| Android | Linux or macOS |
| iOS | **macOS only** (Xcode + WebDriverAgent) |
