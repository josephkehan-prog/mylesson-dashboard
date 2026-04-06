# Testing & Documentation Quality Review
**Nexterra Student Portal — 3rd Grade NYS State Test Prep**

**File:** `/sessions/sharp-practical-lovelace/mnt/3rd Grade State Test/nexterra_student.html`
**Type:** Single-file vanilla JS HTML (4,234 lines, 187KB)
**Test Suite:** 39/39 Playwright tests passing
**Review Date:** April 2, 2026

---

## Executive Summary

The portal has **strong functional test coverage** with a well-architected 39-test Playwright suite that exercises all major screens and workflows. However, there are **significant gaps in edge-case testing, offline resilience, accessibility, and code documentation**. The test suite relies on brittle workarounds (mocking `safeLS`, bypassing login) that work but limit confidence in real-world scenarios.

**Testing Grade: B–** (solid workflow coverage, missing edge cases & error states)
**Documentation Grade: C+** (config documented, functions underexplained, no inline guidance for teachers/admins)

---

## TESTING COVERAGE ANALYSIS

### What IS Tested (Coverage Strengths)

1. **Login Flow** (6 tests)
   - Screen render, input presence, button presence
   - Empty submission validation
   - Bad class code error handling
   - Student name matching (exact, starts-with, includes, fuzzy via Fuse.js)
   - Roster validation per class

2. **Test List Screen** (2 tests)
   - Screen activation post-login
   - Lesson card rendering (count > 0)

3. **Instructions Screen** (2 tests)
   - Screen activation via `openTestInst()`
   - Begin Test button presence

4. **Test Screen Core** (8 tests)
   - Screen activation
   - Zoom buttons present
   - Line guide tool present
   - MC choice rendering (count ≥ 2)
   - Choice `aria-pressed` attribute (false initially, true after click)
   - 'sel' class applied on selection
   - Choice elimination tool activation & state
   - Eliminate mode toggle off

5. **Navigation & Tools** (6 tests)
   - Bookmark tool presence & toggle
   - Next button presence & functionality (advances question)
   - Previous button present
   - Question navigation (Q1 → Q2+)

6. **Review & Submission** (3 tests)
   - Review screen activation
   - Submit Test button present
   - Back to Test button present

7. **Done Screen** (3 tests)
   - Done screen activation
   - Done title element
   - Return to Tests button

8. **Teacher Features** (6 tests)
   - Teacher PIN modal opens
   - Modal has `role="dialog"`
   - Modal closes via Cancel or Escape
   - Teacher screen activation
   - Teacher table renders (empty rows)
   - Tab switching (grid, roster, analytics, assign, new)

9. **Console Health** (3 implicit tests)
   - No console errors
   - No console warnings (favicon noise filtered)
   - Screenshots of all major screens

---

### What IS NOT Tested (Coverage Gaps)

#### 1. **Error States & Offline Resilience** (HIGH RISK)
- **Offline mode:** Sheets fetch failure fallback never tested
  - `refreshTeacher()` catches errors and shows "⚠️ Sheets offline" but no test verifies this state
  - Teacher analytics/roster should show local cache when offline
  - Risk: If local cache is corrupted or empty, UI may break silently
- **Network timeouts:** `checkAndApplyReopens()` has 4-second timeout with `.catch()` but timeout path untested
- **localStorage quota exceeded:** `safeLS` wraps all operations in try-catch, but `catch` path never validated
  - Portal silently fails to save progress if quota exhausted
  - User could lose work without notification
- **Sheets URL misconfiguration:** If `CONFIG.sheetsUrl` is invalid or missing, behavior should degrade gracefully—not tested
- **POST to Sheets failure:** `postToSheets()` uses `.catch()` with only `console.warn()`, no user feedback

