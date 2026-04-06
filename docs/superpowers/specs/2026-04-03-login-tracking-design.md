# Login Tracking Design Spec

**Goal:** Record device/IP information at each student login and display a login history log in the teacher dashboard to help identify account sharing and track time-of-use.

**Architecture:** At login success, fire a best-effort POST to the existing Google Sheets endpoint with event type `"login"`. Add a new "🔐 Logins" tab to the teacher dashboard that reads login rows from the Sheets response and displays them in a table with account-sharing flags.

**Tech Stack:** Vanilla JS, existing `CONFIG.sheetsUrl` + `postToSheets` pattern, `api.ipify.org` for IP lookup, `navigator.userAgent` for device info.

---

## Data Captured at Login

Every successful student login fires `postLoginEvent()` which sends:

| Field | Value |
|-------|-------|
| `type` | `"login"` |
| `name` | Student's resolved name (e.g. `"Sarjo Touray"`) |
| `class` | Class code (e.g. `"HAMILTON"`) |
| `timestamp` | ISO string: `new Date().toISOString()` |
| `ip` | External IP from `https://api.ipify.org?format=json` |
| `device` | Simplified user-agent string (e.g. `"Chrome / iPhone"`) |

**Timing:** Called inside `doLogin()` immediately after `ST.student` and `ST.classCode` are set, before `show('sc-tests')`.

**Failure handling:** Best-effort only — if the IP fetch or POST fails for any reason, silently skip. No retry, no offline queue, no error shown to student.

---

## Device String Parsing

Parse `navigator.userAgent` into a human-readable label using this logic:

```
Browser: Chrome / Firefox / Safari / Edge / other
OS/Device: iPhone / iPad / Android / Windows / Mac / Linux / other
Result: "Chrome / iPhone", "Safari / iPad", "Chrome / Windows", etc.
```

This is done client-side with simple regex — no library needed.

---

## Teacher Dashboard: Logins Tab

A new tab added to the teacher dashboard tab bar:

```
📊 Submissions | 📋 Class Grid | 👥 Student Roster | 📈 Analytics | 🗂 Assign Lessons | ➕ New Assignment | 🔐 Logins
```

The Logins tab renders a table populated from the Sheets response. The Apps Script must return login rows alongside score rows (filtered by `type === "login"`).

### Table columns

| Student | Class | Date & Time | IP Address | Device | Flag |
|---------|-------|-------------|------------|--------|------|
| Sarjo Touray | HAMILTON | Apr 3 · 9:14 AM | 76.14.x.x | Chrome / Android | — |
| Sarjo Touray | HAMILTON | Apr 3 · 9:44 AM | 203.0.x.x | Safari / iPhone | ⚠️ |

- **Sorted:** Newest first
- **Filter:** Dropdown to filter by class code (ALL / HAMILTON / HOLYCROSS / etc.)
- **⚠️ flag:** Shown when the same student name appears with two different IP addresses within 30 minutes of each other

### Flag logic (client-side)

After fetching login rows, sort by student name + timestamp. For each student, walk their login history: if two consecutive logins are within 30 minutes AND have different IPs → mark the second row with ⚠️.

---

## Apps Script Changes Required (out of scope for this plan)

The Google Apps Script that receives POSTs must be updated to:
1. Accept rows with `type: "login"` and write them to a "Logins" sheet tab
2. Return login rows in the GET response alongside score data

**This spec covers only the client-side (nexterra.html) changes.** The Apps Script update is a separate manual step Joseph does in Google Apps Script editor.

---

## What This Does NOT Do

- No data stored in localStorage
- No alert or warning shown to students at login
- No blocking of logins if IP fetch fails
- No server-side session management
- Does not track teacher logins

---

## Scope

Single file: `nexterra.html`

**New function:** `postLoginEvent()` — called in `doLogin()` after successful auth
**New function:** `_parseDevice(ua)` — returns simplified device string from userAgent
**New function:** `renderLoginsTab()` — renders the Logins tab HTML
**Modified:** `switchTeacherTab()` — handle `'logins'` case
**Modified:** teacher tab bar HTML in `refreshTeacher()` — add Logins tab button
**Modified:** `refreshTeacher()` — pass login rows to tab renderer
