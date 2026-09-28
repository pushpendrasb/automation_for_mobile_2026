# Client visit brief — mobile app automation

**Who this is for:** you, the team, and ChatGPT.  
**Who the visitor is:** a **non-technical client** (business owner / product owner). They care about *does the app work for users*, *how do we know*, and *what happens when something breaks* — not code.

This file sits **outside** the app project folders (`projects/vetpal`, `projects/vetportal`, and so on). You can print it or paste it into ChatGPT without opening the technical README.

---

## Paste this into ChatGPT first

Copy everything inside the box, then paste this file (or the rest of this document) underneath.

```text
You are helping App Design prepare for a client office visit about our MOBILE APP AUTOMATION.

Rules:
- The client is NOT technical. Never use jargon (Appium, WebdriverIO, testID, XCUITest, UDID, CI, repo) unless I ask. If you must mention a tool, explain it in one everyday sentence.
- Use ONLY the facts in the brief I paste. If something is not in the brief, say “I would confirm that with the team” — do not invent numbers, dates, or coverage.
- Keep answers short (4–8 sentences) unless I ask for more.
- Be honest about limits: automation is a night watchman, not a human tester for every possible tap.

Two modes — wait for me to pick one:

MODE A — Play the client.
You are a non-technical client visiting App Design. Ask ONE realistic question at a time about the automation, the demo, cost/value, phones, reports, risk, and what we still test by hand. Sound like a business person, not a developer. After I answer, ask a follow-up or a new question. Cover the “likely client questions” list over the conversation. Do not answer your own questions.

MODE B — Help me answer.
I will paste a client question. Reply with:
1) A spoken answer I can say in the meeting (plain English).
2) One sentence of “if they push further”.
3) What not to promise.

Start by asking me: Mode A or Mode B?
```

Then paste **this whole file**.

---

## 30-second pitch (say this)

We built a **robot user** on a real phone. It opens the client’s app, signs in, walks through the same screens a person would, and writes a **pass / fail report** with screenshots.

You do not need to tap every screen yourself before a release. We press one button on our **Control Desk**, the phone does the journey, and we show the result on screen.

It runs on **iPhone and Android**. It does **happy paths** (correct login, create a request) and **wrong paths** (empty password, wrong password) so we know the app blocks mistakes.

It does **not** replace a person for brand-new ideas, one-off devices, or “does this feel nice”. It **catches repeats**: login broke, a button vanished, a form no longer submits.

---

## What the client will see in the office

1. A Mac with **Control Desk** (browser page — project cards, Run, live log, reports).
2. A **physical phone** (or simulator) with the real app installed.
3. We pick the app (for example Vet Pal), pick a suite such as **Sign in** or **Smoke**, press **Run**.
4. The phone taps itself. The log shows plain steps (Client view) or full detail (Full view).
5. At the end: **pass/fail counts**, duration, **HTML report**, screenshots if something failed.
6. Optional: **History** of recent runs, **Release Checklist** (go-live ticks, not the robot itself).

Talk about what the **phone is doing**, not what the code is doing.

---

## Apps this automation covers

| App (client-facing name) | Who uses it | What the robot currently practises |
|--------------------------|-------------|--------------------------------------|
| **Vet Pal** (animal owner) | Farmers / pet owners | Sign in with mobile + password; walk Home tiles (treatments, prescriptions, appointments, stores, practices, messages, profile); request treatment (vet practice + nearby pharmacy); does **not** tap Delete Account or similar dangerous buttons |
| **Vet Portal** (vet / practice) | Vets and vet assistants | Sign in / sign up checks; smoke launch; compose a prescription (vet practice and remedy store — good and bad data) |
| **AppraiseeIE** | Trade-in / appraisal staff | Login, pick a role, create an appraisal (including photos), open appraisal history |
| **RosKids** | Parents / carers | Sign in and **book a service** style journeys |
| **Zonk** | (newer project) | Smoke launch — still being filled out for that product |

