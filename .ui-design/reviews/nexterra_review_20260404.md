# Design Review: nexterra_student.html

**Review ID:** nexterra_20260404
**Reviewed:** 2026-04-04
**Target:** nexterra_student.html (live at josephkehan-prog.github.io/mylesson-dashboard/nexterra.html)
**Focus:** Comprehensive — Visual, Usability, Code Quality, Performance
**Platform:** All (Desktop + Tablet + Mobile)

---

## Summary

This is a well-engineered, single-file educational assessment portal for 3rd grade NYS test prep. The overall build quality is high — accessibility is thoughtfully implemented, the color system is consistent, and the interface mirrors real NYS testing tools. The primary areas for improvement are mobile responsiveness, font readability for young readers, and a handful of minor code quality issues. No critical blockers were found.

**Issues Found: 12 total**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 3 |
| Minor | 6 |
| Suggestions | 3 |

---

## Major Issues

### Issue 1: Mobile — Passage + Question Pane Stacking Is Too Tight

**Severity:** Major
**Location:** CSS line 429–434 (`@media (max-width: 680px)`)
**Category:** Usability / Responsive Design

**Problem:**
On mobile, the passage is capped at `40vh` and the question pane fills the rest. For 3rd graders reading a long ELA passage, this means they must scroll the 40vh passage panel, then scroll the question pane — two separate scroll contexts on a small screen. This is cognitively difficult for young readers and doesn't mirror the real NYS test experience on a device.

**Recommendation:**
Switch to a tabbed layout on mobile — a "Passage" tab and "Questions" tab — so each takes the full viewport. Add a sticky "Go to Questions →" button at the bottom of the passage panel.

```css
/* Before */
@media (max-width: 680px) {
  .t-body { flex-direction: column; }
  .t-passage { flex: none; max-height: 40vh; }
}

/* After — add tab switching via JS, give each panel full height */
@media (max-width: 680px) {
  .t-body { flex-direction: column; }
  .t-passage { flex: none; height: 100%; display: none; }
  .t-passage.mob-active { display: block; }
  .t-qpane { display: none; }
  .t-qpane.mob-active { display: block; width: 100%; max-width: 100%; }
}
```

---

### Issue 2: Font Stack Not Kid-Friendly

**Severity:** Major
**Location:** CSS line 24 (`font-family: 'Segoe UI', Arial, sans-serif`)
**Category:** Visual Design / Typography

**Problem:**
`Segoe UI` is a Windows-only font — on Mac and Linux it falls back to `Arial`, which has poor readability for young readers (especially the lowercase 'a' and 'l' which can look like '1'). For a 3rd grade reading test, legibility of passage text is critical.

**Recommendation:**
Add `Lexend` (designed specifically for reading ease) or `Nunito` as a primary font via Google Fonts. Both are free and load fast. Since the CSP restricts `font-src 'self'`, self-host the font files or update the CSP to allow `fonts.gstatic.com`.

```css
/* Option A: Update CSP to allow Google Fonts */
font-src 'self' https://fonts.gstatic.com;

/* Option B: Self-host Lexend and update font stack */
font-family: 'Lexend', 'Segoe UI', Arial, sans-serif;
```

---

### Issue 3: Teacher Access Button Has No Visible Contrast on Login Screen

**Severity:** Major
**Location:** HTML line 677 — Teacher Access inline button
**Category:** Accessibility / Contrast

**Problem:**
The "Teacher Access" button uses `color: rgba(255,255,255,.45)` — a semi-transparent white on the white login card background. The contrast ratio is approximately 1.8:1, far below the WCAG AA minimum of 4.5:1 for text. A teacher trying to access the dashboard on a bright screen would struggle to see this button.

**Recommendation:**
Change the color to at minimum `color: #555` (on white background = ~7.5:1 contrast), or use the brand dark blue `#00205b`.

```html
<!-- Before -->
style="color:rgba(255,255,255,.45);"

<!-- After -->
style="color: #555; font-size: 12px;"
```

---

## Minor Issues

### Issue 4: `<title>` Uses Em Dash — May Render Oddly on Some Devices

**Severity:** Minor
**Location:** HTML line 19
**Category:** Code Quality

**Problem:**
`<title>Hamilton / Holy Cross — Spring Break Practice Portal</title>` uses a literal em dash character. While modern browsers handle this fine, some older Android browsers and screen readers may read "dash dash" instead of a pause.

**Recommendation:** Use `&mdash;` HTML entity, or simplify to a colon: `Hamilton / Holy Cross: Spring Break Practice Portal`.

---

### Issue 5: Inline Styles on Modal and Login Elements

**Severity:** Minor
**Location:** HTML lines 683–715 (teacher PIN modal), line 677 (teacher button)
**Category:** Code Quality / Maintainability

**Problem:**
The teacher PIN modal and several buttons use long inline `style=""` blocks. This makes the styles impossible to override, hard to maintain, and inconsistent with the rest of the file which uses clean class-based CSS. If you want to adjust the modal design later, you'd have to hunt through HTML.

**Recommendation:**
Move modal styles to named classes in the `<style>` block (e.g., `.tpm-modal`, `.tpm-input`, `.tpm-btn`).

---

### Issue 6: No `aria-label` on Nav Arrows

