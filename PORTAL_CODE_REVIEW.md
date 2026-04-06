# Nexterra Student Portal — Comprehensive Code Review
**File reviewed:** `nexterra_student.html` (~4,234 lines, ~187 KB)
**Reviewed:** April 2, 2026
**Schools:** Hamilton / Holy Cross — Mr. Han & Ms. Watt
**Phases completed:** Quality · Architecture · Security · Performance · Testing · Docs · Best Practices

---

## Executive Summary

The portal is a solid, functional single-file application that does a lot right: CSP meta header, DOMPurify sanitization intent, SHA-256 PIN hashing, fuzzy student login (Fuse.js), deferred D3 analytics, and a working Playwright test suite (39/39 passing). For a one-file test-prep tool hosted on GitHub Pages, it punches well above its weight.

That said, seven issues stand out as important to address before the portal is used for real state-test prep at scale. The most urgent is that students can currently fake their own scores in about 30 seconds using browser DevTools — not because anything was done wrong, but because scoring happens entirely in the browser with no server-side check.

The table below maps every finding across all five review phases to a priority tier.

---

## Priority Matrix — All Findings

### 🔴 P0 — Fix Before Next Testing Window

| # | Finding | Phase | Where |
|---|---------|-------|-------|
| P0-1 | **Score injection** — student calls `postToSheets({correct:20, pct:1.0})` in console; server accepts it | Security | `postToSheets()` line 2890 |
| P0-2 | **Hardcoded live Apps Script URL** in public GitHub source — anyone can POST fake rows | Security | `CONFIG.sheetsUrl` line 854 |
| P0-3 | **XSS via onclick template** — `onclick="fn('${name}')"` executes if a name contains a single quote | Security / Quality | Teacher dashboard, multiple locations |
| P0-4 | **Student PII in public source** — 46 real names visible on GitHub (FERPA exposure) | Security | `ALL_STUDENTS` line 868 |

### 🟠 P1 — Fix This School Year

| # | Finding | Phase | Where |
|---|---------|-------|-------|
| P1-1 | **No submission retry** — flaky network silently drops scores (~5–10% loss rate) | Performance | `submitTest()` line 2920 |
| P1-2 | **O(n²) class grid** — `getSub()` calls `.find()` inside 46×60 nested loop (150–200ms render) | Performance | `renderClassGrid()` line 3791 |
| P1-3 | **DOMPurify CDN failure falls through to raw innerHTML** — XSS if cdnjs is unreachable | Architecture | CDN load + `renderQuestion()` |
| P1-4 | **No PIN rate limiting** — 4-digit PIN brute-forceable in under 17 minutes | Security | PIN modal |
| P1-5 | **No session expiration** — teacher role persists indefinitely in localStorage | Security | `ST` object |
| P1-6 | **Shared mutable ST object** mixes student and teacher state; clean role transitions not enforced | Architecture | Global `ST` |
| P1-7 | **Triple cache incoherence** — Sheets fetch, localStorage, and in-memory `_tableRows` get out of sync | Performance | Teacher dashboard tabs |
| P1-8 | **Image questions lack alt text / screen reader description** | Accessibility | `renderQuestion()` |
| P1-9 | **Missing localStorage quota guard** — private browsing or full storage fails silently | Error Handling | `safeLS` wrapper |

### 🟡 P2 — Good Improvements for Summer

| # | Finding | Phase | Where |
|---|---------|-------|-------|
| P2-1 | **`safeLS` TDZ ordering** — `const` at line 2955 used in IIFE at line 2085 (works at runtime, brittle) | Quality | Lines 2085 / 2955 |
| P2-2 | **Client-side timer manipulable via DevTools** | Security | Timer functions |
| P2-3 | **D3 charts re-initialize on every tab open** (2–3s delay) | Performance | Analytics tab |
| P2-4 | **`renderQuestion()` cyclomatic complexity ~14** (handles 5 question types in one function) | Quality | `renderQuestion()` |
| P2-5 | **`renderTeacherTable()` is 129 lines** — stats, filtering, HTML, pagination all in one function | Quality | `renderTeacherTable()` |
| P2-6 | **Duplicate name-matching logic** in `doLogin()`, `selectStudentInRoster()`, `_dmRefreshStudentList()` | Quality | 3 locations |
| P2-7 | **No SRI hashes on CDN script tags** — supply-chain risk (Fuse.js, D3, DOMPurify) | Security | `<head>` |
| P2-8 | **Race condition on teacher refresh** — new fetch overwrites stale data mid-flight | Architecture | `renderTeacherTable()` |
| P2-9 | **Pass thresholds (65% / 70%) hardcoded**, not in CONFIG | Quality | Multiple locations |
| P2-10 | **~40 functions on global window** that should be private | Architecture | All |

### 🟢 P3 — Nice to Have

