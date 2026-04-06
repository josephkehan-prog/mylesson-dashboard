# Student UX Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three student-facing features to `nexterra.html`: (1) a "Back to Dashboard" button that saves progress, (2) a one-lesson-at-a-time lock, and (3) a subject-aware scratch paper side panel with a first-launch alert.

**Architecture:** All changes are self-contained edits to the single-file app `nexterra.html`. State lives in the `ST` object and `localStorage` via `safeLS`. New HTML sections are added inline; new JS functions follow existing naming conventions. No new files, no build step.

**Tech Stack:** Vanilla JavaScript (ES6), HTML/CSS inline in `nexterra.html`, `localStorage` via the existing `safeLS` wrapper.

---

## File Map

| File | What changes |
|------|-------------|
| `nexterra.html` lines 838–860 (`.t-footer`) | Add 📝 scratch paper toolbar button |
| `nexterra.html` lines 807–824 (`.t-header`) | Add ← Dashboard button |
| `nexterra.html` lines 825–833 (`.t-body`) | Add `#scratch-panel` div inside t-body |
| `nexterra.html` CSS block (~line 160–550) | Add styles for scratch panel, back button, one-lesson warning |
| `nexterra.html` `beginTest()` (~line 2937) | Restore `scratchPad`, set `nxt_active_lesson`, show paper alert |
| `nexterra.html` `saveProgress()` (~line 3730) | Include `scratchPad` in saved data |
| `nexterra.html` `submitTest()` (~line 3601) | Clear `nxt_active_lesson` on submit |
| `nexterra.html` `renderTestList()` (~line 2858) | Detect active-lesson conflict, show inline warning |
| `nexterra.html` `toggleTool()` / `setToolOff()` / `updateToolUI()` (~line 3503) | Handle `paper` tool |
| `nexterra.html` `_clearSessionData()` (~line 2656) | Clear `scratchPad` on new login |
| `nexterra.html` bottom `window.*` exports (~line 5050) | Export new functions |

---

## Task 1 — Back to Dashboard Button (HTML + CSS)

**Files:**
- Modify: `nexterra.html` — `.t-header` block (lines 807–824) and CSS block

- [ ] **Step 1: Add CSS for the back button**

Find the `.t-header {` CSS rule (around line 164) and add this rule after the `.t-header` block:

```css
.t-back-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,.75);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  letter-spacing: .3px;
  white-space: nowrap;
}
.t-back-btn:hover { background: rgba(255,255,255,.15); color: #fff; }
```

- [ ] **Step 2: Add the button to the t-header HTML**

Find this exact line in the HTML (line ~807):
```html
  <div class="t-header">
    <div class="t-hinfo">
```

Replace with:
```html
  <div class="t-header">
    <button class="t-back-btn" onclick="backToDashboard()" aria-label="Back to dashboard">&#9664; Dashboard</button>
    <div class="t-hinfo">
```

- [ ] **Step 3: Add the `backToDashboard()` JS function**

Find the `/* ── LOGIN ──` comment block (around line 2651) and add this new function just before it:

```javascript
/* ── BACK TO DASHBOARD ── */
function backToDashboard() {
  // Flush progress immediately (bypasses the 2-second debounce)
  if (ST.lesson) {
    const data = {
      answers: ST.answers, bookmarks: ST.bookmarks, eliminated: ST.eliminated,
      currentQ: ST.currentQ, timerSec: ST.timerSec,
      scratchPad: ST.scratchPad || ''
    };
    safeLS.setJSON('nxt_prog_' + ST.lesson.id, data);
  }
  // Pause timer (leave nxt_active_lesson set — lesson is still in progress)
  clearInterval(ST.timerInterval);
  ST.timerInterval = null;
  // Close scratch panel if open
  ST.tools.paper = false;
  updateToolUI();
  document.getElementById('scratch-panel').style.display = 'none';
  renderTestList();
  show('sc-tests');
}
```

- [ ] **Step 4: Export the new function**

