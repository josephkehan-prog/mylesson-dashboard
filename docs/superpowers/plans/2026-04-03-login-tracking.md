# Login Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record device/IP at every student login and display a login history table with account-sharing flags in a new teacher dashboard tab.

**Architecture:** On successful student login, `postLoginEvent()` fires a best-effort POST to the existing Google Sheets endpoint with `type:"login"` plus timestamp, IP (from api.ipify.org), and parsed device string. The teacher dashboard gains a new "🔐 Logins" tab that reads login rows from the Sheets response and flags same-student logins from different IPs within 30 minutes.

**Tech Stack:** Vanilla JS, existing `CONFIG.sheetsUrl` + `safeLS`, `api.ipify.org` (free public IP API), `navigator.userAgent` for device parsing.

---

## File Map

| File | What changes |
|------|-------------|
| `nexterra.html` — `doLogin()` (~line 2855) | Call `postLoginEvent()` after successful student auth |
| `nexterra.html` — JS functions | Add `_parseDevice(ua)`, `postLoginEvent()`, `renderLoginsTab(rows)` |
| `nexterra.html` — `refreshTeacher()` (~line 4278) | Add Logins tab button + panel to tab bar HTML |
| `nexterra.html` — `switchTeacherTab()` (~line 4324) | Handle `'logins'` case |
| `nexterra.html` — `window.*` exports (~line 5330) | Export new functions |
| **Google Apps Script** (manual step, separate from HTML) | Accept `type:"login"` POSTs, return login rows in GET |

---

## Task 1 — Apps Script Update (Manual)

This task is done by Joseph in the Google Apps Script editor — it must be completed **before** Tasks 2–4 so the client has somewhere to send/receive data.

**Files:** Google Apps Script (script.google.com — the script backing the existing Sheets URL)

- [ ] **Step 1: Open Apps Script**

Go to `script.google.com`, open the project attached to your Google Sheet, open `Code.gs`.

- [ ] **Step 2: Add Logins sheet creation helper**

Add this function anywhere in `Code.gs`:

```javascript
function _getOrCreateLoginsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Logins');
  if (!sh) {
    sh = ss.insertSheet('Logins');
    sh.appendRow(['Timestamp','Name','Class','IP','Device']);
    sh.setFrozenRows(1);
  }
  return sh;
}
```

- [ ] **Step 3: Update `doPost` to route login events**

Find your existing `doPost(e)` function. At the very top of it, after parsing the payload, add this block (before any score-writing logic):

```javascript
function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  // ── LOGIN EVENT ──
  if (data.type === 'login') {
    const sh = _getOrCreateLoginsSheet();
    sh.appendRow([
      data.timestamp,
      data.name,
      data.class,
      data.ip || '',
      data.device || ''
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ... rest of your existing doPost score-writing logic unchanged ...
}
```

- [ ] **Step 4: Update `doGet` to return login rows**

Find your existing `doGet(e)` function. It currently returns score rows. Add login rows to the response object:

```javascript
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Read existing scores sheet (your existing code here — unchanged)
  // ...existing score-reading logic...
  const rows = /* your existing rows array */;

  // ── Read login rows ──
  let loginRows = [];
  const loginSh = ss.getSheetByName('Logins');
  if (loginSh) {
    const data = loginSh.getDataRange().getValues();
    const headers = data[0]; // ['Timestamp','Name','Class','IP','Device']
    loginRows = data.slice(1).map(r => ({
      timestamp: r[0] ? new Date(r[0]).toISOString() : '',
      name:      r[1] || '',
      class:     r[2] || '',
      ip:        r[3] || '',
      device:    r[4] || ''
    }));
  }

  return ContentService.createTextOutput(
    JSON.stringify({ rows, loginRows })
  ).setMimeType(ContentService.MimeType.JSON);
}
```

**Note:** If your current `doGet` returns a plain array (not an object), you'll need to change it to return `{ rows: [...], loginRows: [...] }`. The client already handles both formats — see `refreshTeacher()` which reads `data.rows || data`.

- [ ] **Step 5: Deploy a new version**

In Apps Script: Deploy → Manage Deployments → click ⊕ New Deployment → Web App → Execute as Me → Anyone → Deploy. Copy the new `/exec` URL.

- [ ] **Step 6: Update `CONFIG.sheetsUrl` in the GitHub secret**

Go to your GitHub repo → Settings → Secrets → `SHEETS_URL` → update with the new URL. Then trigger a re-deploy (push any small change) so GitHub Actions injects the new URL.

---

## Task 2 — `_parseDevice()` and `postLoginEvent()` Functions