**Severity:** Minor
**Location:** HTML lines 771–773 — `t-hnav-btn` buttons
**Category:** Accessibility

**Problem:**
The previous/next question buttons use Unicode triangle characters (`▶` / `◀`) as their visible label with no `aria-label`. Screen readers will announce "black right-pointing triangle" which is not useful.

**Recommendation:**
```html
<!-- Before -->
<button class="t-hnav-btn" onclick="navQ(-1)">&#9664;</button>
<button class="t-hnav-btn" onclick="navQ(1)">&#9654;</button>

<!-- After -->
<button class="t-hnav-btn" onclick="navQ(-1)" aria-label="Previous question">&#9664;</button>
<button class="t-hnav-btn" onclick="navQ(1)" aria-label="Next question">&#9654;</button>
```

---

### Issue 7: Skip Link Goes to `#sc-login`, Not `#main-content`

**Severity:** Minor
**Location:** HTML line 653
**Category:** Accessibility

**Problem:**
The skip link targets `#sc-login` — the login screen — rather than the main content area. After login, this skip link is irrelevant and doesn't help keyboard users skip to the test content.

**Recommendation:**
Make the skip link target dynamic based on active screen, or add a `#main-content` anchor at the top of the test body (`#sc-test .t-body`) and update the skip link target accordingly.

---

### Issue 8: `tq-bmark` Bookmark Button Has No `aria-label`

**Severity:** Minor
**Location:** CSS line 250, used in JS-rendered question pane
**Category:** Accessibility

**Problem:**
The bookmark button renders as a star emoji with no text label and no `aria-label`. `aria-pressed` is set correctly but screen readers will say "button, pressed" with no context.

**Recommendation:**
Add `aria-label="Bookmark this question"` to the bookmark button when rendered.

---

### Issue 9: `border-right: 3px solid #00205b` on Passage Pane Is Heavy on Mobile

**Severity:** Minor
**Location:** CSS line 216
**Category:** Visual Design

**Problem:**
The 3px dark blue border between the passage and question panes is a strong visual divider — appropriate on desktop, but on mobile it becomes a horizontal rule (`border-bottom`) that adds unnecessary weight between stacked panels.

**Recommendation:**
On mobile, reduce to `1px` or replace with a lighter divider color like `#d0d8e8` to reduce visual noise.

---

## Suggestions

### Suggestion 1: Add a Reading-Level Font Size Preference

Students benefit from being able to increase passage text size independently of the zoom control. The zoom control (`adjustZoom`) scales the whole page — consider a passage-specific font size toggle (e.g., A / A+ buttons in the passage toolbar) that only affects `.p-text` and `.p-poem-text`. This mirrors tools on real NYS digital tests.

---

### Suggestion 2: Add `loading="lazy"` to Math Question Images

**Location:** `.tq-img-wrap img` elements
Math questions with images (`.tq-img-wrap img`) load immediately even when the student hasn't reached that question yet. Adding `loading="lazy"` to dynamically-rendered `<img>` tags in the JS question renderer would reduce initial load time for tests with many image-based questions.

---

### Suggestion 3: Consider a `<datalist>` for the Class Code Field

**Location:** HTML line 671 — `#ln-code` input
The class code input accepts free text but only a fixed set of values are valid (HAMILTON, HOLYCROSS, WATT, etc.). A `<datalist>` element would show autocomplete suggestions without exposing the validation logic, reducing login errors for students who mistype their class code.

```html
<input id="ln-code" list="class-codes" ... />
<datalist id="class-codes">
  <option value="HAMILTON">
  <option value="HOLYCROSS">
  <option value="WATT">
  <option value="ALMONTE">
</datalist>
```

---

## Positive Observations

- **Accessibility is exceptional** for a single-file app: skip link, `aria-modal`, `aria-pressed`, `role="alert"`, focus-visible outlines (3px solid `#0070c0`), and reduced-motion media query all correctly implemented.
- **Color system is tight and consistent** — `#00205b` / `#0070c0` / `#117833` used semantically throughout, no magic color values scattered in random places.
- **DOMPurify is included** for sanitization — security-conscious choice for a student-facing app.
- **CSP header is well-configured** — restricts script sources, blocks arbitrary third-party connections, and uses `integrity` attributes on CDN scripts.
- **Toolbar mirrors real NYS test interface** — zoom, highlight, eliminator, line guide, bookmark. This is excellent authentic test prep.
- **Pass thresholds match project standards** — ELA 70%, Math 65% correctly configured.
- **Grid layout for test cards** uses `auto-fill` + `minmax(280px, 1fr)` — naturally responsive without breakpoints.
- **Math mode correctly hides passage pane** and centers question content — clean separation of ELA vs Math UX.

---

## Next Steps (Prioritized)

1. Fix Teacher Access button contrast (Issue 3) — 2-minute fix, critical for teacher usability
2. Add `aria-label` to nav arrows (Issue 6) — 1-minute fix
3. Evaluate mobile tab layout for passage/question pane (Issue 1) — biggest UX improvement
4. Update font stack to Lexend or Nunito (Issue 2) — improves reading experience for scholars
5. Move PIN modal inline styles to CSS classes (Issue 5) — maintainability improvement
6. Add `<datalist>` for class code field (Suggestion 3) — reduces student login errors

---

*Generated by UI Design Review — 2026-04-04*