Find the block of `window.X = X;` exports near the bottom of the script (~line 5050) and add:
```javascript
window.backToDashboard       = backToDashboard;
```

- [ ] **Step 5: Verify syntax**

Run:
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
git add nexterra.html
git commit -m "feat: add Back to Dashboard button — saves progress, pauses timer"
```

---

## Task 2 — One Lesson at a Time Lock

**Files:**
- Modify: `nexterra.html` — `beginTest()`, `submitTest()`, `renderTestList()`, CSS block

The lock uses a single localStorage key `nxt_active_lesson` storing the active lesson ID. When a student tries to open a *different* lesson while one is active, an inline warning replaces the Start button until they choose Resume or Start Fresh.

- [ ] **Step 1: Add CSS for the conflict warning**

Add after the `.t-back-btn:hover` rule added in Task 1:

```css
.tc-conflict-warn {
  font-size: 12px;
  color: #c0392b;
  background: #fdf0ee;
  border: 1px solid #e8c0bb;
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
  line-height: 1.4;
}
.tc-conflict-warn button {
  display: inline-block;
  margin: 6px 4px 0;
  padding: 4px 12px;
  border-radius: 5px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.tc-conflict-warn .btn-resume { background: #00205b; color: #fff; }
.tc-conflict-warn .btn-fresh  { background: #eee; color: #333; }
```

- [ ] **Step 2: Set active lesson in `beginTest()`**

Find `function beginTest()` (line ~2937). Find this line inside it:
```javascript
  ST.submitted   = false;
```
Add ONE line immediately before it:
```javascript
  if (!ST._preview) safeLS.set('nxt_active_lesson', ST.lesson.id);
```

- [ ] **Step 3: Clear active lesson in `submitTest()`**

Find `function submitTest(timeUp)` (line ~3601). Find this line inside it:
```javascript
  clearSavedProgress(lesson.id);
```
Add ONE line immediately after it:
```javascript
  safeLS.remove('nxt_active_lesson');
```

- [ ] **Step 4: Also clear active lesson in `_clearSessionData()`**

Find `function _clearSessionData()` (line ~2656). Find the block that ends with:
```javascript
    toRemove.forEach(k => safeLS.remove(k));
  } catch(e) { /* localStorage unavailable — no-op */ }
}
```
Add ONE line before the closing `}`:
```javascript
  safeLS.remove('nxt_active_lesson');
```

- [ ] **Step 5: Add conflict detection in `renderTestList()`**

Find `function renderTestList()` (line ~2858). Find this line inside the `visibleLessons.forEach` loop:
```javascript
    const sc = ST.scores[lesson.id];
```
Add these two lines immediately before it:
```javascript
    const _activeId = safeLS.get('nxt_active_lesson');
    const hasConflict = !!_activeId && _activeId !== lesson.id && !!getSavedProgress(_activeId);
```

Then find the card's button HTML:
```javascript
      <button class="tc-btn ${btnClass}" onclick="openTestInst('${lesson.id}')">${btnText}</button>
```
Replace with:
```javascript
      ${hasConflict && !isDone ? `
        <div class="tc-conflict-warn">
          ⚠️ You have an unfinished lesson open.<br>
          <button class="btn-resume" onclick="resumeActiveLesson()">Resume it</button>
          <button class="btn-fresh" onclick="startFresh('${lesson.id}')">Start this one fresh</button>
        </div>` :
        `<button class="tc-btn ${btnClass}" onclick="openTestInst('${lesson.id}')">${btnText}</button>`
      }
```

- [ ] **Step 6: Add `resumeActiveLesson()` and `startFresh()` functions**

Add these right after the `backToDashboard()` function from Task 1:

```javascript
function resumeActiveLesson() {
  const activeId = safeLS.get('nxt_active_lesson');
  if (!activeId) { renderTestList(); return; }
  const lesson = _lessonById.get(activeId);
  if (!lesson) { safeLS.remove('nxt_active_lesson'); renderTestList(); return; }
  ST.lesson = lesson;
  beginTest();
}