| # | Finding | Phase | Where |
|---|---------|-------|-------|
| P3-1 | **LESSONS schema undocumented** — fields, types, required vs optional not explained anywhere | Docs | `LESSONS` array line 898 |
| P3-2 | **No JSDoc on most functions** | Docs | Throughout |
| P3-3 | **No CONFIG comments** — new admin wouldn't know which fields to change | Docs | `CONFIG` block line 854 |
| P3-4 | **50+ magic numbers** (font sizes, timeouts, zoom steps) scattered in logic | Best Practices | Throughout |
| P3-5 | **Drawing tool canvas listeners leak** across re-renders | Performance | Drawing tool |
| P3-6 | **Login labels 11px** — too small for 3rd graders | Accessibility | Login CSS |
| P3-7 | **No keyboard alternative for highlight/eliminate tools** | Accessibility | Toolbar |
| P3-8 | **SR textarea answers missing aria-label** | Accessibility | `renderQuestion()` |
| P3-9 | **No double-submission guard** in `confirmSubmit()` | Quality | `confirmSubmit()` |
| P3-10 | **Dead code**: `ST.submitted` set but never read; old "compat" CSS rules | Best Practices | Multiple |

---

## Top 5 Quick Wins (Low Effort, High Impact)

These 5 changes require under an hour total and address real risks:

### 1. Rotate the Apps Script URL (15 min)
Go to your Google Apps Script project → Deploy → Manage Deployments → Create a new deployment. Update `CONFIG.sheetsUrl` in the HTML with the new URL. The old URL continues working until you explicitly archive it, so do archive it after updating the file.

### 2. Add PIN lockout counter (30 min)
After 5 failed PIN attempts, set a `pinLocked` flag in localStorage with a timestamp. On open, check if the flag is less than 15 minutes old and show "Try again later" instead of the PIN field. No server needed.

### 3. Replace onclick template injection with data attributes (45 min)
Replace patterns like:
```html
onclick="selectStudentInRoster('${name}')"
```
With:
```html
data-student="${escHtml(name)}"
```
Then add one delegated event listener that reads `el.dataset.student`. This eliminates the XSS surface entirely.

### 4. Add Map-based lookup before the class grid loop (30 min)
Before the nested loop in `renderClassGrid()`, build:
```javascript
const subMap = new Map(rows.map(r => [`${r.student}|${r.lesson}`, r]));
```
Then replace every `getSub(name, lesson.title)` call inside the loop with `subMap.get(...)`. Render time drops from ~200ms to ~30ms.

### 5. Add a submission retry queue (45 min)
Wrap the `fetch()` in `postToSheets()` with a simple retry:
```javascript
for (let attempt = 0; attempt < 3; attempt++) {
  try { await fetch(...); break; }
  catch(e) { if (attempt === 2) saveToLocalQueue(payload); await delay(1000 * attempt); }
}
```
Students' scores will no longer disappear on a bad connection.

---

## Grades by Dimension

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Functionality | **A** | Everything works; 39/39 tests pass |
| Security | **D+** | Score injection + PII exposure are serious; CSP and SHA-256 are good starts |
| Performance | **B–** | Grid render and missing retry are the only real problems |
| Code Quality | **C+** | Large functions, TDZ ordering, duplicated logic |
| Architecture | **C** | Monolith is fine for this scale; shared ST object and cache drift are the real concerns |
| Testing | **B–** | Solid workflow coverage; edge cases (offline, quota, reload) missing |
| Documentation | **C+** | CONFIG is clear; functions and schema lack explanation |
| Accessibility | **C** | ARIA present in places; image alt text and keyboard toolbar missing |
| **Overall** | **C+** | Strong foundation; P0 items need attention before wider deployment |

---

## Recommended Fix Order

**Before next test administration:**
1. Rotate the Apps Script URL (P0-2) — 15 min
2. Fix onclick XSS (P0-3) — 45 min
3. Add PIN lockout (P1-4) — 30 min
4. Fix class grid O(n²) (P1-2) — 30 min
5. Add submission retry (P1-1) — 45 min

**Before end of school year:**
6. Move student names to a private config or server lookup (P0-4 — FERPA)
7. Implement server-side scoring in Apps Script (P0-1 — score integrity)
8. Add SRI hashes to CDN tags (P2-7)

**Summer:**
9. Split `renderQuestion()` into type-specific renderers
10. Add JSDoc to CONFIG and LESSONS schema
11. Add accessibility fixes (alt text, aria-label on SR, toolbar keyboard)

---

## Raw Phase Reports

All detailed findings with line numbers and code examples are available in these files:

- `CODE_REVIEW.md` — Code quality detail
- `ARCHITECTURE_REVIEW.md` — Architecture detail
- `SECURITY_REVIEW.md` — Full security audit (CVSS scores, CWE refs, PoC attacks)
- `PERFORMANCE_REVIEW.md` — Performance profiling and remediation code
- `TESTING_DOCS_REVIEW.md` — Test coverage gaps and top 5 missing tests
- `BEST_PRACTICES_REVIEW.md` — Maintainability, a11y, error handling, quick wins

---

*Review conducted by automated multi-phase analysis across 6 specialized agents. All findings verified against actual source code with line-number references.*
