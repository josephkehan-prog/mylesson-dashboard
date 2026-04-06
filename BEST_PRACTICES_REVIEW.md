# Best Practices & Maintainability Review
## nexterra_student.html (4,234 lines, ~187KB)

**Review Date:** April 2, 2026
**Scope:** Maintainability, Error Handling, Accessibility, Browser Compatibility
**Codebase:** Single-file vanilla JS, GitHub Pages hosted, no build step

---

## Executive Summary

This single-file portal exhibits moderate maintainability concerns balanced against reasonable error handling in critical sections. The code prioritizes functionality and offline reliability over architectural clarity, resulting in a codebase with **duplicated logic, unclear function boundaries, and significant accessibility gaps for 3rd-grade users**. While the `safeLS` wrapper demonstrates defensive programming, error handling is inconsistently applied, and the absence of a module system creates coupling between distinct workflows (test rendering, drawing, teacher dashboard).

**Overall Maintainability Grade: C+**

---

## 1. MAINTAINABILITY ASSESSMENT

### 1.1 Magic Numbers & Hardcoded Values

**Severity:** Medium
**Lines:** 50+, scattered throughout

Hardcoded numeric constants undermine readability and future changes:

| Context | Lines | Issue |
|---------|-------|-------|
| Timeout durations | 2166, 2210, 2220 | `setTimeout(() => {...}, 60)` magic milliseconds |
| Pass thresholds | 894–895 | `PASS_ELA = 0.70`, `PASS_MATH = 0.65` defined once, recalculated in `getPassThreshold()` |
| Font sizes | 40–50 | `font-size: 10px`, `11px`, `12px`, `13px` scattered across CSS—no size scale |
| Canvas dimensions | 2515 | `Math.min(window.innerWidth * 0.9, 820)` hardcoded max-width |
| Zoom increments | 2761–2766 | Zoom changes by fixed percent; step size inferred, not documented |
| Timer thresholds | 2353–2357 | Color changes at < 60 seconds (warn state) |
| Question max length | 429–430 | Character counter on text areas, no global limit |

**Impact:** Changes to test timing, display scale, or passing criteria require hunting through 4,000+ lines.

**Recommendation:**
```javascript
const UI_CONSTANTS = {
  TIMEOUT_FOCUS_RESTORE_MS: 60,
  CANVAS_MAX_WIDTH: 820,
  TIMER_WARN_THRESHOLD_SEC: 60,
  ZOOM_STEP_PERCENT: 0.2,
  PASS_THRESHOLDS: { ELA: 0.70, MATH: 0.65 }
};
```

---

### 1.2 Duplicate Logic & Missed Extraction Opportunities

**Severity:** High
**Impact:** Increases bug risk; changes to validation, rendering, or state updates require edits in multiple places

#### A. Question Rendering Duplication (renderQuestion, lines 2360–2505)

- **Image-based MC** (2391–2408): Renders A–D choice bubbles
- **Text-based MC** (2442–2463): Renders A–E choice buttons with different HTML
- **Image SR** (2409–2430): Drawing + textarea
- **Text SR** (2464–2500): Conditional short-answer input or textarea + drawing

All perform similar state lookups (`ST.eliminated[idx]`, `ST.answers[idx]`, `ST.bookmarks[idx]`) but in isolated blocks.

**Specific duplication:**
- Lines 2396–2397 vs. 2443–2444: `const elim = ST.eliminated[idx] || []; const sel = ST.answers[idx];`
- Lines 2414–2415 vs. 2465: `const saved = ST.answers[idx] || '';`
- Lines 2481, 2487–2488 vs. 2483–2490: Drawing preview HTML generation (duplicated structure)
- Lines 2423 vs. 2488: `.replace(/^[A-E]\s+/, '')` text sanitization appears once but is needed in multiple choice types

**Root cause:** Monolithic 145-line function attempting to handle 4 question types inline.

**Refactoring opportunity:**
```javascript
function extractQuestionState(qIdx) {
  return {
    eliminated: ST.eliminated[qIdx] || [],
    selected: ST.answers[qIdx],
    text: ST.answers[qIdx] || '',
    drawing: ST.drawings?.[qIdx] || '',
    bookmarked: !!ST.bookmarks[qIdx]
  };
}

function renderMCChoices(choices, qIdx, state) {
  // Centralized logic for both image and text MC
}

function renderDrawingPreview(qIdx, state) {
  // Returns HTML for both image and text SR
}
```

