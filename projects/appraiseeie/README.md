# AppraiseeIE automation (TypeScript)

## Screens

| Screen | App class | Automation |
|--------|-----------|------------|
| **Login** (email + password) | `ViewController.h` / `ViewController.m` | `LoginPage.ts` |
| **Role picker** (after login) | `LoginUserRoleVC` | `UserRolePage.ts` |

Login accessibility ids live on **ViewController.m** (`login_email`, `login_password`, `login_submit_button`, …).  
`LoginUserRoleVC` is only the dealer/role list after a successful login.

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
```

Credentials: `TEST_USER` / `TEST_PASSWORD` in `.env`  
Optional: `APPRAISEE_ROLE_INDEX` (default `0`) for which role row to tap.
