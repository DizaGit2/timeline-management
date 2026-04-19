# Mobile Stability Test Suite — Manual Test Procedures

**Related task:** TIM-192 — Create mobile stability test suite covering top 5 critical user paths  
**PRD:** prd-mobile-reliability.md  
**Last updated:** 2026-04-05

---

## Overview

These manual test procedures cover scenarios that cannot be fully automated in CI because they require true device-level network manipulation, service worker behavior, or multi-device coordination. They complement the automated Playwright E2E tests in `e2e/`.

**Prerequisites:**
- Access to a physical iOS device (Safari) and an Android device (Chrome)
- App deployed to a staging environment reachable over the device's network
- Tester account credentials for both employee and manager roles
- A way to toggle device airplane mode or disable Wi-Fi/cellular

---

## Path 1 — Clock-In / Clock-Out (Offline Resilience)

> **Status:** Activate these tests once TIM-191 (frontend) and TIM-190 (backend) are merged to main.

### MT-CLK-01: True offline clock-in queues and auto-syncs

**Device:** Physical phone (Android Chrome or iOS Safari)  
**Severity:** Critical

**Steps:**
1. Log in as an hourly employee on the mobile browser.
2. Navigate to the home/dashboard screen where the Clock In button appears.
3. Confirm you can see your current shift context.
4. Put the device into **airplane mode** (or disable both Wi-Fi and cellular).
5. Tap **Clock In**.

**Expected:**
- App does not hang or show a generic network error.
- A clear offline/queued indicator appears (e.g., "You're offline — clock-in saved, will sync automatically").
- The button becomes disabled or shows a loading/queued state to prevent duplicate taps.
- No data is lost.

6. Wait 10–15 seconds to confirm no retry flood or repeated error messages.
7. Disable airplane mode (restore connectivity).
8. Within 30 seconds, the app should automatically sync the queued clock-in.

**Expected after reconnect:**
- The offline indicator clears.
- A "Synced" or "Clock-in recorded" confirmation appears without user action.
- The manager dashboard reflects the employee as clocked in within 60 seconds (PRD sync lag target).

**Pass / Fail:** ___________  
**Notes:** ___________

---

### MT-CLK-02: App closed while offline — queue survives

**Device:** Physical phone  
**Severity:** Critical

**Steps:**
1. Log in as employee. Put device into airplane mode.
2. Tap Clock In — confirm queued indicator appears.
3. **Close the browser tab or force-quit the app.**
4. Reopen the browser and navigate back to the app.
5. Restore connectivity (disable airplane mode).

**Expected:**
- Queued clock-in entry survived app close/reopen (stored in IndexedDB or service worker).
- On reconnect, the queued entry auto-syncs.
- Employee is shown as clocked in in the manager view.

**Pass / Fail:** ___________  
**Notes:** ___________

---

### MT-CLK-03: Multiple queued clock events — correct order preserved

**Device:** Physical phone  
**Severity:** High

**Steps:**
1. Log in as employee. Confirm clocked-out state.
2. Put device into airplane mode.
3. Tap **Clock In** — confirm queued.
4. Wait 5 minutes (or use system clock to simulate time passing).
5. Tap **Clock Out** — confirm queued as second event.
6. Restore connectivity.

**Expected:**
- Both events sync in correct chronological order (in → out, not reversed).
- Server records reflect accurate in/out timestamps matching when the taps occurred.
- No duplicate entries.

**Pass / Fail:** ___________  
**Notes:** ___________

---

### MT-CLK-04: Service worker handles offline on page reload

**Device:** Physical phone  
**Severity:** High

**Steps:**
1. Log in as employee with connectivity active.
2. Put device into airplane mode.
3. **Reload the page** (pull to refresh or tap reload).

**Expected:**
- App loads from service worker cache (not a browser offline error page).
- Clock-in button is accessible even on the reloaded offline page.
- No "No internet connection" browser default error screen.

**Pass / Fail:** ___________  
**Notes:** ___________

---

## Path 2 — View My Upcoming Schedule (Mobile Chrome + Safari)

### MT-SCH-01: Cross-browser schedule rendering

**Devices:** iPhone (Safari) and Android (Chrome)  
**Severity:** High

**Steps:**
1. Log in as employee on **iOS Safari**.
2. Navigate to My Schedule.
3. Verify the weekly calendar grid renders correctly (no layout overflow, no hidden columns).
4. Tap the next-week navigation arrow.
5. Verify dates update correctly.
6. Repeat all steps on **Android Chrome**.

**Expected:**
- Calendar is fully readable on both devices without horizontal overflow.
- Tap targets for navigation arrows are at least 44×44px.
- Week transitions are smooth, no blank flash.

**Pass / Fail (iOS Safari):** ___________  
**Pass / Fail (Android Chrome):** ___________  
**Notes:** ___________

---

### MT-SCH-02: Stale data after schedule change