#### B. Teacher Table Row Rendering (lines 3117–3146)

`buildTableRows()` nested inside `renderTeacherTable()`:
- Cannot be reused if table needs to be re-rendered without full refresh
- Score classification logic duplicated if analytics view needs same thresholds
- Column HTML strings hardcoded; adding a column requires editing inline template

#### C. localStorage Access Pattern (lines 2245, 2312–2314, 2937, 2941, 3000–3006)

Dozens of calls to `safeLS.getJSON()` with fallback patterns:

```javascript
// Lines 2245
const _assigned = (function(){try{return safeLS.getJSON('nexterra_assigned', null);}catch(e){return null;}})();

// Lines 2937
safeLS.setJSON('nxt_prog_' + ST.lesson.id, data);

// Lines 3000–3006 (within checkAndApplyReopens)
const localReopens = safeLS.getJSON('nexterra_reopens', []);
// ... forEach + filter + delete + safeLS.remove()
```

**Issue:** Key names hardcoded across 7 locations; lesson ID embedded in key string (poor separation). If schema changes, multiple edits required.

**Refactoring opportunity:**
```javascript
const STORAGE_KEYS = {
  SCORES: 'nxt_scores',
  PROGRESS: (lessonId) => `nxt_prog_${lessonId}`,
  REOPENS: 'nexterra_reopens',
  ASSIGNED: 'nexterra_assigned'
};

function saveProgress(lessonData) {
  return safeLS.setJSON(STORAGE_KEYS.PROGRESS(lessonData.id), lessonData);
}
```

---

### 1.3 Functions Violating Single Responsibility Principle (SRP)

**Severity:** High

| Function | Lines | Responsibilities | Issue |
|----------|-------|-------------------|-------|
| `beginTest()` | 2290–2339 | 1. Load saved state 2. Setup UI text 3. Configure passage 4. Initialize timer 5. Render question | 50 lines doing 5+ things; no clear sequence |
| `renderQuestion()` | 2360–2505 | 1. Validate state 2. Update strip 3. Update header 4. Build 4 question types 5. Inject HTML | 145 lines; 4 question types in one function |
| `renderTeacherTable()` | 3071–3197 | 1. Fetch and sort data 2. Filter options 3. Calculate stats 4. Build table rows 5. Render UI 6. Attach event handlers | 127 lines; deeply nested local functions |
| `_renderBuilderQuestion()` | 3644–3679 | 1. Determine question type 2. Build conditional HTML 3. Attach input handlers | 36 lines but controls critical editing state via closures |
| `attachDrawEvents()` | 2595–2656 | 1. Setup mouse/touch listeners 2. Implement drawing state machine 3. Handle undo/redo 4. Render canvas updates | 62 lines of nested event handlers |
| `submitTest()` | 2832–2872 | 1. Validate state 2. Calculate score 3. Post to Sheets 4. Save locally 5. Show result screen 6. Clear state | 41 lines; early returns make control flow unclear |

**Consequence:** Bugs in one responsibility (e.g., question rendering) require understanding and modifying entire function. Testing is impossible without full integration.

---

### 1.4 Naming Consistency Issues

**Severity:** Medium
**Lines:** Throughout

Inconsistent naming patterns create cognitive load:

| Pattern | Instances | Issues |
|---------|-----------|--------|
| `ST` object | Global, line 2062 | Ambiguous: "State Test"? "Shared Test"? No jsdoc |
| DRW | Line 2508 | Cryptic three-letter abbreviation for drawing state |
| `tl-`, `tc-`, `t-`, `tq-`, `tb-` | CSS classes throughout | Prefix meanings not documented (tl=test list? tc=test card? tb=toolbar?) |
| `_ab`, `_rkExisting`, `_tableRows` | Lines 3584, 3766, 3161 | Leading underscore used inconsistently; sometimes private, sometimes module-scoped |
| `q`, `r`, `l` | Query results, rows, lessons | Single letters in loops; unclear without context |
| Function verbs | `_teacherPinSetup()` vs. `openTestInst()` vs. `toggleBookmarkCurrent()` | No consistent pattern (underscore = internal? verb tense varies) |