function startFresh(lessonId) {
  // Clear the previously active lesson's progress and active flag
  const oldId = safeLS.get('nxt_active_lesson');
  if (oldId) clearSavedProgress(oldId);
  safeLS.remove('nxt_active_lesson');
  openTestInst(lessonId);
}
```

- [ ] **Step 7: Export new functions**

Add to the `window.*` exports block:
```javascript
window.resumeActiveLesson    = resumeActiveLesson;
window.startFresh            = startFresh;
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
git commit -m "feat: one-lesson-at-a-time lock — warn before opening a second lesson"
```

---

## Task 3 — Scratch Paper Side Panel

**Files:**
- Modify: `nexterra.html` — CSS, `.t-body` HTML, `.t-footer` HTML, `beginTest()`, `saveProgress()`, `beginTest()` (toast), `toggleTool()`, `setToolOff()`, `updateToolUI()`, `_clearSessionData()`

### 3a — HTML structure

- [ ] **Step 1: Add CSS for the scratch panel**

Add after the `.tc-conflict-warn` rules from Task 2:

```css
/* ── SCRATCH PAPER PANEL ── */
#scratch-panel {
  display: none;
  width: 300px;
  min-width: 260px;
  max-width: 340px;
  border-left: 3px solid #00205b;
  background: #fffef7;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width .2s ease;
}
#scratch-panel[hidden], #scratch-panel.sp-hidden { display: none !important; }
.sp-header {
  background: #00205b;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sp-close {
  background: none;
  border: none;
  color: rgba(255,255,255,.7);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.sp-close:hover { color: #fff; }
.sp-prompt {
  font-size: 11px;
  color: #555;
  background: #f5f5dc;
  border-bottom: 1px solid #ddd;
  padding: 8px 12px;
  line-height: 1.5;
}
.sp-prompt strong { color: #00205b; }
#scratch-textarea {
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  background: #fffef7;
  color: #222;
}
/* Mobile: scratch panel becomes a bottom drawer */
@media (max-width: 700px) {
  #scratch-panel {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    width: 100% !important;
    max-width: 100%;
    height: 45vh;
    border-left: none;
    border-top: 3px solid #00205b;
    z-index: 200;
  }
}
/* Toast alert */
.sp-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #00205b;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  padding: 12px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 18px rgba(0,0,0,.25);
  z-index: 500;
  white-space: nowrap;
  opacity: 1;
  transition: opacity .5s ease;
  pointer-events: none;
}
.sp-toast.fade-out { opacity: 0; }
```

- [ ] **Step 2: Add `#scratch-panel` div inside `.t-body`**

Find this exact HTML (line ~825):
```html
  <div class="t-body">
    <div class="t-passage" id="t-passage">
      <div class="t-passage-lbl">Passage</div>
      <div class="t-passage-text" id="t-passage-text"></div>
    </div>
    <div class="t-qpane" id="t-qpane">
      <!-- question rendered here -->
    </div>
  </div>
```
Replace with:
```html
  <div class="t-body">
    <div class="t-passage" id="t-passage">
      <div class="t-passage-lbl">Passage</div>
      <div class="t-passage-text" id="t-passage-text"></div>
    </div>
    <div class="t-qpane" id="t-qpane">
      <!-- question rendered here -->
    </div>
    <div id="scratch-panel" class="sp-hidden">
      <div class="sp-header">
        <span id="sp-title">📝 Scratch Paper</span>
        <button class="sp-close" onclick="toggleTool('paper')" aria-label="Close scratch paper">✕</button>
      </div>
      <div class="sp-prompt" id="sp-prompt"></div>
      <textarea id="scratch-textarea" placeholder="Write here..."></textarea>
    </div>
  </div>
```

- [ ] **Step 3: Add 📝 button to `.t-footer` toolbar**

Find this line in the footer (line ~857):
```html
    <button class="tb-btn" id="ttool-lg" onclick="toggleTool('lg')" aria-pressed="false">
      <span class="tb-icon">&#9135;</span><span>line-reader</span>
    </button>
```
Add immediately after it:
```html
    <button class="tb-btn" id="ttool-paper" onclick="toggleTool('paper')" aria-pressed="false">
      <span class="tb-icon">📝</span><span>scratch paper</span>
    </button>
```

