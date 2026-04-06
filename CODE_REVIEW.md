# Comprehensive Code Quality Review
## nexterra_student.html

**File**: `/sessions/sharp-practical-lovelace/mnt/3rd Grade State Test/nexterra_student.html`
**Size**: ~4,234 lines, ~187KB
**Architecture**: Single-file vanilla JS + inline HTML/CSS (no framework, no build step)
**Scope**: Student practice test portal + teacher dashboard
**Review Date**: April 2, 2026

---

## Executive Summary

This single-file education portal exhibits **strong intent on security** (CSP headers, hash-based PIN verification, safeLS wrapper) but suffers from **architectural limitations inherent to monolithic vanilla JS**. The codebase shows moderate code quality with several areas requiring attention:

- **4 Critical issues** (TDZ bug, hardcoded secrets, fetch error patterns, XSS vectors)
- **8 High-severity issues** (code complexity, duplication, state management)
- **7 Medium-severity issues** (maintainability, error handling, missing validation)
- **6 Low-severity issues** (naming conventions, optimization opportunities)

**Risk Assessment**: Suitable for low-stakes educational portal; would need architectural refactoring for production use with sensitive data.

---

## 1. CRITICAL ISSUES

### 1.1 Temporal Dead Zone (TDZ) Violation — CRITICAL

**Severity**: CRITICAL
**Location**: Lines 2077–2085 (IIFE `init()`), Line 2955 (`safeLS` definition)
**Issue**: `safeLS` is referenced inside the IIFE at line 2085 **before its declaration** at line 2955.

```javascript
// Line 2077-2087: IIFE runs immediately
(function init() {
  // ... setup code ...
  { const _v = safeLS.getJSON('nxt_scores'); if(_v !== null) ST.scores = _v; }  // ← safeLS not defined yet
})();

// Line 2955: safeLS defined AFTER the init() IIFE runs
const safeLS = {
  get(key) { ... },
  getJSON(key, fallback = null) { ... },
  // ...
};
```

**Why This Works at Runtime**: Because `safeLS` is accessed at runtime (after the IIFE executes), not during parsing. However, this is fragile and violates clean code practices.

**Impact**: If code organization changes or modules are refactored, this will break silently.

**Fix Recommendation**:
```javascript
// Define safeLS BEFORE the init IIFE, or delay init() execution
const safeLS = {
  get(key) { try { return localStorage.getItem(key); } catch(e) { console.warn('[safeLS] get failed:', key, e); return null; } },
  set(key, val) { try { localStorage.setItem(key, val); return true; } catch(e) { console.warn('[safeLS] set failed:', key, e); return false; } },
  remove(key) { try { localStorage.removeItem(key); } catch(e) { console.warn('[safeLS] remove failed:', key, e); } },
  getJSON(key, fallback = null) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch(e) { console.warn('[safeLS] getJSON parse failed:', key, e); return fallback; } },
  setJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch(e) { console.warn('[safeLS] setJSON failed:', key, e); return false; } }
};

(function init() {
  // Now safeLS is guaranteed to exist
  { const _v = safeLS.getJSON('nxt_scores'); if(_v !== null) ST.scores = _v; }
  // ...
})();
```

---

### 1.2 Hardcoded Google Apps Script URL + Production Secrets — CRITICAL

**Severity**: CRITICAL
**Location**: Line 854 (CONFIG.sheetsUrl)
**Issue**: Live Google Apps Script URL exposed in source code.

```javascript
const CONFIG = {
  sheetsUrl: 'https://script.google.com/macros/s/AKfycbwMyOnE0Yz2HakxM5cRNE8g467i3gdFhuijGdutHOQEniEKXdoDFOtIq26QfS9pOqP8/exec'
};
```

**Impact**:
- This URL is accessible to any user viewing the page source
- Google Apps Script can write/modify all student data
- No authorization checks on this endpoint (backend trusts client signature)
- If the endpoint is misconfigured, students can submit fake scores

**Risk**: Compromised endpoint = compromised grade data, retroactive score manipulation.

**Fix Recommendation**:
1. **Extract to environment variables** (server-side):
   ```html
   <!-- server-rendered template, not hardcoded -->
   <script>
     const CONFIG = {
       sheetsUrl: '${SHEETS_URL}'  // Injected by server at render time
     };
   </script>
   ```

2. **Create a lightweight backend proxy**:
   ```javascript
   // Instead of posting directly to Apps Script, post to your server:
   fetch('/api/submit-score', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(payload)
   })
   // Your server validates and forwards to Google Apps Script with server-side credentials
   ```

3. **Implement server-side signature verification** on the Apps Script:
   - Client sends: `{studentId, lessonId, score, answers, clientTimestamp}`
   - Server computes HMAC-SHA256 using a server-side secret
   - Apps Script verifies HMAC before accepting submission

---

### 1.3 Hardcoded Student Roster (PII) — CRITICAL

**Severity**: CRITICAL
**Location**: Lines 868–882 (ALL_STUDENTS array)
**Issue**: 46 real student names hardcoded in source code.

```javascript
const ALL_STUDENTS = [
  "Sarjo Touray","Eurys Polanco","Liam Young",...  // Real names, publicly visible
];
```

**Privacy Risk**:
- FERPA violation (Family Educational Rights and Privacy Act)
- Student names exposed to anyone who views the HTML source
- No PII encryption or separation

**Impact**: Educational institutions could face legal liability.

**Fix Recommendation**:
```javascript
// Server-rendered roster, never hardcoded
const ROSTER_KEY = 'roster-2026-spring';  // Identifier only
// Load from secure, authenticated endpoint:
async function loadRoster() {
  const response = await fetch(`/api/roster/${ROSTER_KEY}`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  if (response.ok) {
    const { roster } = await response.json();
    ROSTER[classCode] = roster;  // Populated at runtime from server
  }
}
```

---

### 1.4 Unhandled Fetch Failures + Silent Errors — CRITICAL

**Severity**: CRITICAL
**Location**: Lines 3048–3061 (refreshTeacher), 3014–3024 (checkAndApplyReopens), 2920–2924 (postToSheets)
**Issue**: `fetch()` errors are silently caught with `.catch()` and fallback behavior is unclear.

