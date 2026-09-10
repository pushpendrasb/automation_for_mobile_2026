# Fresh Mac + new project setup

One-command bootstrap for a Mac that does **not** have Node/Appium yet, plus a wizard to create or configure a project.

## Quick paths

| Situation | Command |
|-----------|---------|
| **Fresh Mac** (no Node) | `bash scripts/bootstrap.sh` |
| Node already installed | `npm run setup` |
| Configure VetPal only | `npm run setup -- --project vetpal` |
| Create a **new** app project | `npm run new-project` |
| New **TypeScript** project | `npm run new-project -- --language typescript` |
| New **Python** project | `npm run new-project -- --language python` |

### Fresh Mac (recommended for PM / new laptop)

```bash
cd /path/to/automation_for_mobile_2026
bash scripts/bootstrap.sh
```

What it does:

1. Installs **Homebrew** if missing  
2. Installs **Node.js ≥ 18** if missing  
3. Installs **Appium** + **XCUITest** + **UiAutomator2**  
4. Asks **script language** (JavaScript / TypeScript / Python)  
5. Creates or configures a project from the matching template  
6. Writes **this Mac’s** `.env` (never reuses another person’s UDID/Team ID)  
7. For real iPhone: **builds + installs WebDriverAgent** (so tests don’t fail with xcodebuild 65)  
8. Installs deps (`npm install` for JS/TS, or `.venv` + `pip` for Python)  

### New app automation

```bash
cd /path/to/automation_for_mobile_2026
npm run new-project
# pick language → id → display name → bundle id
npm run setup -- --project <id>
```

Or create + configure in one flow:

```bash
bash scripts/bootstrap.sh
# choose language, then “Create a new project from template…”
```

---

## Script languages

| Choice | Template | How you write tests | Install |
|--------|----------|---------------------|---------|
| **JavaScript** | `projects/_template` | WebdriverIO + Mocha (`.js`) | `npm install` |
| **TypeScript** | `projects/_template_typescript` | WebdriverIO + Mocha (`.ts`, via `tsx`) | `npm install` |
| **Python** | `projects/_template_python` | pytest + Appium-Python-Client | `.venv` + `pip install -r requirements.txt` |

Existing apps (**VetPal**, **RosKids**) stay on **JavaScript**. Language choice mainly applies when creating a **new** project.

Choice is saved as `AUTOMATION_SCRIPT_LANGUAGE` in `.env`.

Setup auto-fixes a common WebdriverIO peer conflict (`expect-webdriverio` must be **v6** with WDIO 9) before `npm install`.

---

## Questions the wizard asks

1. **Which language** — JavaScript / TypeScript / Python  
2. Install/verify Appium drivers?  
3. Configure existing project **or** create new (from the language template)  
4. **Platform first:** iOS / Android / Both  
5. **Then app ids:** iOS bundle ID and/or Android package  
6. **App source link** — local path and/or git URL of the real app (for writing scripts)  
7. Device (auto-listed) + **Apple Team ID** (iOS real device)  
8. **WebDriverAgent** — build + install on the phone  
9. Test credentials (optional)  

Everything else is filled automatically (Appium host/port, signing identity, etc.).

Setup auto-fixes a common WebdriverIO peer conflict (`expect-webdriverio` v6 with WDIO 9) before `npm install`.

If the **WebDriverAgent** step fails, fix Development signing for that Team ID and re-run setup — do not run `test:ios:smoke` until WDA succeeds.

---

## Why “bundle ID” / “membership” failed before

| Symptom | Cause | Fix |
|---------|--------|-----|
| Bundle ID errors | Wrong/missing `IOS_BUNDLE_ID` or app not installed | Wizard sets ID; install app on device |
| Face / membership / WDA signing | Wrong `IOS_TEAM_ID` or no Development cert for that team on this Mac | Use Team ID from developer.apple.com Membership; create Apple Development cert; re-run setup so it builds WDA |
| Device not found | Copied another Mac’s `IOS_DEVICE_UDID` | Pick device from the wizard list |

`.env.example` files no longer ship real UDIDs or Team IDs.

---

## After setup — run tests

### JavaScript / TypeScript

```bash
# Terminal 1
appium

# Terminal 2
cd projects/<id>
npm run check:devices:ios
npm run test:ios:smoke
# Vet Pal: npm run test:ios:signin
```

### Python

```bash
# Terminal 1
appium

# Terminal 2
cd projects/<id>
source .venv/bin/activate
python scripts/check_devices.py ios
pytest -m smoke -s --platform ios
```

### Apple Team ID (not “Membership ID” in Xcode)

Your screenshot is correct: **Xcode → Settings → Accounts → Manage** shows Role / certificates, **not** a Membership ID field.

Use:

1. https://developer.apple.com/account (same Apple ID as Xcode)  
2. **Membership details** → **Team ID** (10 characters)  
3. Put that value in `.env` as `IOS_TEAM_ID=...`

### Still required once per Mac (Apple)

- Xcode installed and signed in  
- iPhone: Trust This Computer + Developer Mode ON  
- App built/installed on the device  

---

## One-prompt for Cursor (any Mac)

After cloning the repo, paste:

> Run mobile automation setup for this Mac. Prefer `bash scripts/bootstrap.sh` if Node is missing, otherwise `npm run setup`. Ask which language (JavaScript, TypeScript, or Python) and scaffold accordingly. Install Appium + XCUITest + UiAutomator2 if needed. Detect connected devices. Ask only for platform, Apple Team ID (iOS real device), and test credentials. Write `.env` for this machine only — do not copy UDID/Team ID from `.env.example`. Then install deps and tell me how to start Appium + the first smoke test.

---

## CLI flags

```bash
node scripts/setup-mac.js --project vetpal
node scripts/setup-mac.js --project vetpal --skip-tools
node scripts/setup-mac.js --language typescript
node scripts/setup-mac.js --language python
node scripts/new-project.js --id myapp --name "My App" --bundle com.example.myapp --language typescript
node scripts/new-project.js --id myapp --language python
```