---

### 1.5 Dead Code & Unused Exports

**Severity:** Low
**Lines:** 2077–2085, scattered

- Line 207: `.t-timer.warn { }` — CSS rule with no content
- Line 214–215: `.t-tools { display: none; }`, `.ttool { display: none; }` — marked "old kept for compat" but compat with what?
- Line 3085–3086: `window._getPct = getPct; window._getPassThreshold = _getRowPassThreshold;` — Exposed to global for... debugging? Fragile to refactoring.
- Lines 3161–3165: `window._tableRows = ...`, `window._currentTeacherRows` — Globals set but only used by `applyTableFilter()` which reads them; could be closure-scoped.

---

### 1.6 Complex Nested Structures & Deep Coupling

**Severity:** Medium

**checkAndApplyReopens() (lines 2988–3025):**
- Nested function `applyReopens()` captures `callback` from outer scope
- Mixes two data sources: remote Sheets API + local localStorage
- Silently catches exceptions with `catch(() => {...})`; errors are swallowed
- Control flow: fetch → transform → apply → save; unclear if state mutations are safe if called twice

**Teacher modal flow (lines 2157–2220):**
- `openTeacherLogin()` displays modal and focuses input
- `_teacherPinSetup()` validates, hashes, and saves; then calls `_teacherPinClose()` on success
- `_teacherPinVerify()` checks hash, then focuses input on error
- Each function assumes prior setup (modal already visible, `_ab` object already initialized)
- No explicit state machine; behavior depends on implicit call sequence

---

## 2. ERROR HANDLING GAPS

### 2.1 Missing try/catch Around Critical DOM Access

**Severity:** High
**Risk:** Silent failures if IDs don't exist or if called during page unload

| Lines | Pattern | Risk |
|-------|---------|------|
| 2077–2078 | `document.getElementById('ln-code').addEventListener(...)` | If element not in DOM, throws immediately |
| 2080 | Hard assumption that IDs exist before event binding | Called in init IIFE; no guard |
| 2166, 2200 | `if (el) { el.value = ''; el.focus(); }` | Partial guarding; inconsistent with other calls |
| 2282–2285, 2309 | `document.getElementById(...).textContent = ...` | No null check; assumes element exists |
| 3041–3043 | `el.innerHTML = ...`, `statsEl.innerHTML = ...` | No try/catch; renderTeacherTable() crashes if IDs missing |
| 3366 | `document.getElementById('t-qpane').innerHTML = html;` | Unguarded in renderQuestion() |

**Specific vulnerability:**
If `openTeacherLogin()` is called before DOM is ready, `document.getElementById('teacher-pin-modal')` at line 2158 could return null, causing `.style.display` to fail.

**Current pattern:** Selective null checks in some places (e.g., line 2166), complete absence in others.

### 2.2 Unhandled Promise Rejections

**Severity:** Medium
**Lines:** 2048–2054, 3014–3024, 3890–3924

#### fetch() + catch chains

```javascript
// Line 3048–3054 (refreshTeacher)
fetch(CONFIG.sheetsUrl)
  .then(r => r.json())
  .then(rows => {
    window._sheetsRows = Array.isArray(rows) ? rows : (rows.rows || []);
    renderTeacherTable(window._sheetsRows, 'sheets');
    lastEl.textContent = 'Live · Updated ' + new Date().toLocaleTimeString();
  })
  // NO .catch()! Network error → unhandled rejection
```

```javascript
// Line 2890–2927 (postToSheets)
async function postToSheets(score) {
  // ... fetch code ...
  return fetch(submissionUrl, {method: 'POST', body: JSON.stringify(payload)})
    .then(r => r.json())
    .catch((err) => { console.warn('[postToSheets] Submission failed:', err); });
    // ✓ Has catch, but swallows error; no retry or user feedback
}
```

**Impact:**
- Unhandled rejections in `refreshTeacher()` leave UI in "Loading..." state indefinitely
- Network failure during `postToSheets()` logs to console but user sees no indication
- No timeout/retry logic; user may think submission succeeded when it failed