**Files:**
- Modify: `nexterra.html` — add two new JS functions near `postToSheets()`

- [ ] **Step 1: Add `_parseDevice()` function**

Find `async function postToSheets(score)` (~line 3909). Add this function immediately BEFORE it:

```javascript
/* ── LOGIN TRACKING ── */
function _parseDevice(ua) {
  ua = ua || '';
  let browser = 'Browser';
  if (/Edg\//.test(ua))                          browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua))                 browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua))   browser = 'Safari';

  let os = 'Device';
  if (/iPhone/.test(ua))        os = 'iPhone';
  else if (/iPad/.test(ua))     os = 'iPad';
  else if (/Android/.test(ua))  os = 'Android';
  else if (/Windows/.test(ua))  os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua))    os = 'Linux';

  return browser + ' / ' + os;
}
```

- [ ] **Step 2: Add `postLoginEvent()` function**

Add immediately after `_parseDevice()`:

```javascript
async function postLoginEvent(studentName, classCode) {
  const url = CONFIG.sheetsUrl;
  if (!url || url.includes('__SHEETS_URL__')) return; // not configured
  let ip = '';
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    ip = j.ip || '';
  } catch(e) { /* best-effort — skip if fetch fails */ }

  const payload = {
    type:      'login',
    name:      studentName,
    class:     classCode,
    timestamp: new Date().toISOString(),
    ip:        ip,
    device:    _parseDevice(navigator.userAgent)
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
  } catch(e) { /* best-effort — silent fail */ }
}
```

- [ ] **Step 3: Call `postLoginEvent()` in `doLogin()`**

Find `doLogin()` (~line 2855). Find this block near the end:

```javascript
  document.getElementById('tl-student-name').textContent = resolvedName;
  checkAndApplyReopens(() => { renderTestList(); show('sc-tests'); });
```

Add ONE line immediately before it:

```javascript
  postLoginEvent(resolvedName, code); // fire-and-forget — no await needed
  document.getElementById('tl-student-name').textContent = resolvedName;
  checkAndApplyReopens(() => { renderTestList(); show('sc-tests'); });
```

- [ ] **Step 4: Export new functions**

Find the `window.*` exports block (~line 5330). Add:

```javascript
window.postLoginEvent        = postLoginEvent;
```

- [ ] **Step 5: Verify syntax**

