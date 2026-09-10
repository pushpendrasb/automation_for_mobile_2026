# Mobile automation (shared framework + per-app projects)

Appium + WebdriverIO automation lives **outside** the React Native app repos.

```text
automation_for_mobile_2026/
├── SETUP.md                # Fresh Mac + new project (start here)
├── scripts/
│   ├── bootstrap.sh        # No Node yet? Run this
│   ├── setup-mac.js        # Appium + .env wizard
│   └── new-project.js      # Scaffold projects/<id>
├── framework/              # Shared — same for every JS/TS app
└── projects/
    ├── _template/              # JavaScript (WebdriverIO)
    ├── _template_typescript/   # TypeScript (WebdriverIO + tsx)
    ├── _template_python/       # Python (pytest + Appium)
    ├── roskids/
    └── vetpal/
```

## Fresh Mac (no Node / Appium)

```bash
cd /path/to/automation_for_mobile_2026
bash scripts/bootstrap.sh
# pick JavaScript, TypeScript, or Python when asked
```

See **[SETUP.md](./SETUP.md)** for the full wizard flow, Cursor one-prompt, and troubleshooting.

## Already have Node

```bash
npm run setup                          # pick language + project
npm run setup -- --project vetpal      # VetPal on this Mac
npm run new-project -- --language typescript
npm run new-project -- --language python
```

## Run tests (after setup)

**Terminal 1 — Appium**

```bash
appium
```

**Terminal 2 — JavaScript / TypeScript**

```bash
cd projects/vetpal   # or your new project
npm run check:devices:ios
npm run test:ios:signin     # Vet Pal / RosKids
# npm run test:ios:smoke    # new JS/TS projects
```

**Terminal 2 — Python**

```bash
cd projects/<id>
source .venv/bin/activate
python scripts/check_devices.py ios
pytest -m smoke -s --platform ios
```

**Apple Team ID:** use the 10-character Team ID from [developer.apple.com/account](https://developer.apple.com/account) → Membership details. Xcode → Accounts → Manage does not show “Membership ID”.

## Add a new app

```bash
npm run new-project
# choose JavaScript / TypeScript / Python, then replace pages/tests for that app
```

Or use the wizard option **Create a new project from template**.

Shared WebdriverIO framework code is used by JS/TS projects. Python projects use their own pytest stack (Appium server is still shared).

## Platform notes

| Platform | Host OS |
|----------|---------|
| Android | Linux or macOS |
| iOS | **macOS only** (Xcode + WebDriverAgent) |