#### Crypto.subtle.digest() failures (line 2151–2156)

```javascript
async function _sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);  // No try/catch!
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

If crypto API is unavailable or fails, promise rejection is unhandled.

**Caller (line 2181):**
```javascript
safeLS.set(_TPIN_KEY, await _sha256(pin));  // await without try/catch
```

Called from `_teacherPinSetup()` which has no error handling.

---

### 2.3 Silent Failures in localStorage Fallback

**Severity:** Medium
**Lines:** 2245, 3365, 3462, 3717–3720, etc.

**Pattern 1 (overly defensive):**
```javascript
// Line 2245
const _assigned = (function(){
  try{return safeLS.getJSON('nexterra_assigned', null);}
  catch(e){return null;}
})();
```

The `safeLS.getJSON()` already has try/catch (line 2969–2970), so this is redundant. But it obscures intent: *why* is there an extra try/catch?

**Pattern 2 (inconsistent fallback logic):**
```javascript
// Line 3365 (in renderTeacherTable > buildTableRows)
if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch(e) { answers = {}; } }

// Line 3462 (in teacher analytics)
if (typeof answers==='string'){try{answers=JSON.parse(answers);}catch(e){answers={};}}
```

Same logic appears twice; if parsing strategy changes, both must be updated.

**Pattern 3 (silent catch, no logging context):**
```javascript
// Lines 3717–3720
try {
  const existing = safeLS.getJSON('nexterra_custom_lessons', []);
  existing.push(newLesson);
  safeLS.setJSON('nexterra_custom_lessons', existing);
} catch(e) {}  // Silently swallows quota exceeded, parse errors, etc.
```

No logging; if assignment save fails, user won't know.

---

### 2.4 Missing Input Validation

**Severity:** Medium–High
**Risk:** Incorrect data saved to localStorage or submitted to Sheets

| Function | Input | Validation | Issue |
|----------|-------|-----------|-------|
| `saveSR()` (line 2683) | `idx`, `val` | None | No type check; `ST.answers[idx]` directly assigned; no length limit |
| `handleChoiceClick()` (line 2662) | `qIdx`, `cIdx`, `letter` | None | Assumes `letter` matches `cIdx`; no bounds check on indices |
| `doLogin()` (line 2096) | Name, class code | Fuzzy match via Fuse.js | If Fuse fails, silently falls through to error message; no fallback |
| `_abAddQuestion()` (line 3700+) | Question object | None on construction | Questions added to `_ab.questions` with incomplete fields; saves if user clicks "Save" |
| Drawing canvas save (line 2541) | Canvas data | None | `toDataURL()` can fail; no error handling |

---

## 3. ACCESSIBILITY (WCAG 2.1 Level)

### 3.1 Critical Issues (WCAG Level A failures)

**Severity:** High
**Impact:** Screen reader users and keyboard-only users cannot access test content

#### A. Missing Labels for Question Types

- **Image MC** (line 2403–2406): Buttons labeled "Choice A" but image context is absent for screen readers
  ```html
  <button aria-label="Choice ${letter}" aria-pressed="${isSel?'true':'false'}">${letter}</button>
  ```
  Missing: The question image itself is not described; screen reader users cannot read the problem.

- **Text MC** (line 2454–2457): Better, includes choice text in aria-label
  ```html
  aria-label="Choice ${letter}: ${choiceText}"
  ```

- **Short Response** (line 2471): No associated label
  ```html
  <label>Answer</label>
  <textarea class="tq-sr-ta" id="tq-sr-${idx}">
  ```
  Label is not properly connected to textarea; `<label for="...">` pattern missing.

#### B. Image Accessibility

- **Question images** (line 2392): `alt="Question ${idx+1}"` — generic, non-descriptive
  ```html
  <img src="${q.img}" alt="Question ${idx+1}" />
  ```
  Should describe the actual content: "Two-digit multiplication problem: 24 × 3" or equivalent.

- **Drawing preview images** (line 2548): `alt="Your drawing"` — acceptable but no status
  ```html
  <img src="${dataUrl}" alt="Your drawing" />
  ```

#### C. Passage Text Highlighting (lines 2082, 2768–2786)

- Highlighting tool allows students to mark passage text with mouse
- No keyboard equivalent provided
- `onPassageMouseUp()` handles text selection but expects mouse events
- Status of highlighted sections not announced to screen reader

#### D. Focus Management

- **Modal dialogs** (line 687): `role="dialog" aria-modal="true"` correctly applied
  ```html
  <div id="teacher-pin-modal" role="dialog" aria-modal="true" aria-labelledby="tpm-title">
  ```
  But no focus trap; user can Tab out of modal while it's open.

- **Test screen transitions** (line 2337–2338): `show('sc-test')` hides previous screen but doesn't explicitly move focus
  - No `autofocus` attribute on first interactive element (question pane)
  - Screen reader may announce previous content area

- **Review screen** (line 2787–2820): Transitions to review table without focusing the table
  - User tabbing position may be undefined

#### E. Color Contrast Issues

**CSS measurements (using WCAG 2.1 Level AA guideline: 4.5:1 for normal text, 3:1 for large text)**

| Element | Foreground | Background | Ratio | Pass? | Issue |
|---------|-----------|-----------|-------|-------|-------|
| `.tl-student` (line 86) | `opacity: .85` on white | Dark blue header | ~4.25:1 | Marginal | Opacity reduces contrast; should be explicit color |
| `.tc-status.new` (line 118) | `#1967d2` | `#e8f0fe` | 4.8:1 | Pass | OK |
| `.p-num` line numbers (line 231) | `#1a1a1a` | White | 13:1 | Pass | OK |
| `.tq-sr-hint` (line 295) | `#5a6478` | White | 6.4:1 | Pass | OK |
| `.inst-tool-chip` (line 146) | `#333` | `#f0f4ff` | 8.2:1 | Pass | OK |
| **`.login-field label`** (line 52) | `#555` | White | 5.8:1 | Pass | OK but small (11px) |
| **`.login-hint`** (line 74) | `#767676` | White | 4.7:1 | Pass | Marginal; 12px size |