If today’s visit is **one** product, only demo that product. Do not list every app unless they ask “do you do this for other products too?”

---

## Everyday words for how it works

| You might say | What that means |
|---------------|-----------------|
| **Robot user** | A script that taps and types like a person |
| **Test case** | One story: “valid login should reach Home” |
| **Positive test** | Doing things the *right* way |
| **Negative test** | Doing things the *wrong* way (blank field, wrong password) — we *want* the app to refuse |
| **Smoke** | A short “is the app even alive?” check |
| **Screen walk** | After login, open each main tile and come back to Home |
| **Report** | A webpage: what ran, pass/fail, time, pictures of failures |
| **Control Desk** | The office dashboard to start runs without using the terminal |
| **Device** | The phone under test (must be unlocked, app installed, test account ready) |

---

## What we always skip (say this if they worry)

On Vet Pal profile / similar screens the robot **must not**:

- Delete Account  
- Mail Us (leaves the app)  
- Clear All  
- Change password for real  
- Confirm Logout in a way that strands the demo  

We **look** for Delete Account so we know it is there. We **do not** tap it.

---

## What automation is *not*

- Not a guarantee that **every** user on **every** phone will have a perfect day  
- Not a replacement for **App Store / Play Store** review  
- Not **security penetration** testing or **load** testing (thousands of users at once)  
- Not automatic proof that **wording, colours, or “feel”** are right  
- Not magic if the **phone is locked**, **Wi‑Fi is down**, or the **test account** is wrong  
- Android and iPhone are **two separate checks** — passing iPhone does not mean Android is done (and the other way around)

---

## Likely client questions (and answers you can say)

Use these in the meeting. ChatGPT Mode A should ask from this list.

### 1. “What is this, in one sentence?”

A robot uses your real app on a real phone and tells us if the main journeys still work.

### 2. “Why should I pay for this instead of a person clicking around?”

A person is best for *new* screens and *judgement*. A robot is best for *the same checks every release*, overnight, without getting tired or skipping a step. Together they are cheaper than finding a login bug after customers already have the update.

### 3. “Will it test everything?”

No. It tests the journeys we have written: sign in, the main home areas, and the important forms we agreed. New screens need a short add-on. Rare devices and brand-new features still need a human look.

### 4. “Can I see it fail on purpose?”

Yes. We can run a **wrong password** case. The app should stay on Sign In and show a message. The report stores that message and a screenshot. That is a *good* fail for a negative test — or a *demo fail* if we pretended the goal was “reach Home”.

### 5. “Does it work on Android? We have lots of Android users.”

Yes, the same stories can run on Android. We need an Android phone (or emulator) with the app installed. iPhone and Android are run **separately**. If the visit only has an iPhone, say we will schedule Android the same way.

### 6. “What if the design changes?”

If a button moves but still says the same thing, the robot often still finds it. If you **rename** a screen or **remove** a button, we update the robot — same as you would update a training manual.

### 7. “How long does a run take?”

Sign-in only: a few minutes. A full home walk plus creating requests: **longer** (often tens of minutes) because it waits like a person and goes screen by screen. We can quote the last run time from Control Desk History in the meeting.

### 8. “What do I get after a run?”

A pass/fail summary, how long it took, a report you can open in a browser, and pictures when something failed. History keeps recent runs so we can compare “last week vs today”.

### 9. “Can this go on the App Store for me?”

No. Automation **checks the app**. **You** (or the store team) still submit to Apple and Google. Our **Release Checklist** is a go-live reminder list (build uploaded, QA ticks) — it is not the robot and not the store.

### 10. “Will it use real customers / real payments / real animals?”

No. We use a **test account** you approve. Treatment / prescription flows use agreed demo data (for example a Horse request on Vet Pal). We avoid destructive actions.

### 11. “What if it fails during the demo?”

Stay calm. Possible honest reasons: phone locked, app not the latest build, network, test user needs a one-time code, or a **real product bug** — which is the point of the visit. Show the screenshot and the step name. Offer to re-run Sign In only.