#### 2. **Accessibility Issues** (WCAG 2.1 AA Compliance Not Verified)
- **aria-pressed** is tested on initial state but not after dynamic updates in real flow
- **Keyboard navigation:** No test for Tab order, focus management, Escape key (partially tested for modal)
- **Screen reader:** No tests for alt-text on images, heading hierarchy, ARIA labels
  - Q images have `alt="Question N"` which is generic; could be more descriptive
  - Choice letters marked `aria-hidden="true"` (correct) but no test
  - Drawing canvas has `role="img" aria-label="..."` but no SR workflow validation
- **Color contrast:** No tests for button states, error message visibility
- **Mobile / responsive:** Tests use fixed 1280×800 viewport; no mobile layout testing
  - Portal uses flexbox/CSS Grid; likely responsive but untested
- **Focus visible:** `.t-hnav-btn:focus-visible` exists but focus ring never validated
- **Timeout warnings:** No prominent alert when time is up (test shows "time is up" on submit screen only)

#### 3. **Data Validation & Integrity** (MEDIUM RISK)
- **Answer persistence:** Progress saved to localStorage but never validated against what was actually answered
  - Could be corrupted JSON or missing fields
- **Score calculation:** `calcScore()` only counts `type === 'mc'` against `q.answer`; if answer is wrong type (int vs string), it fails silently
  - Test does not verify correct/incorrect scores
- **Drawing serialization:** Drawings stored as Data URL (JPEG), but no test of:
  - Large drawing data URL storage (could exceed quota)
  - Drawing corruption or format change
- **Reopen logic:** `checkAndApplyReopens()` filters by student name (case-insensitive lowercase) but roster matching uses case-insensitive includes/fuzzy; name normalization mismatch possible
  - Test sets `ST.student = 'Sarjo Touray'` but reopen lookup compares lowercase; untested edge case

#### 4. **Edge Cases in Question Rendering** (MEDIUM RISK)
- **No questions:** If lesson has `questions: []`, `renderQuestion()` returns early but no test
- **Missing image:** If `q.img` path is broken, `<img>` loads broken image icon but no alt-text fallback or retry
- **Missing stem:** Text-based MC questions require `q.stem`; if missing, blank question renders (no error)
- **Missing choices:** If `q.choices` is undefined or incomplete, loop may skip letters or throw
- **SR without credits:** Math SR questions have `credits` property; if missing, context shows "undefined"
- **Randomize feature:** `randomize: true` in lesson config is never used in code—dead feature or WIP?

#### 5. **State Management & Race Conditions** (MEDIUM RISK)
- **Concurrent edits:** No test for user answering Q5, then navigating back to Q1 and answering, then navigating forward—order of saves matters
- **Submit race:** If user submits while progress is saving (debounced at 2s), could POST score before latest answer saved
  - No test of rapid submit/cancel
- **Timer edge cases:**
  - Timer counts down but visual update (`updateTimerDisplay()`) happens only on tick
  - If 60-second test, last second might not render (test uses `page.wait_for_timeout(500)` hardcoded waits)
  - No test for "0 seconds left" state or auto-submit
- **Lesson change mid-test:** If `ST.lesson` changes while test is active (page reload), no guard

#### 6. **Drawing Feature Edge Cases** (LOW-MEDIUM RISK)
- **Canvas not supported:** Older browsers without canvas; feature silently fails
- **Large drawing:** JPEG at 0.85 quality may still exceed localStorage; no size validation
- **Undo/Redo:** `drawUndo()` and `drawRedo()` manipulate `DRW.history` and `DRW.future` but no test of:
  - Multiple undo/redo sequence
  - History state after save
  - Redo after save (should clear future)
- **Drawing on second open:** Test opens draw modal but doesn't verify existing drawing loads

#### 7. **Teacher Dashboard Edge Cases** (MEDIUM RISK)
- **Empty submissions:** If no one submitted, table should show "No matching submissions"—likely works but untested
- **Filter edge cases:** Class/lesson dropdowns might be empty if rows are empty
- **Column overflow:** Long student names or lesson titles; no text truncation test
- **Sort by date:** Assumes timestamp exists; if missing, sort may break
- **Analytics tab:** Never even rendered in test—unknown state