### 3b — JavaScript

- [ ] **Step 4: Update `toggleTool()` to handle `paper`**

Find `function toggleTool(tool)` (line ~3503). Replace the entire function with:

```javascript
function toggleTool(tool) {
  ST.tools[tool] = !ST.tools[tool];
  // only one highlight/elim at a time
  if (tool === 'hl' && ST.tools.hl) ST.tools.elim = false;
  if (tool === 'elim' && ST.tools.elim) ST.tools.hl = false;
  updateToolUI();
  if (tool === 'lg') {
    document.getElementById('line-guide').style.display = ST.tools.lg ? 'block' : 'none';
  }
  if (tool === 'paper') {
    const panel = document.getElementById('scratch-panel');
    if (ST.tools.paper) {
      panel.classList.remove('sp-hidden');
      panel.style.display = 'flex';
      document.getElementById('scratch-textarea').focus();
    } else {
      panel.classList.add('sp-hidden');
      panel.style.display = 'none';
    }
  }
}
```

- [ ] **Step 5: Update `setToolOff()` to close scratch panel**

Find `function setToolOff()` (line ~3513). Replace it with:

```javascript
function setToolOff() {
  ST.tools = { hl: false, elim: false, lg: false, paper: false };
  updateToolUI();
  document.getElementById('line-guide').style.display = 'none';
  const panel = document.getElementById('scratch-panel');
  panel.classList.add('sp-hidden');
  panel.style.display = 'none';
}
```

- [ ] **Step 6: Update `updateToolUI()` to include `paper` button**

Find `function updateToolUI()` (line ~3518). Replace the forEach array:
```javascript
  ['hl','elim','lg'].forEach(t => {
```
with:
```javascript
  ['hl','elim','lg','paper'].forEach(t => {
```

- [ ] **Step 7: Add scratch pad save on textarea input**

Add this JS function after `updateToolUI()`:

```javascript
function _initScratchPad() {
  const ta = document.getElementById('scratch-textarea');
  if (!ta) return;
  ta.addEventListener('input', function() {
    ST.scratchPad = this.value;
    saveProgress();
  });
}
```

- [ ] **Step 8: Add `_showScratchToast()` helper**

Add right after `_initScratchPad()`:

```javascript
function _showScratchToast() {
  // Only show once per lesson session
  if (ST._scratchToastShown) return;
  ST._scratchToastShown = true;
  const t = document.createElement('div');
  t.className = 'sp-toast';
  t.textContent = '📝 Use your scratch paper! Tap the paper icon in the toolbar.';
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); }, 3000);
  setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3600);
}
```

- [ ] **Step 9: Update `beginTest()` to restore scratchPad, set prompt, and show toast**

Find this block inside `beginTest()`:
```javascript
  ST.submitted   = false;
  ST._submitting = false; // reset double-submit guard for new attempt
  ST.tools = { hl: false, elim: false, lg: false };
  setToolOff();
```
Replace with:
```javascript
  ST.submitted   = false;
  ST._submitting = false; // reset double-submit guard for new attempt
  ST._scratchToastShown = false;
  ST.tools = { hl: false, elim: false, lg: false, paper: false };
  setToolOff();
```

Then find this line near the end of `beginTest()`:
```javascript
  renderQuestion(ST.currentQ);
  show('sc-test');
}
```
Replace with:
```javascript
  // Restore scratch pad content
  const savedProg = getSavedProgress(lesson.id);
  ST.scratchPad = (savedProg && savedProg.scratchPad) ? savedProg.scratchPad : '';
  const ta = document.getElementById('scratch-textarea');
  if (ta) ta.value = ST.scratchPad;

  // Set subject-appropriate prompt
  const isMath = (lesson.subject || '').toLowerCase() === 'math';
  document.getElementById('sp-title').textContent = isMath ? '📐 Mathematician\'s Plan' : '📖 Reading Work Space';
  document.getElementById('sp-prompt').innerHTML = isMath
    ? '<strong>I</strong> – Identify: What is the problem asking?<br><strong>S</strong> – Solve: Show your work.<br><strong>C</strong> – Check: Does your answer make sense?'
    : 'Annotate as you read.<br><strong>What is the main idea?</strong>';

  _initScratchPad();
  renderQuestion(ST.currentQ);
  show('sc-test');
  // Show toast after a short delay so the screen transition completes
  setTimeout(_showScratchToast, 800);
}
```