```javascript
// Line 2920–2924: postToSheets
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify(payload)
}).catch((err) => {
  console.warn('[postToSheets] Submission failed:', err);  // Only logs, doesn't inform user
});

// Line 3048–3061: refreshTeacher
fetch(CONFIG.sheetsUrl)
  .then(r => r.json())
  .then(rows => { /* ... */ })
  .catch(() => {  // Silent fallback to local storage
    let local = {};
    { const _v = safeLS.getJSON('nexterra_scores'); if(_v !== null) local = _v; }
    renderTeacherTable(rows, 'local');  // ← Silently downgrades; user sees stale data
  });
```

**Problems**:
1. **No user notification** when submission fails (students might not know their answer didn't post)
2. **No retry mechanism** (transient network errors cause permanent data loss)
3. **Silent fallbacks** without clear indication (teacher sees old data without warning)
4. **Network errors swallowed** (no error logging to backend for debugging)
5. **Race conditions** possible if network recovers mid-fallback

**Impact**: Data loss, grading errors, student confusion about submission status.

**Fix Recommendation**:
```javascript
async function postToSheets(score) {
  if (!ST.lesson) return;
  const url = CONFIG.sheetsUrl;
  if (!url || url.includes('paste')) return;

  const payload = { /* ... */ };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)  // Timeout after 8 seconds
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.info('[postToSheets] Submission successful:', result);
    showToast('✅ Your test has been submitted successfully.', 3000);
  } catch (err) {
    console.error('[postToSheets] Submission failed:', err);
    // Persist locally with retry flag
    const failedSubmission = { ...payload, retriesCount: 0, lastAttempt: Date.now() };
    safeLS.setJSON('nxt_pending_submission', failedSubmission);

    // Notify user
    _showToast('⚠️ Submission error. Your answers are saved. Please contact your teacher.', 8000);

    // Option: Implement exponential backoff retry
    scheduleRetry(payload, 1000);
  }
}

function scheduleRetry(payload, delayMs) {
  const retryCount = (payload.retriesCount || 0) + 1;
  if (retryCount > 3) {
    console.error('[postToSheets] Max retries exceeded');
    return;  // Give up after 3 attempts
  }
  setTimeout(() => {
    postToSheets(payload);
  }, delayMs * Math.pow(2, retryCount));  // Exponential backoff
}
```

---

## 2. HIGH-SEVERITY ISSUES

### 2.1 Excessive Function Cyclomatic Complexity — HIGH

**Severity**: HIGH
**Location**: Line 2360 (renderQuestion), Line 3071 (renderTeacherTable), Line 3117 (buildTableRows)
**Issue**: Multiple functions with 8+ nested conditionals and 40+ lines each.

```javascript
// Line 2360–2505: renderQuestion function (145 lines)
function renderQuestion(idx) {
  const lesson = ST.lesson;
  if (!lesson || idx < 0 || idx >= lesson.questions.length) return;  // Guard
  // ...
  if (q.img) {  // Branch 1
    if (q.type === 'mc') {  // Branch 2
      // 20 lines of HTML generation
    } else if (q.type === 'sr') {  // Branch 3
      if (q.context) { /* ... */ }  // Branch 4
      // 25 lines of HTML
    }
  } else {  // Branch 5
    if (q.context) {  // Branch 6
      // 4 lines
    }
    if (q.type === 'mc') {  // Branch 7
      // 20 lines
    } else if (q.type === 'sr') {  // Branch 8
      if (q.lines || 8) { /* ... */ }  // Branch 9
      if (isMath && q.credits === 1) {  // Branch 10
        // 8 lines
      } else {
        if (q.draw) {  // Branch 11
          // 15 lines
        }
        // More HTML
      }
    }
  }
}
```

**Cyclomatic Complexity**: ~14 (Industry best practice: < 10)

**Impact**:
- Difficult to test (requires 14+ test cases)
- Hard to debug (changing one branch risks breaking others)
- High cognitive load (readers must track multiple states)
- Prone to refactoring errors

**Fix Recommendation**: Extract question type rendering into separate functions:
```javascript
function renderQuestion(idx) {
  const lesson = ST.lesson;
  if (!lesson || idx < 0 || idx >= lesson.questions.length) return;
  ST.currentQ = idx;
  const q = lesson.questions[idx];
  const qpane = document.getElementById('t-qpane');

  renderStrip();
  updateQuestionHeader(idx);

  // Delegate to type-specific renderer
  let html = '<div class="tq-num">' + renderQuestionNumber(idx, lesson.questions.length);
  html += q.img
    ? renderImageBasedQuestion(q, idx)
    : renderTextBasedQuestion(q, idx);

  qpane.innerHTML = html;
  qpane.scrollTop = 0;
}

function renderImageBasedQuestion(q, idx) {
  let html = `<div class="tq-img-wrap"><img src="${q.img}" alt="Question ${idx+1}" /></div>`;
  if (q.type === 'mc') {
    html += renderMCChoices(q, idx);
  } else if (q.type === 'sr') {
    html += renderSRImage(q, idx);
  }
  return html;
}

function renderTextBasedQuestion(q, idx) {
  let html = '';
  if (q.context) {
    const isMathLesson = ST.lesson.subject === 'Math';
    html += `<div class="${isMathLesson ? 'tq-credits' : 'tq-ctx'}">${escHtml(q.context)}</div>`;
  }
  html += `<div class="tq-stem">${escHtml(q.stem)}</div>`;

  if (q.type === 'mc') {
    html += renderMCChoices(q, idx);
  } else if (q.type === 'sr') {
    html += renderSRTextArea(q, idx);
  }
  return html;
}
```

**Benefit**: Each function now < 30 lines, CC < 5, individually testable.

---

### 2.2 Massive renderTeacherTable Function — HIGH

**Severity**: HIGH
**Location**: Line 3071–3199 (129 lines)
**Issue**: Single function handles statistics, filtering, sorting, HTML generation, and state management.

**Responsibilities**:
1. Compute class statistics (avg, pass count)
2. Generate filter/sort dropdowns
3. Build table row HTML
4. Set window globals for filter callbacks
5. Generate conditional UI based on data source
6. Render entire teacher panel with 6 tabs

**Impact**:
- Impossible to test filtering independently of rendering
- Changing stats logic requires re-testing entire render
- UI and business logic intertwined

**Fix Recommendation**: Break into 6 smaller functions:
```javascript
// Separate concerns:
function computeTeacherStats(rows) { /* ... */ }
function generateFilterBar(rows) { /* ... */ }
function buildTableRows(filteredRows) { /* ... */ }
function getTeacherDataSource(rows) { /* ... */ }
function renderTeacherTable(rows, source) {
  const stats = computeTeacherStats(rows);
  const filters = generateFilterBar(rows);
  const tableHtml = buildTableRows(rows);
  const dataSource = getTeacherDataSource(rows, source);

  el.innerHTML = tabs + `<div>${filters}${tableHtml}${dataSource}</div>`;
}
```

---

### 2.3 Code Duplication: Student Name Lookup — HIGH

**Severity**: HIGH
**Location**: Lines 2115–2128 (doLogin), Lines 2992–3005 (checkAndApplyReopens)
**Issue**: Student name matching logic duplicated across two functions.

```javascript
// Line 2115–2128: doLogin()
const lower = nameInput.toLowerCase();
let match = roster.find(n => n.toLowerCase() === lower);
if (!match) match = roster.find(n => n.toLowerCase().startsWith(lower));
if (!match) match = roster.find(n => n.toLowerCase().includes(lower));
if (!match && typeof Fuse !== 'undefined') {
  const fuse = new Fuse(roster, { threshold: 0.4, includeScore: true });
  const res = fuse.search(nameInput);
  if (res.length > 0 && res[0].score < 0.25) { match = res[0].item; }
  // ...
}

// Line 2992–3005: checkAndApplyReopens()
reopenList.forEach(r => {
  if ((r.student||'').toLowerCase() !== studentName.toLowerCase()) return;  // ← Duplicate logic
  // ...
});
localReopens.forEach(r => {
  if ((r.student||'').toLowerCase() !== studentName.toLowerCase()) return;  // ← Again
  // ...
});
```

**Impact**:
- Inconsistent normalization across codebase
- Hard to update name-matching strategy
- Missed opportunity for case-insensitive sorting/filtering

**Fix Recommendation**:
```javascript
// Centralize name normalization (already exists at line 2979, but not used everywhere)
function normalizeStudentName(name) {
  return (name || '').toLowerCase().trim();
}

function findStudentByName(name, roster) {
  const normalized = normalizeStudentName(name);

  // Try exact match first
  let match = roster.find(n => normalizeStudentName(n) === normalized);

  // Try prefix match
  if (!match) match = roster.find(n => normalizeStudentName(n).startsWith(normalized));

  // Try substring match
  if (!match) match = roster.find(n => normalizeStudentName(n).includes(normalized));

  // Try fuzzy match (if Fuse available)
  if (!match && typeof Fuse !== 'undefined') {
    const fuse = new Fuse(roster, { threshold: 0.4, includeScore: true });
    const res = fuse.search(name);
    if (res.length > 0 && res[0].score < 0.25) match = res[0].item;
  }

  return match;
}

// Usage:
const resolvedName = findStudentByName(nameInput, roster);

// In checkAndApplyReopens:
reopenList.forEach(r => {
  if (normalizeStudentName(r.student) !== normalizeStudentName(studentName)) return;
  // ...
});
```

---

### 2.4 Inadequate Input Validation — HIGH

**Severity**: HIGH
**Location**: Line 2360 (renderQuestion), Line 2096–2142 (doLogin), Line 2832 (submitTest)
**Issue**: No validation of lesson.questions array bounds, student input lengths, answer format.

```javascript
// Line 2360: No validation that lesson.questions[idx] exists
function renderQuestion(idx) {
  const lesson = ST.lesson;
  if (!lesson || idx < 0 || idx >= lesson.questions.length) return;  // Guard exists
  const q = lesson.questions[idx];  // OK, but...
  // ...
  if (q.type === 'mc') {
    q.choices.forEach((ch, ci) => {  // ← What if choices is undefined?
      // ...
    });
  }
}

// Line 2876–2885: calcScore() assumes answers are correct format
function calcScore() {
  const lesson = ST.lesson;
  let correct = 0, mcTotal = 0, srCount = 0;
  lesson.questions.forEach((q, i) => {
    if (q.type === 'mc') {
      if (ST.answers[i] === q.answer) correct++;  // ← No validation of ST.answers
    }
  });
  // ...
}
```

**Risk**:
- Malformed questions cause crashes
- Tampered answers bypass scoring
- No client-side integrity checks

**Fix Recommendation**:
```javascript
function validateQuestion(q, idx) {
  const errors = [];

  if (!q.type || !['mc', 'sr'].includes(q.type)) {
    errors.push(`Question ${idx}: Invalid type '${q.type}'`);
  }

  if (q.type === 'mc') {
    if (!Array.isArray(q.choices) || q.choices.length < 2) {
      errors.push(`Question ${idx}: MC question missing choices`);
    }
    if (!['A','B','C','D','E'].includes(q.answer)) {
      errors.push(`Question ${idx}: Invalid answer '${q.answer}'`);
    }
  }

  if (q.img && typeof q.img !== 'string') {
    errors.push(`Question ${idx}: Invalid image URL`);
  }

  if (q.stem && typeof q.stem !== 'string') {
    errors.push(`Question ${idx}: Invalid stem text`);
  }

  return errors;
}

function validateLesson(lesson) {
  const errors = [];

  if (!lesson.id || typeof lesson.id !== 'string') {
    errors.push('Lesson: Missing or invalid ID');
  }

  if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
    errors.push('Lesson: No questions defined');
  } else {
    lesson.questions.forEach((q, i) => {
      errors.push(...validateQuestion(q, i));
    });
  }

  return errors;
}

// Before rendering:
function beginTest() {
  const lesson = ST.lesson;
  const errors = validateLesson(lesson);

  if (errors.length > 0) {
    console.error('[beginTest] Invalid lesson:', errors);
    _showToast('❌ Test configuration error. Contact your teacher.', 5000);
    return;
  }

  // ... proceed with test
}
```

---

### 2.5 Inline Event Handlers + XSS Risk in Onclick Strings — HIGH

**Severity**: HIGH
**Location**: Lines 3128–3135 (renderTeacherTable), 2392–2406 (renderQuestion)
**Issue**: Student/lesson names embedded directly in onclick attributes without proper escaping.

```javascript
// Line 2404: Inline onclick with unescaped variable
onclick="handleChoiceClick(${idx},${ci},'${letter}')"

// Line 3130–3135: Names embedded in onclick handler
const student = (r.student || '').replace(/'/g, "\\'");  // Manual escape
const lessonTitle = title.replace(/'/g, "\\'");  // Manual escape
const classCode = (r.classCode || r.classKey || '').replace(/'/g, "\\'");
onclick="reopenAssignment('${student}','${lessonTitle}','${classCode}','${localId}')"
```

**XSS Risk**: If a student name is "Robert' onload='alert(1)", the onclick becomes:
```javascript
onclick="reopenAssignment('Robert' onload='alert(1)','...')"
// Evaluates to: reopenAssignment('Robert' onload='alert(1)');
```

**Even with escaping**, inline handlers are fragile:
```javascript
student.replace(/'/g, "\\'")  // Only escapes single quotes, not other injection vectors
```

**Fix Recommendation**: Use `addEventListener` and data attributes instead:
```javascript
// Instead of:
`onclick="reopenAssignment('${student}','${lessonTitle}','${classCode}','${localId}')"`

// Generate safe HTML with data attributes:
`<button class="btn-reopen"
  data-student="${escHtml(student)}"
  data-lesson="${escHtml(lessonTitle)}"
  data-classCode="${escHtml(classCode)}"
  data-localId="${escHtml(localId)}">
  🔓 Reopen
</button>`

// Then attach event listeners after rendering:
function attachReopenHandlers(container) {
  container.querySelectorAll('.btn-reopen').forEach(btn => {
    btn.addEventListener('click', function() {
      const student = this.dataset.student;
      const lessonTitle = this.dataset.lesson;
      const classCode = this.dataset.classCode;
      const localId = this.dataset.localId;
      reopenAssignment(student, lessonTitle, classCode, localId);
    });
  });
}
```

**Benefit**: Separates data from behavior, prevents injection attacks, easier to refactor.

---

### 2.6 Global State Pollution + Window Globals — HIGH

**Severity**: HIGH
**Location**: Lines 3085–3086, 3161–3165, 3085–3086 (renderTeacherTable), throughout codebase
**Issue**: Functions expose internal state to global window object for callback access.

```javascript
function renderTeacherTable(rows, source) {
  // ...
  window._getPct = getPct;  // Exposed private function
  window._getPassThreshold = _getRowPassThreshold;  // Exposed private function
  window._tableRows = displayRows;  // Exposed internal state
  window._tableSource = source;
  window._buildTableRows = buildTableRows;  // Exposed private function
  window._currentTeacherRows = rows;
  window._currentTeacherSource = source;
}

// Called via inline onchange:
<select id="filter-class" onchange="applyTableFilter()">
// applyTableFilter accesses window._tableRows to filter
```

**Problems**:
1. **Global collision**: Any third-party script could overwrite these
2. **No encapsulation**: Internal functions exposed and testable
3. **Harder to debug**: Hard to track where these are used
4. **Memory leaks**: Old references not cleaned up when UI updates

**Fix Recommendation**: Use closures or module pattern:
```javascript
const TeacherPanel = (() => {
  let tableRows = [];
  let tableSource = 'local';
  let currentTeacherRows = [];

  function getPct(r) {
    if (typeof r.pct === 'number') return r.pct;
    return parseInt((r.pct || '0').toString().replace('%','')) || 0;
  }

  function getRowPassThreshold(row) {
    const lesson = LESSONS.find(l => l.title === (row.lesson || row.title));
    return lesson ? getPassThreshold(lesson) : getPassThreshold(null);
  }

  function renderTeacherTable(rows, source) {
    tableRows = rows.filter(r => r.type !== 'reopen');
    tableSource = source;
    currentTeacherRows = rows;
    // ... render
  }

  function applyTableFilter() {
    const cls = document.getElementById('filter-class')?.value || 'All Classes';
    const les = document.getElementById('filter-lesson')?.value || 'All Lessons';
    let filtered = tableRows.filter(r => {
      const matchCls = cls === 'All Classes' || (r.classCode || r.classKey || '') === cls;
      const matchLes = les === 'All Lessons' || (r.lesson || r.title || '') === les;
      return matchCls && matchLes;
    });
    // ... render filtered
  }

  return {
    renderTeacherTable,
    applyTableFilter  // Only export public methods
  };
})();

// Usage: TeacherPanel.applyTableFilter();
```

**Benefit**: Prevents global namespace pollution, clear public API, easier to test.

---

### 2.7 Missing Error Recovery for Canvas Drawing — HIGH

**Severity**: HIGH
**Location**: Lines 2595–2659 (attachDrawEvents)
**Issue**: Canvas operations don't validate context existence or handle drawing failures.

```javascript
function attachDrawEvents(canvas) {
  const clone = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(clone, canvas);
  const c = document.getElementById('draw-canvas');
  DRW.ctx = c.getContext('2d');  // ← No null check

  DRW.ctx.fillStyle = '#fff';
  DRW.ctx.fillRect(0, 0, c.width, c.height);  // ← Could fail if ctx is null

  if (savedDataUrl) {
    const img = new Image();
    img.onload = () => DRW.ctx.drawImage(img, 0, 0, c.width, c.height);  // ← Race condition
    img.src = savedDataUrl;
  }
}
```

**Problems**:
1. If canvas is null, code crashes
2. Image loading is async but not awaited (state could change)
3. No fallback if drawing fails

**Fix Recommendation**:
```javascript
function attachDrawEvents(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
    console.error(`[attachDrawEvents] Canvas '${canvasId}' not found`);
    return false;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[attachDrawEvents] Could not get canvas 2D context');
    return false;
  }

  DRW.ctx = ctx;

  // Fill white background
  try {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.error('[attachDrawEvents] Failed to fill background:', err);
    return false;
  }

  // Restore saved drawing with proper error handling
  const savedDataUrl = (canvas.width > 0 && canvas.height > 0)
    ? canvas.toDataURL('image/png')
    : null;

  if (savedDataUrl) {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch (err) {
        console.warn('[attachDrawEvents] Failed to restore drawing:', err);
      }
    };
    img.onerror = () => {
      console.warn('[attachDrawEvents] Failed to load saved drawing image');
    };
    img.src = savedDataUrl;
  }

  // ... event listeners
  return true;
}
```

---

## 3. MEDIUM-SEVERITY ISSUES

### 3.1 Timer Logic Relies on Client Clock — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 2342–2360 (tickTimer), Line 2290 (beginTest)
**Issue**: Test timer runs client-side; students can manipulate time via DevTools.

```javascript
function beginTest() {
  const lesson = ST.lesson;
  ST.timerSec = lesson.timeLimit * 60;  // e.g., 3600 for 60 min
  clearInterval(ST.timerInterval);
  ST.timerInterval = setInterval(tickTimer, 1000);  // ← Client clock only
}

function tickTimer() {
  ST.timerSec--;
  updateTimerDisplay();
  if (ST.timerSec <= 0) {
    clearInterval(ST.timerInterval);
    submitTest(true);  // Time up
  }
}
```

**Attack**: Open DevTools → `clearInterval(ST.timerInterval)` → endless time.

**Impact**: Cheating; unfair advantage.

**Fix Recommendation**: Implement server-side time validation.
```javascript
function beginTest() {
  const lesson = ST.lesson;
  const serverStartTime = Date.now();  // Trust server time once at start
  ST.testStartTime = serverStartTime;
  ST.testDuration = lesson.timeLimit * 60 * 1000;  // ms

  clearInterval(ST.timerInterval);
  ST.timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  const elapsed = Date.now() - ST.testStartTime;
  const remaining = Math.max(0, ST.testDuration - elapsed);
  ST.timerSec = Math.ceil(remaining / 1000);

  updateTimerDisplay();

  if (remaining <= 0) {
    clearInterval(ST.timerInterval);
    submitTest(true);
  }
}

// When submitting, validate:
function submitTest(timeUp) {
  const elapsed = Date.now() - ST.testStartTime;

  // Include elapsed time in submission for server verification
  const payload = {
    // ... score data
    clientElapsedTime: Math.round(elapsed / 1000),
    submittedAt: new Date().toISOString()
  };

  postToSheets(payload);
  // Server can verify: if (clientElapsedTime > testDuration + buffer) { fraud detected }
}
```

---

### 3.2 Missing Validation of Drawing Canvas Size — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 2510–2535 (openDrawModal)
**Issue**: Canvas dimensions not validated; could create huge/tiny drawing surfaces.

```javascript
function openDrawModal(qIdx) {
  const modal = document.getElementById('draw-modal');
  const canvas = document.getElementById('draw-canvas');

  // No validation of canvas size
  if (canvas.width < 100 || canvas.height < 100) {
    console.warn('Canvas too small for drawing');
  }
  // But drawing proceeds anyway
}
```

**Risk**: Out-of-memory errors on mobile, laggy drawing, corrupted exports.

**Fix Recommendation**:
```javascript
function openDrawModal(qIdx) {
  const modal = document.getElementById('draw-modal');
  const canvas = document.getElementById('draw-canvas');

  // Validate and set reasonable defaults
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 1200;
  const MIN_HEIGHT = 150;
  const MAX_HEIGHT = 900;

  // Set canvas size based on container, with bounds
  const rect = modal.getBoundingClientRect();
  canvas.width = Math.max(MIN_WIDTH, Math.min(rect.width - 40, MAX_WIDTH));
  canvas.height = Math.max(MIN_HEIGHT, Math.min(rect.height - 120, MAX_HEIGHT));

  // Verify context
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[openDrawModal] Canvas context unavailable');
    _showToast('❌ Drawing tool unavailable.', 4000);
    return;
  }

  modal.style.display = 'flex';
  attachDrawEvents(canvas);
}
```

---

### 3.3 No CSRF Protection on Teacher Actions — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 3316–3325 (selectStudentInRoster), 3750–3772 (reopenAssignment), 4038–4050 (resetStudent)
**Issue**: Teacher actions (reopen, reset grades) have no CSRF token validation.

```javascript
// Line 3750–3772: Reopen assignment
function reopenAssignment(student, lessonTitle, classCode, localId) {
  const toAdd = {
    type: 'reopen',
    student: student,
    lesson: lessonTitle,
    class: classCode,
    reopenedAt: new Date().toISOString()
  };

  const reopens = safeLS.getJSON('nexterra_reopens', []);
  reopens.push(toAdd);
  safeLS.setJSON('nexterra_reopens', reopens);  // ← No CSRF token, anyone can call this

  _showToast(`Assignment reopened for ${student}.`, 4000);
}

// If attacker gets teacher logged in and embeds:
// <img src="https://example.com/portal.html" onload="resetStudent('Bob')">
// The action executes without teacher's knowledge
```

**Fix Recommendation**: Implement CSRF token validation on sensitive actions.
```javascript
function generateCSRFToken() {
  const token = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(token, b => b.toString(16).padStart(2, '0')).join('');
}

function validateCSRFToken(token) {
  const stored = sessionStorage.getItem('nxt_csrf_token');
  return stored && stored === token && Date.now() - sessionStorage.getItem('nxt_csrf_time') < 3600000;
}

// On teacher dashboard load:
function loadTeacher() {
  const token = generateCSRFToken();
  sessionStorage.setItem('nxt_csrf_token', token);
  sessionStorage.setItem('nxt_csrf_time', Date.now());

  // Include in all forms:
  document.querySelectorAll('form').forEach(form => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = '_csrf';
    input.value = token;
    form.appendChild(input);
  });
}

function reopenAssignment(student, lessonTitle, classCode, localId, csrfToken) {
  if (!validateCSRFToken(csrfToken)) {
    console.error('[reopenAssignment] Invalid CSRF token');
    _showToast('❌ Security validation failed. Please refresh.', 4000);
    return;
  }
  // ... proceed
}
```

---

### 3.4 Incomplete Error Logging — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 2958–2976 (safeLS methods), 3007 (checkAndApplyReopens)
**Issue**: Errors logged to console only; no backend logging for debugging production issues.

```javascript
const safeLS = {
  get(key) {
    try { return localStorage.getItem(key); }
    catch(e) {
      console.warn('[safeLS] get failed:', key, e);  // ← Only logs locally
      return null;
    }
  },
  // ...
};

// Line 3007: Silent catch
try {
  const localReopens = safeLS.getJSON('nexterra_reopens', []);
  // ...
} catch(e) {}  // ← Completely swallowed
```

**Problems**:
- Teachers have no visibility into failures
- Impossible to diagnose why data isn't syncing
- No alerting for systemic issues

**Fix Recommendation**: Implement centralized error reporting.
```javascript
const ErrorLogger = (() => {
  const logs = [];
  const MAX_LOGS = 100;

  function log(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,  // 'error', 'warn', 'info'
      message,
      context,
      userAgent: navigator.userAgent,
      student: ST.student || 'unknown'
    };

    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();  // Circular buffer

    // Also log to console
    console[level](`[${level.toUpperCase()}] ${message}`, context);

    // Send to backend every 10 seconds if in error state
    if (level === 'error') {
      reportErrorToBackend(entry);
    }
  }

  function reportErrorToBackend(entry) {
    if (!CONFIG.sheetsUrl) return;

    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true  // Continue even if page unloads
    }).catch(() => {
      // Silently fail if backend unavailable
    });
  }

  return { log };
})();

// Usage:
const safeLS = {
  get(key) {
    try { return localStorage.getItem(key); }
    catch(e) {
      ErrorLogger.log('error', 'localStorage.getItem failed', {
        key, error: e.message, stack: e.stack
      });
      return null;
    }
  },
  // ...
};
```

---

### 3.5 Hardcoded Exam Pass Thresholds — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 894–895
**Issue**: Pass thresholds (70% ELA, 65% Math) are hardcoded constants, not configurable.

```javascript
const PASS_ELA  = 0.70;  // 70% to pass ELA
const PASS_MATH = 0.65;  // 65% to pass Math
```

**Impact**:
- Can't adjust thresholds without code change
- Can't A/B test different pass rates
- Not aligned with actual school policy changes

**Fix Recommendation**: Move to CONFIG or fetch from backend.
```javascript
const CONFIG = {
  sheetsUrl: '...',
  passThresholds: {
    ELA: 0.70,
    Math: 0.65
  }
};

// Or load dynamically:
async function loadConfig() {
  try {
    const response = await fetch('/api/config', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const config = await response.json();
    CONFIG.passThresholds = config.passThresholds || CONFIG.passThresholds;
  } catch (err) {
    console.warn('[loadConfig] Using default thresholds');
  }
}
```

---

### 3.6 No Handling of Concurrent Test Submissions — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 2832–2871 (submitTest)
**Issue**: If student presses "Submit" multiple times quickly, multiple submissions could be sent.

```javascript
function submitTest(timeUp) {
  // No lock or flag to prevent double submission
  clearInterval(ST.timerInterval);
  ST.submitted = true;  // ← Set AFTER processing started

  const score = calcScore();
  ST.scores[lesson.id] = score;
  safeLS.setJSON('nxt_scores', ST.scores);
  clearSavedProgress(lesson.id);

  // ...
  postToSheets(score);  // ← Could be called multiple times
  show('sc-done');
}
```

**Attack**: Student double-clicks submit button → two score submissions.

**Fix Recommendation**:
```javascript
let _submitting = false;

function submitTest(timeUp) {
  if (_submitting) return;  // Prevent double submission
  _submitting = true;

  clearInterval(ST.timerInterval);
  ST.submitted = true;

  const score = calcScore();
  ST.scores[lesson.id] = score;
  safeLS.setJSON('nxt_scores', ST.scores);
  clearSavedProgress(lesson.id);

  // ... update UI
  postToSheets(score);
  show('sc-done');

  // Re-enable after 2 seconds (or after successful POST)
  setTimeout(() => { _submitting = false; }, 2000);
}
```

---

### 3.7 Missing PNG Export Validation for Drawings — MEDIUM

**Severity**: MEDIUM
**Location**: Lines 2539–2553 (saveDrawing)
**Issue**: Canvas exported to PNG without size validation or error handling.

```javascript
function saveDrawing() {
  const canvas = document.getElementById('draw-canvas');
  const dataUrl = canvas.toDataURL('image/png');  // ← Could be huge or fail
  ST.drawings[DRW.qIdx] = dataUrl;
  saveProgress();
  _showToast('✓ Drawing saved.', 3000);
  closeDrawModal();
}
```

**Risk**:
- Very large drawings create huge data URLs (>10MB)
- localStorage quota exceeded
- Syncing massive payloads to Sheets

**Fix Recommendation**:
```javascript
function saveDrawing() {
  const canvas = document.getElementById('draw-canvas');

  try {
    // Compress to JPEG with quality control
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);  // 80% quality

    // Check size before saving
    const sizeKB = dataUrl.length / 1024;
    const MAX_SIZE_KB = 512;  // 512KB limit per drawing

    if (sizeKB > MAX_SIZE_KB) {
      _showToast(`❌ Drawing too large (${Math.round(sizeKB)}KB). Clear and redraw.`, 4000);
      return;
    }

    // Try to save
    if (!ST.drawings) ST.drawings = {};
    ST.drawings[DRW.qIdx] = dataUrl;

    const saved = saveProgress();
    if (saved) {
      _showToast('✓ Drawing saved.', 3000);
    } else {
      _showToast('⚠️ Storage quota exceeded. Try shorter answers.', 4000);
      delete ST.drawings[DRW.qIdx];  // Rollback
      return;
    }

    closeDrawModal();
  } catch (err) {
    console.error('[saveDrawing] Failed:', err);
    _showToast('❌ Failed to save drawing.', 4000);
  }
}
```

---

## 4. LOW-SEVERITY ISSUES

### 4.1 Inconsistent Naming Conventions — LOW

**Severity**: LOW
**Location**: Throughout (ST vs DRW, nxt_ vs nexterra_ prefixes, _var vs var_)
**Issue**: Mixed naming patterns for constants, private state, and localStorage keys.

```javascript
// Inconsistent prefixes:
const ST = { /* global state */ };
const DRW = { /* drawing state */ };
const LESSONS = [];
const CONFIG = {};

// localStorage keys use different prefixes:
'nxt_scores'  // ← short prefix
'nexterra_reopens'  // ← long prefix
'nxt_tpin_h'  // ← short + suffix

// Private functions use inconsistent underscore:
function _sha256() { }  // leading underscore
function saveSR() { }  // no underscore
function _abAddQuestion() { }  // leading underscore
function _DMRefreshStudentList() { }  // leading underscore, mixed case
```

**Impact**: Harder to scan code, inconsistent mental model.

**Fix Recommendation**: Establish and enforce naming standard:
```javascript
// Constants: UPPER_SNAKE_CASE
const CONFIG = { /* ... */ };
const LESSONS = [ /* ... */ ];
const PASS_THRESHOLDS = { ELA: 0.70, MATH: 0.65 };

// Global state: camelCase with clear prefix
const appState = { /* ... */ };
const drawingState = { /* ... */ };

// Private functions: leading underscore
const _sha256 = async (text) => { /* ... */ };
const _normalizeStudentName = (name) => { /* ... */ };

// localStorage keys: consistent prefix
const LS_PREFIX = 'nxt_';
const LS_KEYS = {
  SCORES: `${LS_PREFIX}scores`,
  TIMER_PIN_HASH: `${LS_PREFIX}tpin_h`,
  REOPENS: `${LS_PREFIX}reopens`,
  PROGRESS: `${LS_PREFIX}progress`
};

// Usage:
safeLS.setJSON(LS_KEYS.SCORES, ST.scores);
```

---

### 4.2 Missing TypeScript or JSDoc Comments — LOW

**Severity**: LOW
**Location**: Function definitions (no type hints)
**Issue**: No type annotations or JSDoc; unclear parameter types and return values.

```javascript
function calcScore() {
  // What does this return? What format?
  return { correct, mcTotal, srCount, pct };
}

function renderQuestion(idx) {
  // Is idx a number or string? Required?
}

function postToSheets(score) {
  // What fields does score have? Required?
}
```

**Impact**: IDE autocomplete weak, harder to refactor, onboarding slower.

**Fix Recommendation**: Add JSDoc:
```javascript
/**
 * Calculate the score for the current lesson
 * @returns {{correct: number, mcTotal: number, srCount: number, pct: number}}
 */
function calcScore() {
  const lesson = ST.lesson;
  let correct = 0, mcTotal = 0, srCount = 0;
  lesson.questions.forEach((q, i) => {
    if (q.type === 'mc') {
      mcTotal++;
      if (ST.answers[i] === q.answer) correct++;
    } else if (q.type === 'sr') {
      srCount++;
    }
  });
  const pct = mcTotal > 0 ? correct / mcTotal : 0;
  return { correct, mcTotal, srCount, pct };
}

/**
 * Render the nth question in the lesson
 * @param {number} idx - Zero-based question index
 * @throws {Error} if question is invalid
 */
function renderQuestion(idx) {
  const lesson = ST.lesson;
  if (!lesson || idx < 0 || idx >= lesson.questions.length) return;
  // ...
}

/**
 * Post completed test to Google Sheets
 * @param {{correct: number, mcTotal: number, srCount: number, pct: number}} score
 * @returns {Promise<void>}
 */
async function postToSheets(score) {
  // ...
}
```

---

### 4.3 Missing Accessibility Attributes (ARIA) — LOW

**Severity**: LOW
**Location**: Multiple rendering functions
**Issue**: Some buttons and form fields lack ARIA labels for screen readers.

```javascript
// Line 2400–2407: Choice buttons lack consistent aria-label
html += `<button class="tq-img-choice${isSel?' sel':''}${isElim?' elim':''}"
  onclick="handleChoiceClick(${idx},${ci},'${letter}')"
  aria-label="Choice ${letter}"  // ← Good, but inconsistent
  aria-pressed="${isSel?'true':'false'}"
  ${isElim?'disabled aria-label="Choice '+letter+' — eliminated"':''}>${letter}</button>`;

// vs. Line 2452–2461: Text choice better labeled
html += `
  <button type="button" class="tq-choice${isSel?' sel':''}${isElim?' elim':''}"
    aria-pressed="${isSel ? 'true' : 'false'}"
    aria-label="Choice ${letter}: ${choiceText}"  // ← More detailed
    ${isElim ? 'disabled' : ''}>
```

**Impact**: Screen reader users may be confused by inconsistent labeling.

**Fix Recommendation**:
```javascript
function generateAccessibleChoiceButton(letter, choiceText, isSel, isElim, idx, ci) {
  const ariaLabel = choiceText
    ? `Choice ${letter}: ${choiceText}`
    : `Choice ${letter}`;

  const disabled = isElim ? 'disabled' : '';
  const ariaPressed = isSel ? 'true' : 'false';
  const ariaDisabled = isElim ? 'true' : 'false';

  return `<button
    type="button"
    class="tq-choice${isSel ? ' sel' : ''}${isElim ? ' elim' : ''}"
    onclick="handleChoiceClick(${idx},${ci},'${letter}')"
    aria-pressed="${ariaPressed}"
    aria-disabled="${ariaDisabled}"
    aria-label="${escHtml(ariaLabel)}"
    ${disabled}>
    <div class="tq-cletter" aria-hidden="true">${letter}</div>
    <div class="tq-ctext">${escHtml(choiceText)}</div>
    <div class="elim-line" aria-hidden="true"></div>
  </button>`;
}
```

---

### 4.4 No Rate Limiting on Teacher API Calls — LOW

**Severity**: LOW
**Location**: Lines 3035–3036 (refreshTeacher automatic polling), Line 3048 (manual refresh)
**Issue**: Teacher dashboard refreshes every 45 seconds indefinitely; no backoff for failing requests.

```javascript
if (CONFIG.sheetsUrl && !window._teacherRefreshTimer) {
  window._teacherRefreshTimer = setInterval(refreshTeacher, 45000);  // Fixed 45s, no backoff
}
```

**Impact**:
- Hammers Google Sheets API even if it's broken
- No exponential backoff on errors
- Uses bandwidth unnecessarily

**Fix Recommendation**:
```javascript
const TeacherRefreshManager = (() => {
  let timer = null;
  let interval = 45000;  // Start at 45s
  let failureCount = 0;
  const MAX_FAILURES = 3;
  const MAX_INTERVAL = 5 * 60 * 1000;  // Max 5 minutes

  function scheduleRefresh() {
    if (timer) clearInterval(timer);

    timer = setInterval(async () => {
      try {
        await refreshTeacher();
        failureCount = 0;
        interval = 45000;  // Reset on success
      } catch (err) {
        failureCount++;
        if (failureCount >= MAX_FAILURES) {
          // Back off: 45s → 90s → 180s → 300s
          interval = Math.min(interval * 2, MAX_INTERVAL);
        }
        console.warn('[refreshTeacher] Failed, next attempt in', Math.round(interval / 1000), 's');
      }
    }, interval);
  }

  function start() {
    if (!CONFIG.sheetsUrl) return;
    scheduleRefresh();
  }

  function stop() {
    if (timer) clearInterval(timer);
  }

  return { start, stop };
})();

// Usage:
function loadTeacher() {
  // ...
  TeacherRefreshManager.start();
}
```

---

### 4.5 Missing Analytics or Usage Metrics — LOW

**Severity**: LOW
**Location**: No analytics hooks in the codebase
**Issue**: No way to track student engagement, time-on-task, or question difficulty.

**Impact**: Teachers can't identify struggling students or problematic questions without score data.

**Fix Recommendation**:
```javascript
const Analytics = (() => {
  const events = [];

  function trackEvent(action, data = {}) {
    const event = {
      action,
      data,
      timestamp: new Date().toISOString(),
      student: ST.student,
      lessonId: ST.lesson?.id
    };
    events.push(event);

    // Send batches to backend periodically
    if (events.length >= 10) {
      flushEvents();
    }
  }

  function flushEvents() {
    if (events.length === 0) return;

    const batch = events.splice(0, 10);
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true
    }).catch(() => {
      // Re-queue events if failed
      events.unshift(...batch);
    });
  }

  return { trackEvent, flushEvents };
})();