#### 8. **Timing & Flaky Patterns**
- **Hardcoded `page.wait_for_timeout()` calls:** 200ms, 300ms, 400ms, 500ms waits are brittle
  - If network is slow or DOM updates delayed, tests may fail
  - Better: `page.wait_for_selector()` or `page.locator(...).is_visible()`
- **`show()` timing:** `show()` changes classes synchronously but tests often wait after calling `show()` via evaluate
  - CSS transitions not included; if CSS uses `transition`, timing may be off
- **localStorage timing:** `safeLS` operations are sync but test doesn't verify data persists across navigation
- **Sheet fetch timing:** 4-second timeout in `checkAndApplyReopens()` is generous but tests mock success; timeout path never exercised

#### 9. **Configuration & Lesson Data** (LOW RISK)
- **Missing CONFIG.sheetsUrl:** Handled gracefully but untested
- **Circular references in LESSONS:** If question references non-existent lesson, behavior undefined
- **Empty student roster:** If `ROSTER[code]` is empty, name matching still works (user-provided name accepted)—OK but not tested
- **Pass thresholds:** Hard-coded at 70% ELA, 65% Math; if lesson has custom threshold, ignored (not possible in current config)

---

## DOCUMENTATION QUALITY ASSESSMENT

### Code Self-Documentation

#### Strengths
- **CSS is well-commented** with visual separators (`/* ═══ LOGIN ═══ */`)
- **Function names are descriptive:** `doLogin()`, `renderTestList()`, `submitTest()`, `calcScore()`
- **State object `ST` is clear:** `{ student, classCode, lesson, currentQ, answers, bookmarks, eliminated, fontSize, tools, timerSec, timerInterval, submitted, scores }`
- **Config constants are meaningful:** `PASS_ELA`, `PASS_MATH`, `LESSONS[]`, `CLASSES{}`, `ROSTER{}`

#### Weaknesses
- **Functions lack JSDoc comments:**
  ```javascript
  function doLogin() {  // ← No comment on logic
    const nameInput = ...
    // Inline comments explain only error cases, not happy path
  }
  ```

- **Complex algorithms unexplained:**
  - Name matching (exact → startsWith → includes → fuzzy Fuse) strategy not documented
  - Score calculation (`correctness` vs `srCount` vs `mcTotal`) not explained
  - Reopen merge logic in `checkAndApplyReopens()` is convoluted and un-commented
  - PIN hashing + verification flow (`_sha256`, `_TPIN_KEY`) lacks context

