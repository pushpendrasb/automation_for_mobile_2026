# AppraiseeIE automation (TypeScript)

## Screens

| Screen | App class | Automation |
|--------|-----------|------------|
| **Login** (email + password) | `ViewController.h` / `ViewController.m` | `LoginPage.ts` |
| **Role picker** (after login) | `LoginUserRoleVC` | `UserRolePage.ts` |
| **Create Appraisal** (4 steps) | `TradeIn.mm` | `CreateAppraisalPage.ts` |

Login accessibility ids live on **ViewController.m** (`login_email`, …).  
Create Appraisal ids live on **TradeIn.mm** (`tradein_customer_name`, `tradein_req_next`, `tradein_photos_save`, …).

**Rebuild/install** the iOS app after identifier changes before running tests.

## Run

```bash
# Terminal 1
appium

# Terminal 2
cd projects/appraiseeie
npm run check:devices:ios
npm run test:ios:smoke
npm run test:ios:signin
npm run test:ios:appraisal
```

Credentials: `TEST_USER` / `TEST_PASSWORD` in `.env`  
Optional: `APPRAISEE_ROLE_INDEX` (default `0`) for which role row to tap.

### Create Appraisal

- Data: Name **Paul**, email **sami@appdesign.ie**, plate **141D6333**, random mobile
- `APPRAISEE_TYRE_DAMAGE=true|false` (default true) · `APPRAISEE_ALLOY_DAMAGE` (default false)
- Photos: needs at least one image in the Photos library (Simulator gets `fixtures/appraisal-sample.png` via simctl). Set `APPRAISEE_SKIP_PHOTOS=true` to skip gallery picks while debugging other steps.