**Font sizes for 3rd graders (age ~8–9, typical visual acuity):**
- Question stems: 17px (line 266) — good
- Choice text: 15px (line 292) — adequate
- Passage text: 15px (line 232) — adequate
- **Login labels: 11px** (line 52) — **too small for young users** (WCAG recommends min 14px for body text)
- **Status labels: 10px** (line 93, 107, 115) — **too small**
- **Timer: not visible** (line 207 `display: none !important`) — but was presumably important for time management

### 3.2 Important Issues (WCAG Level AA)

**Severity:** Medium

#### A. Keyboard Navigation Gaps

- **Zoom buttons** (line 792–793): Keyboard accessible (buttons), but no keyboard shortcut (e.g., + / – keys)
- **Passage highlighting** (line 2082): No keyboard alternative
- **Tool toggles** (line 805–808): Buttons work but `aria-pressed` not updated dynamically
  ```html
  <button id="ttool-hl" onclick="toggleTool('hl')" aria-pressed="false">
  ```
  After `toggleTool('hl')` is called, `aria-pressed` remains "false" if not explicitly updated

#### B. Screen Reader Announcements

- **Timer updates** (line 2352–2357): Every second the timer DOM changes but no aria-live region announces time remaining
- **Question navigation** (line 2703–2715): Jumping to new question doesn't announce "Question 5 of 12" to screen reader
- **Test submission** (line 2832–2870): No aria-live region confirms submission success/failure
- **Error messages** (line 2103–2130): `.login-err` has no `role="alert"` (should have)

#### C. Button Semantics

- **Bookmark toggle** (line 383–386): Uses emoji as button content
  ```html
  ${bmarked ? '🔖' : '🏳️'}
  ```
  Emoji are not guaranteed to display or be announced consistently by screen readers

- **Choice elimination visual** (line 280–283): Line drawn through choice visually, but no aria label
  ```html
  <div class="elim-line" aria-hidden="true"></div>
  ```
  OK that it's hidden from screen reader, but choice button label should say "eliminated"

### 3.3 Nice-to-Have Improvements (WCAG Level AAA)