**Devices:** Physical phone + separate manager browser session  
**Severity:** High

**Steps:**
1. Employee logs in and loads My Schedule on mobile — note the displayed shifts.
2. Manager (separate session) edits a shift time for the current week.
3. On the employee's mobile browser, **without refreshing**, wait up to 60 seconds.

**Expected:**
- Within 60 seconds, the schedule reflects the manager's change (auto-refresh or polling).
- If manual refresh is required, a "data may be stale" indicator should appear.

**Pass / Fail:** ___________  
**Notes:** ___________

---

## Path 3 — Manager Live Shift Status Monitoring

### MT-MGR-01: Real-time no-show detection within 60s

**Devices:** Physical phone (manager) + employee device  
**Severity:** High

**Steps:**
1. Manager logs in on mobile and opens the Dashboard.
2. Confirm an employee is scheduled for a shift starting within the next 5 minutes.
3. Ensure the employee does NOT clock in (simulate no-show).
4. After the shift start time passes, wait up to 60 seconds.

**Expected:**
- Dashboard shows the employee as not-clocked-in within 60 seconds of shift start.
- An unfilled-shift alert or indicator is visible without a manual refresh.

**Pass / Fail:** ___________  
**Notes:** ___________

---

### MT-MGR-02: Dashboard survives background/foreground cycle

**Device:** Physical phone (manager, iOS Safari)  
**Severity:** Medium

**Steps:**
1. Manager opens Dashboard on iOS Safari.
2. Press home button (background the app).
3. Wait 5 minutes.
4. Reopen Safari and return to the Dashboard tab.

**Expected:**
- Page reloads or rehydrates data on foreground.
- No blank screen or stale "last opened" timestamp shown as current.
- Stats reload within 3 seconds of tab coming to foreground.

**Pass / Fail:** ___________  
**Notes:** ___________

---

## Path 4 — Shift Swap / Cover Request

> **Status:** Activate once the shift-swap request UI is built. See skipped tests in `e2e/mobile-shift-swap.spec.ts`.

### MT-SWP-01: Multi-party swap notification latency

**Devices:** Two physical phones (employee A and manager)  
**Severity:** High

**Steps:**
1. Employee A submits a shift swap request from their mobile.
2. Start a timer.
3. Manager checks their mobile — wait for a notification or dashboard update.

**Expected:**
- Manager sees the pending swap request within 60 seconds (in-app notification or dashboard badge).

**Pass / Fail:** ___________  
**Notes:** ___________

---

## Path 5 — Availability Submission / Update

### MT-AVL-01: Availability saves correctly on iOS Safari

**Device:** iPhone (iOS Safari)  
**Severity:** Medium

**Steps:**
1. Log in as employee on iOS Safari.
2. Navigate to Availability (via profile or direct URL).
3. Verify existing windows are pre-filled (not blank).
4. Add a new availability window for a day not currently set.
5. Fill in start/end time using the mobile time picker.
6. Tap Save.

**Expected:**
- Time picker is usable on iOS Safari (native time input works correctly).
- Existing windows load before form is interactive (blank form not shown).
- Save succeeds and new window appears in the list.
- Page shows a confirmation (not silent).

**Pass / Fail:** ___________  
**Notes:** ___________

---

### MT-AVL-02: Offline availability — graceful degradation

**Device:** Physical phone  
**Severity:** Medium

**Steps:**
1. Log in as employee. Navigate to Availability.
2. Verify existing windows are loaded.
3. Put device into airplane mode.
4. Attempt to save a change.

**Expected:**
- Clear error message explaining the save failed due to no connectivity.
- Previously loaded availability data remains visible (no blank screen).
- Form data (user's input) is preserved so they can retry when online.

**Pass / Fail:** ___________  
**Notes:** ___________

---

## Test Execution Log

| Test ID | Date | Tester | Device / Browser | Result | Bugs Filed |
|---------|------|--------|-----------------|--------|-----------|
| MT-CLK-01 | | | | | |
| MT-CLK-02 | | | | | |
| MT-CLK-03 | | | | | |
| MT-CLK-04 | | | | | |
| MT-SCH-01 | | | | | |
| MT-SCH-02 | | | | | |
| MT-MGR-01 | | | | | |
| MT-MGR-02 | | | | | |
| MT-SWP-01 | | | | | |
| MT-AVL-01 | | | | | |
| MT-AVL-02 | | | | | |

---

## Defect Filing Template

When a manual test fails, file a bug issue with the following structure:

```
Summary: [one-line description]

Steps to Reproduce:
1. ...
2. ...

Expected Behavior: ...
Actual Behavior: ...

Environment:
- Device: [e.g., iPhone 14, iOS 17.2, Safari 17]
- Network: [e.g., airplane mode, 4G, Wi-Fi]
- App version / branch: [e.g., main@abc1234]

Severity: Critical / High / Medium / Low
```
