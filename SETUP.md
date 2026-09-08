# Fresh Mac + new project setup

One-command bootstrap for a Mac that does **not** have Node/Appium yet, plus a wizard to create or configure a project.

## Quick paths

| Situation | Command |
|-----------|---------|
| **Fresh Mac** (no Node) | `bash scripts/bootstrap.sh` |
| Node already installed | `npm run setup` |
| Configure VetPal only | `npm run setup -- --project vetpal` |
| Create a **new** app project | `npm run new-project` |

### Fresh Mac (recommended for PM / new laptop)

```bash
cd /path/to/automation_for_mobile_2026
bash scripts/bootstrap.sh
```

What it does:

1. Installs **Homebrew** if missing  
2. Installs **Node.js ≥ 18** if missing  
3. Installs **Appium** + **XCUITest** + **UiAutomator2**  
4. Asks a few questions (project, platform, device, Team ID, credentials)  
5. Writes **this Mac’s** `.env` (never reuses another person’s UDID/Team ID)  
6. Runs `npm install` in the project  

### New app automation

```bash
cd /path/to/automation_for_mobile_2026
npm run new-project
# follow prompts: id, display name, bundle id
npm run setup -- --project <id>
```

Or create + configure in one flow:

```bash
bash scripts/bootstrap.sh
# choose “Create a new project from template…”
```

---

## Questions the wizard asks

1. Install/verify Appium drivers?  
2. Configure existing project **or** create new  
3. Platform: iOS / Android / Both  
4. Device (auto-listed) + **Apple Team ID** (iOS real device)  
5. Bundle / package (defaults from `project.config.js`)  
6. Test credentials (optional)  

Everything else is filled automatically (`ie.vetpal`, Appium host/port, signing identity, etc.).

---

## Why “bundle ID” / “membership” failed before

| Symptom | Cause | Fix |
|---------|--------|-----|
| Bundle ID errors | Wrong/missing `IOS_BUNDLE_ID` or app not installed | Wizard sets ID; install app on device |
| Face / membership / WDA signing | Wrong `IOS_TEAM_ID` for **this** Apple account | Enter **this Mac’s** Team ID from Xcode → Accounts |
| Device not found | Copied another Mac’s `IOS_DEVICE_UDID` | Pick device from the wizard list |

`.env.example` files no longer ship real UDIDs or Team IDs.

---

## After setup — run tests

```bash
# Terminal 1
appium

# Terminal 2
cd projects/vetpal   # or your new project
npm run check:devices:ios
npm run test:ios:signin   # or test:ios:smoke for new projects
```

### Still required once per Mac (Apple)

- Xcode installed and signed in  
- iPhone: Trust This Computer + Developer Mode ON  
- App built/installed on the device  

---

## One-prompt for Cursor (any Mac)

After cloning the repo, paste:

> Run mobile automation setup for this Mac. Prefer `bash scripts/bootstrap.sh` if Node is missing, otherwise `npm run setup`. Install Appium + XCUITest + UiAutomator2 if needed. Detect connected devices. Ask only for platform, Apple Team ID (iOS real device), and test credentials. Keep bundle/package from `project.config.js`. Write `.env` for this machine only — do not copy UDID/Team ID from `.env.example`. Then run `check:devices` and tell me how to start Appium + the first smoke test.

---

## CLI flags

```bash
node scripts/setup-mac.js --project vetpal
node scripts/setup-mac.js --project vetpal --skip-tools
node scripts/new-project.js --id myapp --name "My App" --bundle com.example.myapp
```