- Skip links: One skip link exists (line 657) but only targets login screen, not test content
- Captions/transcripts: Math diagrams shown as images (lines 906–949) but no text equivalent
- Language tag: `<html lang="en">` present (line 2) — good
- Form labels: Short Response textareas (line 2471) use `<label>` but not connected with `for=` attribute

---

## 4. BROWSER COMPATIBILITY

### 4.1 Modern APIs with Fallback Concerns

**Severity:** Medium

| API | Lines | Browser Support | Fallback? | Issue |
|-----|-------|-----------------|-----------|-------|
| `crypto.subtle.digest()` | 2151–2156 | All modern browsers except some private/incognito | Manual fallback at 2905–2907 | Try-catch catches failures; teacher PIN falls back to no-hash mode (line 2905 comment) but logic unclear |
| `localStorage` | Throughout | All modern browsers; fails in private browsing | safeLS wrapper exists | Good; logs warning and continues |
| `TextEncoder()` | 2152 | Modern browsers only | None | No feature detection; would fail silently in very old IE |
| `.toDataURL('image/jpeg')` | 2541 | All modern browsers | None | Drawing canvas may not be supported in very old Android browsers |
| `AbortController` | 3012–3023 | Modern browsers (not IE11) | Timeout fallback | Good; used with timeout for Sheets fetch |
| `Array.from()` | 2153 | ES6; not IE11 | None | No transpilation; codebase assumes ES6 |
| Template literals | Throughout | ES6 | None | Extensive use; requires modern browser |
| `const` / `let` | Throughout | ES6 | None | No `var` fallback |
| Spread operator `...` | 3020 | ES6 | None | `[...(data.rows||[])]` requires ES6 |

### 4.2 CSS Features

**No major concerns; all CSS is widely supported:**
- Flexbox: Line 27 onward — excellent browser support (except IE10)
- Grid: Line 97 — supported in modern browsers, gracefully degrades in older Chrome

### 4.3 School Chromebook / Institutional Browser Concerns

**Severity:** Low–Medium

Typical school Chromebooks run modern Chrome (automatically updated), but may have:
- **Restrictions on external script loading** — CSP at line 9 allows `https://cdnjs.cloudflare.com` (Fuse.js)
- **Private browsing mode blocks localStorage** — **Already handled** by safeLS wrapper (line 2956–2976)
- **Older Android tablets** (some school iPads) — may not support `canvas.toDataURL()` reliably

**Recommendation:** Test drawing canvas on target device types.

---

## 5. ERROR HANDLING PATTERNS — SUMMARY

| Pattern | Usage | Assessment |
|---------|-------|-----------|
| **safeLS wrapper** (2955–2976) | All localStorage access | ✓ **Good** — try/catch on each operation, console warnings, safe fallbacks |
| **fetch with timeout** (3012–3024) | Google Sheets API | ✓ **Good** — AbortController + 4-second timeout prevents hanging |
| **Crypto fallback** (2905–2907) | Teacher PIN hash | ✓ **Acceptable** — silently falls back if crypto unavailable; no PIN hashing in that mode (less secure but functional) |
| **Duplicate try/catch** (2245) | Assignment filtering | ✗ **Redundant** — safeLS already wraps; outer try/catch unnecessary |
| **Silent catch** (3717–3720) | Custom lesson save | ✗ **Poor** — no logging; user won't know if save failed |
| **Unhandled promise rejection** (3048–3054) | Teacher dashboard refresh | ✗ **Critical** — no .catch(); UI hangs on network error |
| **No error handling** (2282–2285, 2309) | DOM updates | ✗ **Dangerous** — crashes if element IDs don't exist |
| **Input validation** | Most functions | ✗ **Weak** — no guards on student input, drawing data, question objects |

---

## 6. TOP 10 QUICK WINS

*Low-effort, high-impact improvements to code quality and reliability*

### 1. **Standardize error handlers for DOM access** (2 hours)
   - Wrap all `document.getElementById()` with null checks
   - Create helper: `function getEl(id) { const el = document.getElementById(id); if (!el) throw new Error(...); return el; }`
   - Replace 30+ bare calls to reduce silent failures