// Track user interactions:
function renderQuestion(idx) {
  // ...
  Analytics.trackEvent('question_viewed', { idx, totalQuestions: lesson.questions.length });
}

function handleChoiceClick(qIdx, cIdx, letter) {
  Analytics.trackEvent('choice_selected', { questionIdx: qIdx, choice: letter });
  // ...
}

function submitTest(timeUp) {
  Analytics.trackEvent('test_submitted', {
    timeUp,
    timeTaken: Math.round((Date.now() - ST.testStartTime) / 1000),
    score: calcScore()
  });
  // ...
}
```

---

### 4.6 No Backup/Export of Student Data — LOW

**Severity**: LOW
**Location**: No explicit backup mechanism
**Issue**: Student scores stored only in localStorage and Google Sheets; no export option.

**Impact**: If Sheets goes down, data is lost unless backed up manually.

**Fix Recommendation**:
```javascript
function exportAllStudentData() {
  const data = {
    student: ST.student,
    classCode: ST.classCode,
    exportedAt: new Date().toISOString(),
    scores: ST.scores,
    answers: ST.answers,
    bookmarks: ST.bookmarks,
    drawings: ST.drawings
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ST.student}_data_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Teachers can also trigger full class export:
function exportClassData() {
  const rows = window._currentTeacherRows || [];
  const csv = convertToCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv' });
  // ... download
}
```

---

## 5. SECURITY SCORECARD

| Category | Rating | Notes |
|----------|--------|-------|
| **Input Validation** | ⚠️ WEAK | No validation of lesson data, answer format, or student input lengths |
| **Output Encoding** | ✅ GOOD | `escHtml()` used consistently for text content |
| **Authentication** | ✅ GOOD | PIN hashing, no plaintext passwords |
| **Authorization** | ⚠️ WEAK | No CSRF tokens on teacher actions; students could guess closure IDs |
| **Data Protection** | 🔴 CRITICAL | Hardcoded PII (student names), no encryption for sensitive fields |
| **API Security** | 🔴 CRITICAL | Hardcoded Google Apps Script URL, no API key rotation |
| **Error Handling** | ⚠️ WEAK | Silent failures, swallowed exceptions, no audit logging |
| **Client-Side Security** | ⚠️ WEAK | Timer can be disabled, scores can be modified via DevTools |
| **CSP Header** | ✅ GOOD | Restrictive CSP in place, blocks inline scripts except `unsafe-inline` |
| **Dependency Security** | ✅ GOOD | Only Fuse.js external library, no known vulns in v7.0.0 |

---

## 6. TECHNICAL DEBT SUMMARY

| Area | Impact | Estimated Effort to Fix |
|------|--------|------------------------|
| Extract safeLS definition (TDZ) | High | 15 minutes |
| Externalize CONFIG secrets | Critical | 1 hour |
| Remove hardcoded PII (student names) | Critical | 2 hours |
| Add retry logic to fetch() calls | High | 2 hours |
| Break down renderQuestion() complexity | High | 3 hours |
| Refactor renderTeacherTable() into smaller functions | High | 2 hours |
| Centralize name matching logic | Medium | 1 hour |
| Replace inline event handlers with addEventListener() | Medium | 2 hours |
| Add server-side time validation | Medium | 3 hours (requires backend) |
| Implement CSRF token validation | Medium | 2 hours |
| Add input validation for questions/answers | Medium | 2 hours |
| Implement error reporting to backend | Medium | 2 hours |
| Add TypeScript/JSDoc comments | Low | 2 hours |
| Improve ARIA accessibility | Low | 1 hour |
| Add analytics tracking | Low | 2 hours |

**Total Estimated Refactoring Effort**: 24–26 hours (for all issues)
**Priority 1 (Must Fix)**: 3 hours (TDZ, secrets, PII)
**Priority 2 (Should Fix)**: 6 hours (complexity, fetch error handling)
**Priority 3 (Nice to Have)**: 15+ hours (refactoring, logging, accessibility)

---

## 7. RECOMMENDATIONS

### Short-term (Before next test cycle):
1. Move CONFIG.sheetsUrl to environment variable
2. Remove hardcoded student names; load roster from secure API
3. Add basic error notifications to users (toast messages)
4. Fix TDZ violation by moving safeLS before init IIFE
5. Add input validation for lesson data

### Medium-term (Next sprint):
1. Break down renderQuestion() and renderTeacherTable() into smaller, testable functions
2. Replace inline onclick handlers with addEventListener()
3. Add server-side time validation for test timer
4. Implement centralized error logging
5. Add CSRF token validation for teacher actions

### Long-term (Architectural):
1. Migrate to a TypeScript/React + backend architecture (remove monolithic vanilla JS)
2. Implement proper API layer with authentication/authorization
3. Add comprehensive audit logging for sensitive actions
4. Consider SOC 2 Type II compliance for production use
5. Implement automated testing (unit, integration, e2e)

---

## 8. TOOLS & PROCESSES

### For Ongoing Code Quality:
1. **ESLint** with strict rules to catch TDZ issues
2. **SonarQube** for complexity analysis (flag functions >10 CC)
3. **OWASP ZAP** or **Burp Suite** for security scanning
4. **Lighthouse** for accessibility audits
5. **Percy** or **Chromatic** for visual regression testing

### Pre-commit Checks:
```bash
# .git/hooks/pre-commit
eslint . --max-warnings 0
npm run type-check  # If using JSDoc with TypeScript language server
npm run test  # Unit tests
npm run audit  # Security audit for dependencies
```

---

## Conclusion

This vanilla JS portal demonstrates **solid fundamentals** (CSP headers, hash-based PIN verification, consistent HTML escaping) but suffers from **architectural limitations** of monolithic single-file applications:

- **Maintainability**: High cognitive complexity, tight coupling of concerns
- **Security**: Several critical issues (hardcoded secrets, PII exposure, weak client validation)
- **Scalability**: Current architecture unsuitable for multi-school deployment
- **Testability**: Difficult to unit test due to tight DOM coupling and global state

**For a student practice portal**: This is acceptable if confined to low-stakes use and the recommendations are addressed.

**For production use with sensitive data**: Significant refactoring or rewrite is required, particularly around data protection, API security, and audit logging.

**Next steps**:
1. Address the 4 critical issues immediately
2. Create a technical debt backlog
3. Plan incremental refactoring
4. Consider a TypeScript/React + backend rewrite for future scalability

---

**Review Completed**: April 2, 2026
**Reviewer**: Code Quality Expert
**Status**: Ready for Implementation Planning