### 12. “Do I need to understand the report?”

The top is enough: green pass / red fail, counts, and the name of the story. Screenshots are for “what did the user see”. We can walk them through one fail together.

### 13. “Can my team press the button without you?”

Yes, once Control Desk is set up on a Mac: pick the project, pick the suite, Run. First-time setup (phone trust, Apple team, passwords) is done with us. After that it is a dashboard, not a programming exercise.

### 14. “How is this different from unit tests / the developers’ tests?”

Developers’ tests check **pieces of code**. This checks the **app as a user sees it** — the same taps, the same login screen. Both are useful; they catch different mistakes.

### 15. “Will it slow down my developers?”

A bit, in a good way: a broken login is found **before** customers. The automation lives in its **own** project, not inside the app source, so app developers are not blocked from shipping the UI.

### 16. “What happens overnight / every release?”

Today the office workflow is: start Control Desk, start the phone helper, run the suite. If they ask about “every night automatically”, say we **can** plug the same suites into a schedule — confirm with the team what is already on a timer vs run-on-demand.

### 17. “Can it test notifications, camera, GPS, payments?”

Only where we have written a story (for example appraisal **photos** on Appraisee). Camera, maps, Apple Pay, SMS one-time codes are **harder** and often still need a person. Do not promise them unless that app’s list above already includes them.

### 18. “Who owns the test account and the data?”

You do (or your staging environment). We store login details only on the test Mac, not in the public report. Do not read passwords out loud.

### 19. “How do I know you didn’t just click it yourself?”

The phone moves without a finger. The log timestamps every step. The report is generated by the run, not typed by hand.

### 20. “What should *we* still do ourselves?”

- Try a **new** feature once with your own eyes  
- Check how it **looks** on a small cheap Android if that is your market  
- Confirm **content** (legal text, prices)  
- Store listing screenshots and release notes  

### 21. “Cost / how many cases / SLA?”

Do **not** invent a price or a % coverage. Say: we price by **journeys we keep green**, not by lines of code. We can list the current suites for *their* app after the demo.

### 22. “If Ireland vs other countries / +353?”

Vet Pal sign-in is built around the app’s country code and a test mobile. Other markets need their own test users. Don’t promise worldwide coverage from one Irish test account.

---

## Demo script (keep it short)

1. **Show the phone idle**, app on Sign In or Home.  
2. **Show Control Desk** — “this is the remote control”.  
3. Run **Sign In** (positive): robot types, taps Sign In, Home appears.  
4. Optionally run **one negative**: empty password — toast, still on Sign In.  
5. If time: **one extra journey** they care about (book appointment, create appraisal, compose script).  
6. Open the **report**. Point at pass/fail only.  
7. Ask: “Which journey, if it broke on Friday, would hurt you most?” — that becomes the next suite.

If Vet Pal screen-walk is too long for the meeting, **do not start it**. Show Sign In + report + one screenshot from a previous full run.

---

## Facts you can stand on (do not add numbers)

- Automation is **separate** from the React Native app folders.  
- **iOS runs on a Mac.** Android can run from the same Mac with a plugged-in phone.  
- Results: HTML report, catalog of planned cases, screenshots on failure, Control Desk history.  
- Control Desk can queue several scripts if one is already running.  
- Live log has a **Client** mode (plain steps) — use that when the client is watching.

---

## After the visit

- Note which **one journey** they named as “must never break”.  
- Send the **report link or PDF** from that demo (no passwords in the email).  
- Agree iPhone vs Android follow-up if only one device was in the room.

---

## For ChatGPT Mode A — question order (suggested)

1. What is this in one sentence?  
2. Why not only human testers?  
3. Does it test everything?  
4. Android?  
5. What do I get as proof?  
6. What if the demo fails?  
7. Can my staff run it?  
8. What do we still do by hand?  
9. Payments / camera / notifications?  
10. How do we decide what to automate next?

Ask **one at a time**.