- **LESSONS[] schema is inline but not documented:**
  ```javascript
  const LESSONS = [
    {
      id: 'math-2024',
      title: '2024 Math...',
      subject: 'Math',
      tag: 'Math 2024',
      timeLimit: 60,
      randomize: false,  // ← Not used anywhere in code!
      questions: [
        { type: 'mc', img: 'img/...', answer: 'A', context: '...' },
        { type: 'sr', credits: 1, ... }
      ]
    }
  ];
  ```
  A teacher or substitute developer wouldn't know:
  - What `randomize` does (or that it's unused)
  - What `context` vs `domain` mean (varies by question type)
  - Why some questions have `img` and others don't
  - What happens if `answer` is missing

- **safeLS abstraction not explained:**
  ```javascript
  const safeLS = {
    get(key) { try { ... } catch(e) { console.warn(...); return null; } },
    // ← Why wrap localStorage? For quota handling? Privacy? Error resilience?
    // ← No comment on the trade-off (sync vs async, no guarantee of success)
  };
  ```

- **Teacher PIN system is cryptic:**
  ```javascript
  const _TPIN_KEY = 'nxt_tpin_h';
  async function _sha256(text) { ... }
  // ← Why SHA-256? Are we hashing before storing or storing plaintext?
  // ← Is the hash salted? (No—unsalted hash is visible in localStorage)
  // ← Vulnerable to rainbow tables, not documented
  ```

- **Drawing feature not explained:**
  ```javascript
  const DRW = { tool: 'pencil', drawing: false, history: [], future: [], qIdx: -1, ctx: null };
  // ← Magic object for global drawing state; why not a class?
  // ← How many undo/redo levels? (Unlimited—could be memory issue)
  ```

- **Missing comments on gotchas:**
  - localStorage can fail silently (quota, privacy mode, etc.) → tests should validate
  - Sheets API timeout (4s) may be too long for slow networks or too short for congestion
  - Drawing uses JPEG, not PNG—risk of quality loss not mentioned
  - Images for math questions must be pre-loaded; if missing, question breaks

### Documentation for Teachers/Admins

**Scenario:** A teacher wants to add a new lesson or modify CONFIG. The code provides:

1. **CONFIG object is clear:**
   ```javascript
   const CONFIG = {
     sheetsUrl: 'https://script.google.com/...'  // ← Good; URL is obvious
   };
   ```
   But missing:
   - What if sheetsUrl is empty? (Graceful fallback—works, but not documented)
   - What format does Sheets expect? (No schema documented)
   - How do reopen rows look? (Example: `{ student: 'Name', lesson: 'Title', type: 'reopen' }`)

2. **CLASSES and ROSTER are clear:**
   ```javascript
   const CLASSES = {
     "HAMILTON": { name: "Mr. Han – Hamilton", teacher: "Mr. Han" }
   };
   const ROSTER = {
     "HAMILTON": ["Sarjo Touray", "Eurys Polanco", ...]  // ← Names exactly as teachers spell them
   };
   ```
   Missing:
   - How to add a new class (is `isTeacher` field used? It's checked in `doLogin()` but never set)
   - How to add/remove students (edit roster manually? No API provided)
   - What if a student's name changes? (Fuzzy match may fail, breaking reopens)

3. **LESSONS structure is inline, complex, and not validated:**
   ```javascript
   const LESSONS = [
     {
       id: 'math-2024',         // ← What's the ID format? Just slug it?
       title: '2024 Math...',   // ← Must match Sheets exactly for reopens
       subject: 'Math',         // ← 'Math' or 'ELA'? Used for pass threshold
       tag: 'Math 2024',        // ← Only display purposes?
       timeLimit: 60,           // ← In minutes; shown but never enforced (timer just counts)
       randomize: false,        // ← Never used in code
       questions: [
         {
           type: 'mc',          // ← 'mc' or 'sr'
           img: 'img/...',      // ← Path to question image (optional for text-based)
           answer: 'A',         // ← For MC, answer letter. For SR, what?
           context: '...',      // ← For MC questions: standard/domain. For SR: credit value
           stem: '...',         // ← Question text (if no img)
           choices: [...],      // ← Array of choice strings (if no img)
           credits: 1,          // ← SR only; 1, 2, or 3
           draw: true,          // ← SR can have drawing option (undocumented)
           lines: 8             // ← Textarea rows (default 8)
         }
       ]
     }
   ];
   ```
   **A teacher trying to add a new lesson would struggle:**
   - Is `img` required or optional?
   - What are valid values for `type`?
   - Why do MC questions need `answer` and SR questions need `credits`?
   - Can SR have both text and drawing?
   - Is `randomize: false` a directive to implement, or a future feature?

4. **No README or setup guide:**
   - How to host this on GitHub Pages?
   - How to set up the Google Apps Script backend?
   - How to initialize teacher PIN for first use?
   - How to reset a student's progress?
   - How to view analytics?

---

## PLAYWRIGHT TEST SUITE ANALYSIS

### Workaround Sustainability

1. **`safeLS` mocking (Moderately Brittle)**
   ```javascript
   window._safeLS_mock = { get, set, remove, getJSON, setJSON };
   window.getSavedProgress = (id) => window._safeLS_mock.getJSON('nxt_prog_'+id, null);
   ```
   - **Issue:** Real `safeLS` is `const` in script scope, not accessible from `page.evaluate()`.
   - **Workaround:** Inject a mock and replace dependent functions.
   - **Risk:** If code calls `safeLS` directly (not via injected function), mock is bypassed.
     - Example: `submitTest()` calls `safeLS.setJSON('nxt_scores', ...)` directly → **untested**
     - Mock doesn't intercept; real localStorage is used in headless env.
   - **Verdict:** Works for current code but fragile if developer adds new `safeLS` calls.

2. **Login bypass (Moderately Acceptable)**
   ```javascript
   ST.student = 'Sarjo Touray';
   ST.classCode = 'HAMILTON';
   renderTestList();
   show('sc-tests');
   ```
   - **Issue:** `doLogin()` depends on Sheets fetch for roster validation; headless can't reach Sheets.
   - **Workaround:** Directly set `ST` and call screen-render functions.
   - **Risk:** If `doLogin()` adds new side-effects (e.g., fetch, session token, etc.), bypass won't trigger them.
   - **Verdict:** Acceptable but limits confidence in login flow. Real login never tested.

3. **Display visibility check (Reasonable)**
   ```javascript
   document.getElementById('teacher-panel-{tab}')?.style.display ?? 'missing'
   display != 'none'
   ```
   - **Issue:** Test checks `display !== 'none'` instead of `is_visible()`.
   - **Reason:** Panel may have `height: 0` initially (grid/flex hidden), so `display` is not set.
   - **Risk:** If panel is hidden by CSS (e.g., `visibility: hidden`, `opacity: 0`, `clip-path`), test won't catch it.
   - **Verdict:** Pragmatic but not robust. Should use `.is_visible()` with a fallback.

---

## TOP 5 HIGHEST-VALUE MISSING TEST CASES

### 1. **Offline / Sheets Failure Fallback** (P0 – Critical)
**Why:** Portal gracefully shows "⚠️ Sheets offline" but this path is never tested. Teachers relying on that UI are untested.

**Pseudocode:**
```python
def test_sheets_offline_fallback():
    # Intercept fetch to CONFIG.sheetsUrl and return 500 error
    page.route(lambda r: 'sheets.googleapis.com' in r.url,
               lambda r: r.abort())

    # Simulate teacher login
    page.evaluate("ST.student='Teacher'; ST.classCode='HAMILTON'; loadTeacher();")
    page.wait_for_timeout(5000)  # Wait for fetch timeout + fallback

    # Verify offline message appears
    assert 'Sheets offline' in page.locator('#teacher-last-refresh').text_content()

    # Verify table renders from local cache (even if empty)
    table = page.locator('table tbody').is_visible()
    assert table, "Table should show local cache when offline"
```

---

### 2. **localStorage Quota Exceeded** (P1 – High)
**Why:** Portal saves progress and scores but silent failure if quota is exceeded. User could lose work.

**Pseudocode:**
```python
def test_localstorage_quota_exceeded():
    # Setup: fill localStorage to near-quota
    for i in range(100):
        page.evaluate(f"""
            try {{ localStorage.setItem('junk_{i}', 'x' * 100000); }}
            catch (e) {{}}
        """)

    # Login and start test
    page.evaluate("ST.student='Sarjo Touray'; ST.classCode='HAMILTON'; renderTestList(); show('sc-tests');")
    page.evaluate("openTestInst('math-practice-mc'); page.wait_for_timeout(200); beginTest();")

    # Answer a question and wait for autosave
    page.locator('.tq-choice').first.click()
    page.wait_for_timeout(2500)  # Autosave debounce (2s) + buffer

    # Verify answer is saved (or error is shown to user)
    saved = page.evaluate("() => getSavedProgress('math-practice-mc')")
    # Should either:
    # (A) Show user error: "Failed to save. Please try again."
    # (B) Have a fallback storage mechanism
    # Currently: silent failure (unacceptable)
    assert saved or 'Failed to save' in page.content(), "Must inform user of save failure"
```

---

### 3. **Answer Submission Race Condition** (P1 – High)
**Why:** Autosave (debounced 2s) may not complete before submit. Score could be calculated on stale answers.

**Pseudocode:**
```python
def test_submit_during_autosave_race():
    # Setup: login and open test
    page.evaluate("""
        ST.student='Sarjo Touray'; ST.classCode='HAMILTON';
        renderTestList(); show('sc-tests');
        openTestInst('math-practice-mc');
    """)
    page.wait_for_timeout(400)
    page.locator('button.btn-begin').click()
    page.wait_for_timeout(500)

    # Answer first question
    page.locator('.tq-choice').nth(0).click()
    page.wait_for_timeout(100)  # Don't wait for autosave

    # Immediately click Next (or Review/Submit)
    page.locator('#t-btn-next').click()
    page.wait_for_timeout(100)

    # Immediately answer next question and submit
    page.locator('.tq-choice').nth(1).click()
    page.evaluate("() => show('sc-review')")
    page.wait_for_timeout(200)
    page.locator('button.btn-rev-submit').click()
    page.wait_for_timeout(500)

    # Verify both answers are recorded in score
    score = page.evaluate("() => window._lastScore")
    assert score.correct >= 1, f"Expected ≥1 correct, got {score.correct}"
```

---

### 4. **Accessibility Keyboard & Screen Reader** (P1 – High)
**Why:** Portal has `aria-*` attributes but keyboard navigation and SR testing is completely absent.

**Pseudocode:**
```python
def test_accessibility_keyboard_navigation():
    # Setup: login
    page.evaluate("""
        ST.student='Sarjo Touray'; ST.classCode='HAMILTON';
        renderTestList(); show('sc-tests');
        openTestInst('math-practice-mc');
    """)
    page.wait_for_timeout(400)
    page.locator('button.btn-begin').click()
    page.wait_for_timeout(500)

    # Test Tab navigation from question stem to choices
    page.locator('.tq-stem').focus()  # or use Tab key
    page.keyboard.press('Tab')
    page.wait_for_timeout(100)
    focused = page.evaluate("() => document.activeElement.className")
    assert 'tq-choice' in focused, "Should focus first choice after Tab"

    # Test Space/Enter to select choice
    page.keyboard.press('Space')
    page.wait_for_timeout(100)
    selected = page.evaluate("() => document.activeElement.getAttribute('aria-pressed')")
    assert selected == 'true', "Space should select focused choice"

    # Test Escape to close drawing modal
    page.locator('button.tq-draw-btn').focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(300)
    modal_open = page.locator('#draw-modal').is_visible()
    assert modal_open, "Drawing modal should open"

    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    modal_open = page.locator('#draw-modal').is_visible()
    assert not modal_open, "Escape should close drawing modal"

def test_accessibility_screen_reader():
    # Use axe-core or manual inspection
    page.evaluate("""
        await import('https://axe-core.org/axe.min.js');
        const results = await axe.run(document.querySelector('#sc-test'));
        window._a11yResults = results;
    """)
    page.wait_for_timeout(500)
    results = page.evaluate("() => window._a11yResults")
    violations = results['violations']
    assert len(violations) == 0, f"Axe violations: {violations}"
```

---

### 5. **Data Persistence & Progress Recovery** (P2 – Medium)
**Why:** Portal autosaves progress but recovery from manual browser close is never tested.

**Pseudocode:**
```python
def test_progress_recovery_after_page_reload():
    # Setup: login and open test
    page.goto(HTML)
    page.wait_for_load_state("networkidle")

    page.evaluate("""
        ST.student='Sarjo Touray'; ST.classCode='HAMILTON';
        renderTestList(); show('sc-tests');
        openTestInst('math-practice-mc');
    """)
    page.wait_for_timeout(400)
    page.locator('button.btn-begin').click()
    page.wait_for_timeout(500)

    # Answer Q1 and Q2
    page.locator('.tq-choice').nth(0).click()  # Q1: Choice A
    page.wait_for_timeout(100)
    page.locator('#t-btn-next').click()
    page.wait_for_timeout(300)

    page.locator('.tq-choice').nth(1).click()  # Q2: Choice B
    page.wait_for_timeout(2500)  # Wait for autosave (2s + buffer)

    # Verify answers are in localStorage
    saved = page.evaluate("() => localStorage.getItem('nxt_prog_math-practice-mc')")
    assert saved, "Progress should be saved to localStorage"
    assert 'Q1' in saved or 'answers' in saved, "Saved progress should contain answers"

    # Reload page (simulates browser close + reopen)
    page.reload()
    page.wait_for_load_state("networkidle")

    # Login again (in real scenario, teacher would re-login)
    page.evaluate("""
        ST.student='Sarjo Touray'; ST.classCode='HAMILTON';
        renderTestList(); show('sc-tests');
    """)
    page.wait_for_timeout(400)

    # Open same lesson; should resume at Q2 or show resume button
    page.locator(".test-card, [class*='tc-']").filter(has_text='math-practice').first.click()
    page.wait_for_timeout(400)

    # Check for resume button or auto-resume
    resume_btn = page.locator('button:has-text("Resume")').is_visible()
    assert resume_btn, "Should offer Resume option for in-progress test"

    page.locator('button.btn-resume').click()
    page.wait_for_timeout(500)

    # Verify we're at Q2 (not Q1) and previous answers are loaded
    current_q = page.evaluate("() => ST.currentQ + 1")
    assert current_q == 2, f"Should resume at Q2, but at Q{current_q}"

    answer = page.evaluate("() => ST.answers[1]")
    assert answer == 'B', f"Q2 answer should be 'B', got {answer}"
```

---

## RISK ASSESSMENT

| Category | Risk | Impact | Mitigation |
|----------|------|--------|-----------|
| **Offline Fallback** | Medium | Teacher dashboard shows stale/empty data | Add test for Sheets fetch failure |
| **localStorage Quota** | Medium–High | User loses work silently | Add quota check + user-facing error |
| **Accessibility** | High | Excludes students with disabilities | Run axe-core; test keyboard nav |
| **Answer Race Condition** | Medium | Score may not reflect all answers | Add mutex/queue or test race scenario |
| **Data Corruption** | Low–Medium | Corrupted JSON in localStorage | Add validation in `getSavedProgress()` |
| **Network Timeout** | Low | Teacher dashboard hangs briefly | Add loading spinner + timeout message |
| **Drawing Memory** | Low | Large drawings could exceed quota | Implement drawing size limit |
| **Missing Lesson Data** | Low | Empty stem/choices → broken question | Add validation on lesson load |

---

## DOCUMENTATION RECOMMENDATIONS

### High-Priority Improvements

1. **Add JSDoc to all functions:**
   ```javascript
   /**
    * Validates and processes student login.
    * @param {string} nameInput - Student name (fuzzy-matched against roster)
    * @param {string} code - Class code (HAMILTON, HOLYCROSS, etc.)
    * @returns {void} Sets ST.student, ST.classCode; shows test list or error
    *
    * Fuzzy matching: tries exact → startsWith → includes → Fuse.js (0.4 threshold)
    * If no match found, shows "Name not found" error.
    */
   function doLogin() { ... }
   ```

2. **Document LESSONS schema with TypeScript-style JSDoc:**
   ```javascript
   /**
    * @typedef {Object} Question
    * @property {('mc'|'sr')} type - Question type (multiple choice or short response)
    * @property {string} [img] - Path to question image (math questions); if present, no stem/choices
    * @property {('A'|'B'|'C'|'D'|'E')} answer - Correct answer (MC only)
    * @property {number} credits - Point value (SR only; 1, 2, or 3)
    * @property {string} stem - Question text (if no img)
    * @property {string[]} choices - Answer choices (if no img)
    * @property {string} context - Standard/domain (MC) or credit value (SR)
    * @property {boolean} [draw] - Allow drawing tool (SR only)
    * @property {number} [lines] - Textarea height in rows (default 8)
    */
   ```

3. **Add README:**
   ```markdown
   # Nexterra Student Portal

   ## Setup
   1. Host HTML on GitHub Pages
   2. Create Google Apps Script backend (see below)
   3. Update CONFIG.sheetsUrl
   4. Add CLASSES and ROSTER
   5. Create LESSONS with questions

   ## Google Apps Script
   [Example Apps Script that accepts POST from portal and logs to Sheet]

   ## Adding a Lesson
   1. Export test questions as images (PDF → image)
   2. Add lesson object to LESSONS[]
   3. Fill in all required fields (see LESSONS schema above)

   ## Troubleshooting
   - "Sheets offline"? Check CONFIG.sheetsUrl and network
   - Progress not saving? Check localStorage quota (Settings → Apps → Storage)
   - PIN won't work? Clear localStorage and restart browser
   ```

4. **Document safeLS and offline behavior:**
   ```javascript
   /**
    * Wraps localStorage with error handling.
    * All operations are synchronous and fail silently on quota exceeded or privacy mode.
    *
    * Usage: safeLS.get(key) → value or null (never throws)
    *        safeLS.setJSON(key, obj) → true or false (check return value!)
    *
    * Errors are logged to console (prefix: [safeLS]) but not shown to user.
    * Consider showing "Failed to save progress" message if setJSON() returns false.
    */
   const safeLS = { ... };
   ```

5. **Document PIN security limitations:**
   ```javascript
   /**
    * Teacher PIN system (SHA-256 hashed in localStorage).
    *
    * Security model:
    * - PIN is hashed once on setup and stored in localStorage
    * - On verify, entered PIN is hashed and compared (constant-time comparison would be better)
    * - Hash is UNSALTED (vulnerable to rainbow tables, but acceptable for simple PIN)
    * - Stored in localStorage, visible to browser dev tools (not suitable for high-security apps)
    *
    * Better: Use backend authentication with secure cookie; PIN only as fallback.
    */
   ```

---

## SUMMARY TABLE

| Dimension | Grade | Notes |
|-----------|-------|-------|
| **Workflow Coverage** | A– | All major screens + tools tested |
| **Edge Cases** | C+ | Missing: offline, quota, races, a11y, recovery |
| **Error Handling** | C | Graceful degradation but untested |
| **Accessibility** | D+ | aria-* present but keyboard/SR not tested |
| **Test Stability** | B | Hardcoded waits; could use better sync strategies |
| **Code Documentation** | C+ | Config clear, functions lack JSDoc, schema undocumented |
| **Teacher/Admin Docs** | C | No README, no lesson template, no troubleshooting guide |
| **Overall Testing** | B– | **Strong functional coverage; significant edge-case gaps** |
| **Overall Docs** | C+ | **Config obvious; deep implementation logic unexplained** |

---

## NEXT STEPS (Priority Order)

### P0 (Critical)
1. Add test for offline/Sheets failure fallback
2. Add localStorage quota error handling + user message
3. Document PIN security limitations
4. Add README with setup & lesson template

### P1 (High)
1. Add race condition test (submit during autosave)
2. Run axe-core for accessibility audit
3. Add keyboard navigation test
4. Add progress recovery test (reload scenario)

### P2 (Medium)
1. Add JSDoc to all functions
2. Document LESSONS schema
3. Add drawing size limit + test
4. Test real login flow (not just bypass)

### P3 (Low)
1. Convert hardcoded waits to dynamic selectors
2. Validate lesson data on load
3. Add analytics tab test
4. Document CONFIG options