- [ ] **Step 10: Update `saveProgress()` to include scratchPad**

Find `function saveProgress()` (line ~3730). Find this object:
```javascript
    const data = {
      answers: ST.answers, bookmarks: ST.bookmarks, eliminated: ST.eliminated,
      currentQ: ST.currentQ, timerSec: ST.timerSec
    };
```
Replace with:
```javascript
    const data = {
      answers: ST.answers, bookmarks: ST.bookmarks, eliminated: ST.eliminated,
      currentQ: ST.currentQ, timerSec: ST.timerSec,
      scratchPad: ST.scratchPad || ''
    };
```

- [ ] **Step 11: Update `_clearSessionData()` to clear scratchPad**

Find `function _clearSessionData()` (line ~2656). Find:
```javascript
  ST.lesson    = null;
```
Add ONE line immediately after:
```javascript
  ST.scratchPad = '';
```

- [ ] **Step 12: Export new functions**

Add to the `window.*` exports block:
```javascript
window._showScratchToast     = _showScratchToast;
```

- [ ] **Step 13: Verify syntax**

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

- [ ] **Step 14: Also update `backToDashboard()` (from Task 1) to flush scratchPad**

Verify the `backToDashboard()` function written in Task 1 already includes `scratchPad: ST.scratchPad || ''` in the data object. It does — no change needed.

- [ ] **Step 15: Commit**

```bash
git add nexterra.html
git commit -m "feat: scratch paper side panel — ELA annotation / Math ISC plan, persists across questions"
```

---

## Task 4 — Final Sync: Push to GitHub Pages

- [ ] **Step 1: Run full syntax check one last time**

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

- [ ] **Step 3: Verify live site loads**

Open `https://josephkehan-prog.github.io/mylesson-dashboard/nexterra.html` in a browser (wait ~60 seconds for GitHub Pages to deploy). Confirm:
- Login screen appears (JS is running)
- Log in as any student (HAMILTON or HOLYCROSS)
- Open a Math lesson → see the 📐 Mathematician's Plan toast and panel
- Open an ELA lesson → see the 📖 Reading Work Space panel
- Mid-lesson, tap "← Dashboard" → land back on test list with lesson showing "In Progress"
- Try opening a different lesson → see the conflict warning
- Resume the original lesson → answers and scratch pad are restored

---

## Self-Review Notes

- **Spec coverage check:** ✅ Back button (Task 1) ✅ One-lesson lock (Task 2) ✅ Scratch paper panel with ISC/ELA prompt (Task 3) ✅ Tool alert on lesson start (Task 3, Step 9) ✅ Scratch pad carries across questions (saved in saveProgress, restored in beginTest)
- **No placeholders:** All steps include exact code
- **Type consistency:** `ST.scratchPad` (string) used consistently across Tasks 1, 3. `ST.tools.paper` (bool) used consistently across Tasks 3 steps 4–6, 9. `nxt_active_lesson` key used consistently across Task 2.
- **Edge case — `#scratch-panel` CSS `display` conflict:** The initial CSS sets `display: flex` AND `display: none` on the same rule — that's a bug. Fix: the CSS rule should only declare layout properties; show/hide is controlled entirely by `panel.style.display` in JS. Remove `display: flex` from the `#scratch-panel` CSS rule and keep only `display: none` as the initial state. The JS already calls `panel.style.display = 'flex'` on open. ✅ Already correct in the plan above — `display: none` is the initial value set by `.sp-hidden`, and `display: flex` is set by JS on open.