Run from `/sessions/trusting-wizardly-mccarthy/mylesson-dashboard/`:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('nexterra.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.indexOf('</script>', start);
try { require('vm').createScript(html.substring(start,end)); console.log('✅ OK'); }
catch(e) { console.log('❌', e.message); }
"
```
Expected: `✅ OK`

- [ ] **Step 6: Commit**

```bash
cd /sessions/trusting-wizardly-mccarthy/mylesson-dashboard
git add nexterra.html
git commit -m "feat: postLoginEvent fires on student login — sends IP, device, timestamp to Sheets"
```

---

## Task 3 — Logins Tab in Teacher Dashboard

**Files:**
- Modify: `nexterra.html` — `refreshTeacher()`, `switchTeacherTab()`, new `renderLoginsTab()` function, CSS

- [ ] **Step 1: Add CSS for the logins table**

Find `.teacher-tabs {` in the CSS (~line 605). Add these rules after the existing `.teacher-tab.tab-new.active` rule:

```css
.login-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
.login-table th { background: #00205b; color: #fff; padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 700; white-space: nowrap; }
.login-table td { padding: 8px 12px; border-bottom: 1px solid #e8ecf4; vertical-align: middle; }
.login-table tr:hover td { background: #f0f4fa; }
.login-flag { color: #c0392b; font-weight: 700; }
.login-filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.login-filter-bar select { padding: 6px 10px; border: 1px solid #cdd5e0; border-radius: 6px; font-size: 13px; }
```

- [ ] **Step 2: Add `renderLoginsTab()` function**

Find `function renderLoginsTab` doesn't exist yet — add it just before `function switchTeacherTab`. Add:

```javascript
function renderLoginsTab(loginRows) {
  const panel = document.getElementById('teacher-panel-logins');
  if (!panel) return;
  if (!loginRows || loginRows.length === 0) {
    panel.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">No login data yet. Students must complete at least one login after the Apps Script is updated.</div>';
    return;
  }

  // Sort newest first
  const sorted = loginRows.slice().sort((a,b) =>
    new Date(b.timestamp||0) - new Date(a.timestamp||0));

  // Detect account-sharing: same name, different IP, within 30 minutes
  const flagged = new Set();
  const byName = {};
  sorted.forEach((r,i) => {
    const key = (r.name||'').toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push({ idx: i, ip: r.ip, ts: new Date(r.timestamp||0).getTime() });
  });
  Object.values(byName).forEach(entries => {
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i-1], curr = entries[i];
      const diffMin = Math.abs(prev.ts - curr.ts) / 60000;
      if (diffMin <= 30 && prev.ip && curr.ip && prev.ip !== curr.ip) {
        flagged.add(prev.idx);
        flagged.add(curr.idx);
      }
    }
  });

  // Class filter dropdown options
  const classes = ['All Classes', ...new Set(sorted.map(r => r.class).filter(Boolean))];
  const filterBar = `<div class="login-filter-bar">
    <select id="login-filter-class" onchange="renderLoginsTab(window._currentLoginRows)">
      ${classes.map(c => `<option>${c}</option>`).join('')}
    </select>
    <span style="font-size:12px;color:#888;">${sorted.length} login${sorted.length!==1?'s':''} total</span>
  </div>`;

  const selClass = document.getElementById('login-filter-class')?.value || 'All Classes';
  const display = selClass === 'All Classes' ? sorted : sorted.filter(r => r.class === selClass);

  const rows = display.map((r, i) => {
    const flag = flagged.has(i) ? '<span class="login-flag" title="Same student logged in from a different IP within 30 minutes">⚠️</span>' : '';
    const ts = r.timestamp ? new Date(r.timestamp).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '—';
    return `<tr>
      <td>${r.name || '—'}</td>
      <td>${r.class || '—'}</td>
      <td>${ts}</td>
      <td style="font-family:monospace;font-size:12px;">${r.ip || '—'}</td>
      <td>${r.device || '—'}</td>
      <td>${flag}</td>
    </tr>`;
  }).join('');

  panel.innerHTML = filterBar + `
    <table class="login-table">
      <thead><tr>
        <th>Student</th><th>Class</th><th>Date &amp; Time</th>
        <th>IP Address</th><th>Device</th><th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
```

- [ ] **Step 3: Add the Logins tab button to `refreshTeacher()`**

Find this exact block in `refreshTeacher()` (~line 4278):

```javascript
  const tabs = `<div class="teacher-tabs">
    <button class="teacher-tab active" id="tab-btn-table" onclick="switchTeacherTab('table')">📊 Submissions</button>
    <button class="teacher-tab" id="tab-btn-grid" onclick="switchTeacherTab('grid')">📋 Class Grid</button>
    <button class="teacher-tab" id="tab-btn-roster" onclick="switchTeacherTab('roster')">👥 Student Roster</button>
    <button class="teacher-tab" id="tab-btn-analytics" onclick="switchTeacherTab('analytics')">📈 Analytics</button>
    <button class="teacher-tab" id="tab-btn-assign" onclick="switchTeacherTab('assign')">🗂 Assign Lessons</button>
    <button class="teacher-tab tab-new" id="tab-btn-new" onclick="switchTeacherTab('new')">➕ New Assignment</button>
  </div>`;
```

Replace with:

```javascript
  const tabs = `<div class="teacher-tabs">
    <button class="teacher-tab active" id="tab-btn-table" onclick="switchTeacherTab('table')">📊 Submissions</button>
    <button class="teacher-tab" id="tab-btn-grid" onclick="switchTeacherTab('grid')">📋 Class Grid</button>
    <button class="teacher-tab" id="tab-btn-roster" onclick="switchTeacherTab('roster')">👥 Student Roster</button>
    <button class="teacher-tab" id="tab-btn-analytics" onclick="switchTeacherTab('analytics')">📈 Analytics</button>
    <button class="teacher-tab" id="tab-btn-assign" onclick="switchTeacherTab('assign')">🗂 Assign Lessons</button>
    <button class="teacher-tab tab-new" id="tab-btn-new" onclick="switchTeacherTab('new')">➕ New Assignment</button>
    <button class="teacher-tab" id="tab-btn-logins" onclick="switchTeacherTab('logins')">🔐 Logins</button>
  </div>`;
```

- [ ] **Step 4: Add the Logins panel to `refreshTeacher()`**

Find this block just after the tabs string (line ~4287):

```javascript
  el.innerHTML = tabs +
    `<div id="teacher-panel-table">${tableHTML + sheetsNote}</div>` +
    `<div id="teacher-panel-grid" style="display:none;"></div>` +
    `<div id="teacher-panel-roster" style="display:none;"></div>` +
    `<div id="teacher-panel-analytics" style="display:none;"></div>` +
    `<div id="teacher-panel-assign" style="display:none;"></div>` +
    `<div id="teacher-panel-new" style="display:none;"></div>`;
```

Replace with:

```javascript
  el.innerHTML = tabs +
    `<div id="teacher-panel-table">${tableHTML + sheetsNote}</div>` +
    `<div id="teacher-panel-grid" style="display:none;"></div>` +
    `<div id="teacher-panel-roster" style="display:none;"></div>` +
    `<div id="teacher-panel-analytics" style="display:none;"></div>` +
    `<div id="teacher-panel-assign" style="display:none;"></div>` +
    `<div id="teacher-panel-new" style="display:none;"></div>` +
    `<div id="teacher-panel-logins" style="display:none;padding:16px;"></div>`;
```

- [ ] **Step 5: Update `switchTeacherTab()` to include `logins`**

Find `function switchTeacherTab(tab)` (~line 4324). Find this line:

```javascript
  ['table','grid','roster','analytics','assign','new'].forEach(t => {
```

Replace with:

```javascript
  ['table','grid','roster','analytics','assign','new','logins'].forEach(t => {
```

Then find the block of `if (tab === ...)` calls at the bottom of the function:

```javascript
  if (tab === 'grid')      renderClassGrid(window._currentTeacherRows);
  if (tab === 'roster')    renderDatamateView(window._currentTeacherRows, window._currentTeacherSource);
  if (tab === 'analytics') _ensureD3ThenRender(window._currentTeacherRows);
  if (tab === 'assign')    renderAssignLessons();
  if (tab === 'new')       renderNewAssignmentTab();
```

Add ONE line at the end:

```javascript
  if (tab === 'logins')    renderLoginsTab(window._currentLoginRows || []);
```

- [ ] **Step 6: Store login rows when Sheets data arrives**

Find `refreshTeacher()` and the part where it fetches from Sheets and processes the response. Look for where `window._currentTeacherRows` is set (the score rows). The response shape is now `{ rows, loginRows }`. Find the fetch `.then(data => ...)` block and add this line wherever `window._currentTeacherRows` is set:

```javascript
window._currentLoginRows = data.loginRows || [];
```

- [ ] **Step 7: Export new function**

Add to the `window.*` exports block:

```javascript
window.renderLoginsTab       = renderLoginsTab;
```

- [ ] **Step 8: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('nexterra.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.indexOf('</script>', start);
try { require('vm').createScript(html.substring(start,end)); console.log('✅ OK'); }
catch(e) { console.log('❌', e.message); }
"
```
Expected: `✅ OK`

- [ ] **Step 9: Commit**

```bash
git add nexterra.html
git commit -m "feat: Logins tab in teacher dashboard — login history table with account-sharing flags"
```

---

## Task 4 — Push to GitHub Pages

- [ ] **Step 1: Final syntax check**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('nexterra.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.indexOf('</script>', start);
try { require('vm').createScript(html.substring(start,end)); console.log('✅ All JS parses OK'); }
catch(e) { console.log('❌ SYNTAX ERROR:', e.message); }
"
```
Expected: `✅ All JS parses OK`

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verify**

Open `https://josephkehan-prog.github.io/mylesson-dashboard/nexterra.html`. Log in as a student, complete a lesson. Then log in as teacher, check the 🔐 Logins tab — the student's login entry should appear (requires Apps Script update from Task 1 to be complete first).

---

## Self-Review

**Spec coverage:**
- ✅ `postLoginEvent()` fires at login with name, class, IP, device, timestamp
- ✅ `_parseDevice()` parses user-agent into readable string
- ✅ Best-effort only — silent fail if IP fetch or POST fails
- ✅ `type:"login"` field routes separately in Apps Script
- ✅ Teacher dashboard Logins tab with class filter
- ✅ ⚠️ flag for same student, different IP, within 30 minutes
- ✅ Apps Script instructions (Task 1) fully written out — no "update your script" vagueness
- ✅ `window._currentLoginRows` storage so tab can render on demand

**No placeholders:** All steps include exact code.

**Type consistency:** `loginRows` array of `{timestamp, name, class, ip, device}` objects used consistently in Task 1 (Apps Script), Task 2 (`postLoginEvent` payload), and Task 3 (`renderLoginsTab`).

**One dependency to flag:** Task 3 Step 6 says "find where `window._currentTeacherRows` is set" — the implementer must locate this in `refreshTeacher()`. The exact line number may shift. They should search for `window._currentTeacherRows =` in the file and add `window._currentLoginRows = data.loginRows || [];` on the next line.