### 2. **Add .catch() to unhandled fetch() promises** (1 hour)
   - Lines 3048–3054 (refreshTeacher): Add `.catch(() => { lastEl.textContent = 'Offline'; })`
   - Lines 3890–3924: Ensure all fetch calls have error UI feedback
   - Prevents hanging UI on network failures

### 3. **Extract question rendering logic** (4 hours)
   - Create `renderMCChoices()` and `renderSRQuestion()` helper functions
   - Reduce `renderQuestion()` from 145 lines to <60 lines
   - Eliminates duplicate state lookups and HTML generation

### 4. **Create storage key constants** (1 hour)
   - Move all hardcoded key names (`'nxt_scores'`, `'nxt_prog_'`, etc.) to `STORAGE_KEYS` object
   - Single place to update if schema changes
   - Lines 2245, 2937, 2941, 3000, 3006, etc. become clearer

### 5. **Add ARIA labels to choice buttons** (2 hours)
   - Update all image MC buttons: include question description in aria-label
   - Add `role="alert"` to `.login-err` and error divs
   - Connect SR textarea labels with `for=` attribute
   - Major a11y win for screen reader users

### 6. **Increase font size for login screen labels** (30 min)
   - Change `.login-field label` from 11px to 14px
   - Change `.tl-section-lbl` from 11px to 13px
   - Improves readability for 3rd graders

### 7. **Extract timer UI updates** (1 hour)
   - Move timer display logic to separate function: `startTestTimer(initialSec)`, `stopTestTimer()`
   - Encapsulate `ST.timerSec`, `ST.timerInterval` in module
   - Fixes issue where timer update lacks error handling

### 8. **Consolidate JSON parse error handling** (30 min)
   - Lines 3365, 3462 both parse answer JSON — create shared `safeJsonParse(str, fallback)` helper
   - Single place to update parsing strategy (e.g., if answer format changes)

### 9. **Add focus management to screen transitions** (2 hours)
   - When `show(screenId)` switches screens, focus first interactive element
   - Add `autofocus` attribute or `.focus()` call
   - Fixes issue where focus position undefined after modal close

### 10. **Create feature detection for crypto API** (1 hour)
   - Detect `crypto.subtle` availability at startup
   - Set flag: `const HAS_CRYPTO = typeof crypto !== 'undefined' && crypto.subtle`
   - Skip PIN hashing attempt if not available; clear error message instead

**Total effort: ~14 hours for all 10 items**
**Expected quality improvement: C+ → B–**

---

## 7. DETAILED RECOMMENDATIONS

### 7.1 Reorganize ST Object

Current state mixing student and teacher data:
```javascript
let ST = {
  student: '',
  classCode: '',
  lesson: {},
  answers: {},
  scores: {},
  // ... 10+ more properties
};
```

Proposed structure:
```javascript
const AppState = {
  student: {
    name: '',
    classCode: '',
    scores: {}
  },
  test: {
    lesson: null,
    currentQ: 0,
    answers: {},
    bookmarks: {},
    eliminated: {},
    timerSec: 0,
    timerInterval: null
  },
  teacher: {
    pinHash: '',
    assigned: []
  },
  ui: {
    zoom: 1.0,
    highlightMode: false
  }
};
```

Benefits:
- Clearer responsibility boundaries
- Easier to debug state mutations
- Supports separate "student" and "teacher" modules without mixing concerns

### 7.2 Event Handler Organization

Currently: Inline `onclick` attributes throughout HTML (lines 678, 2271, 2418, etc.)

**Issue:** Can't easily trace which events are bound; XSS risk if lesson.id is unsanitized in onclick attribute.

**Recommendation:** Bind events in JavaScript after DOM ready:
```javascript
function setupEventListeners() {
  document.querySelectorAll('[data-open-test]').forEach(btn => {
    btn.addEventListener('click', (e) => openTestInst(e.currentTarget.dataset.lessonId));
  });
}
```

Then in HTML:
```html
<button class="tc-btn" data-open-test="${lesson.id}">${btnText}</button>
```

Benefits:
- No inline JS in HTML
- Easier to add event delegation
- Avoids template injection risks

### 7.3 Module Boundaries

Proposed refactoring to logical modules:

```
nexterra_student.html
├── ui/
│   ├── login.js (doLogin, openTeacherLogin, _teacherPin*)
│   ├── testRenderer.js (renderQuestion, renderTestList, renderStrip)
│   ├── teacherDashboard.js (renderTeacherTable, refreshTeacher, etc.)
│   └── drawing.js (canvas setup, save, undo/redo)
├── core/
│   ├── state.js (AppState management, reducer-like functions)
│   ├── storage.js (safeLS, key management)
│   └── api.js (postToSheets, fetchReopens)
└── main.js (init, routing, event handlers)
```

With no build step, could use ES6 modules + import/export, bundled together by hand or simple concatenation script.

---

## 8. OVERALL MAINTAINABILITY GRADE

### Grade: **C+** (Satisfactory for prototype; needs refactoring for growth)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Code Organization** | C | Single file; no module boundaries; functions are large and multipurpose |
| **Naming & Clarity** | C+ | Mostly clear but cryptic abbreviations (ST, DRW, tl-, tc-) reduce readability |
| **Error Handling** | C | safeLS wrapper is solid; but unhandled promise rejections, missing null checks elsewhere |
| **Duplication** | C– | Multiple question types, table rendering, JSON parse logic duplicated |
| **Accessibility** | D+ | Missing labels, no keyboard alternatives for tools, focus management gaps |
| **Browser Support** | B | Modern ES6 code; good fallback for localStorage; no polyfills for older browsers |
| **Testability** | D | Monolithic functions; global state; no clear interfaces; unit testing nearly impossible |
| **Documentation** | C– | Few comments; no jsdoc; inline HTML/CSS/JS makes intent unclear |
| **Performance** | B– | O(n²) grid rendering (line 2247 forEach + renderStrip which rerenders all); but acceptable for <100 students |

**Recommendation for production use:**
If this codebase grows (more lessons, more students, new features), refactor immediately. Current structure will become unmaintainable at 6,000+ lines. If codebase is stable and small, C+ is acceptable for a single-file prototype.

---

## 9. APPENDIX: Specific Code Smells

### Code Smell A: Magical Booleans

```javascript
// Line 2306
ST.submitted = false;  // When is this checked? What does it mean?
```
Grep for usage of `ST.submitted`:
- Set to `false` at line 2306
- Set to `true` at line 2862
- **Never read anywhere!**

Suggests dead code or incomplete feature.

### Code Smell B: Inconsistent Return Paths

```javascript
// Line 2279–2280
function openTestInst(lessonId) {
  const lesson = LESSONS.find(l => l.id === lessonId);
  if (!lesson) return;  // Early return, no error message to user
  // ...
  show('sc-inst');
}
```

If lesson not found, user sees no feedback. Should show error or log warning.

### Code Smell C: Global Event Binding Side Effects

```javascript
// Line 3035–3037
if (CONFIG.sheetsUrl && !window._teacherRefreshTimer) {
  window._teacherRefreshTimer = setInterval(refreshTeacher, 45000);
}
```

Uses global flag to prevent double-binding. Fragile; if `loadTeacher()` called twice, timer may be missed.

Better: Track timers in module state, clear on `doLogout()`.

### Code Smell D: Defensive Copies Not Actual Copies

```javascript
// Line 3020
else { reopenList = [...(data.reopens||[]), ...(data.rows||[]).filter(...)]; }
```

`...` spread creates shallow copy. If `reopenList` is modified, original array unchanged (OK here), but if nested objects were modified, mutation would leak.

---

## 10. REFERENCES & STANDARDS

- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **Web Content Accessibility (a11y) checklist:** Input validation, focus management, ARIA labels
- **JavaScript Error Handling Best Practices:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Error_handling
- **Single Responsibility Principle (SRP):** Each function should do one thing well
- **DRY (Don't Repeat Yourself):** Duplicate logic should be extracted to shared functions
- **OWASP XSS Prevention:** Template injection, innerHTML fallbacks
- **CSP (Content Security Policy):** Line 9 defines allowed external resources

---

**End of Review**

Generated: 2026-04-02 | File: /sessions/sharp-practical-lovelace/BEST_PRACTICES_REVIEW.md
