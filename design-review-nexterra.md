# Design Review: Nexterra Student Practice Portal

**Reviewed:** 2026-04-04
**Target:** nexterra.html (entire site — 5,448 lines, single-file app)
**Focus:** Visual design, usability, accessibility, responsive behavior
**Context:** 3rd grade state test prep portal used on school Chromebooks

---

## Summary

The portal is well-built for its purpose — it closely mirrors the NYS state test CBT interface, which is the right call for test prep. The visual hierarchy is clear, the test-taking experience is solid, and the teacher dashboard is functional. However, there are meaningful issues around mobile responsiveness on Chromebooks, color contrast for younger users, and some missing accessibility patterns that matter for an education tool.

**Issues Found: 16**

- Critical: 2
- Major: 5
- Minor: 5
- Suggestions: 4

---

## Critical Issues

### 1. Teacher hint text is invisible on the login screen

**Severity:** Critical
**Location:** Line 855
**Category:** Visual / Usability

**Problem:**
The teacher login hint uses `color: rgba(255,255,255,.35)` — white at 35% opacity on a white login card background. This text is essentially invisible.

**Impact:**
Teachers won't see how to log in unless they already know the code. This was just changed from a clickable button to a text hint, so teachers who were used to clicking "Teacher Access" will be lost.

**Recommendation:**
Move the hint outside the white card (into the blue background area), or use a darker text color inside the card:

```css
/* Option A: darker text on white card */
color: #888; font-size: 11px;

/* Option B: move outside .login-wrap into the blue bg */
color: rgba(255,255,255,.6);
```

---

### 2. Only two mobile breakpoints for a Chromebook-heavy audience

**Severity:** Critical
**Location:** Lines 260, 573
**Category:** Responsive

**Problem:**
The site has only two breakpoints: `max-width: 700px` (scratch panel) and `max-width: 680px` (test layout stacks vertically). School Chromebooks typically have 1366×768 screens but students may use split-screen or have browser zoom at 110-125%. The teacher dashboard (`max-width: 1100px`) has no mobile breakpoint at all.

**Impact:**
On a Chromebook at 125% zoom (effective ~1093px viewport), the passage + question split pane works but gets cramped. The teacher dashboard's DataMate sidebar (240px fixed) doesn't collapse on narrower screens. The test grid cards have a 280px minimum, which may not work well at certain zoom levels.

**Recommendation:**
Add a tablet breakpoint around 900-1024px:
- Collapse the DataMate left sidebar to a top dropdown
- Let the passage/question panes adjust their ratio
- Make teacher tabs horizontally scrollable (they already wrap, but can overflow awkwardly)

---

## Major Issues

### 3. Login labels say "Student First Name" — confusing for teachers

**Severity:** Major
**Location:** Line 844
**Category:** Usability

**Problem:**
Now that teachers log in through the same form, the label "Student First Name" is misleading. A teacher typing "Ms. Watt" is not a student.

**Recommendation:**
Change label to just "Name" or "First & Last Name":
```html
<label for="ln-name">Your Name</label>
```

---

### 4. No empty state for the test list

**Severity:** Major
**Location:** Test list screen (sc-tests)
**Category:** Usability

**Problem:**
If no assessments are available (e.g., all tests are hidden or the LESSONS array is empty for a class), students see a blank white grid area with no message.

**Recommendation:**
Add an empty state message like: "No assessments available right now. Check back later or ask your teacher."

---

### 5. Login screen class code hint only shows two classes

**Severity:** Major
**Location:** Line 853
**Category:** Usability

**Problem:**
The hint text says "Enter your class name: HAMILTON or HOLYCROSS" — but there are 6 student class codes (WATT, WATT2, HAMILTON, HOLYCROSS, ALMONTE, ALMONTE2) plus TEACHER. Students in Ms. Watt's or Mx. Almonte's classes won't know their code from this hint.

**Recommendation:**
Either list all codes, or use a generic hint:
```html
<p class="login-hint">Enter the class code your teacher gave you</p>
```

---

### 6. Buttons use only color to indicate state (no icon/text change)

**Severity:** Major
**Location:** Lines 459, 482-484 (toolbar, question chips)
**Category:** Accessibility

**Problem:**
The toolbar buttons (highlight, eliminator, line-reader) only change background color when active (`.tb-btn.on`). The question strip chips only change color for answered/bookmarked/current. Users with color vision deficiency can't distinguish these states.

**Recommendation:**
Add a secondary indicator: a small checkmark, underline, or border change. For question chips, add a dot or fill pattern for "answered" vs "unanswered."

---

### 7. Teacher dashboard loading has no skeleton or progress indicator

**Severity:** Major
**Location:** Line 4056
**Category:** Usability

**Problem:**
When the teacher dashboard loads data from Sheets, it shows a simple "⏳ Loading from Google Sheets…" text message. On slow school networks this can take several seconds with no visual feedback that progress is happening.

**Recommendation:**
Add a simple CSS spinner animation next to the loading text, or a pulsing skeleton placeholder for the stats cards and table.

---

## Minor Issues

### 8. Hard-coded school name in header

**Severity:** Minor
**Location:** Lines 19, 838, 898

**Problem:**
"Hamilton / Holy Cross — Spring Break Practice" is hard-coded in the title, logo, and header. This makes it awkward if other classes (WATT, ALMONTE) are using it — those students see a different school's name.

**Recommendation:**
Either make the header dynamic based on the student's class, or use a generic name like "3rd Grade Practice Portal."

---

### 9. Inconsistent border-radius values

**Severity:** Minor
**Location:** Throughout CSS

**Problem:**
Border radius values range from 2px to 20px across components with no clear system: cards use 8-18px, badges use 20px, inputs use 3-7px, buttons use 4-8px. This creates subtle visual inconsistency.

**Recommendation:**
Adopt 3-4 standard radius values (e.g., `--radius-sm: 4px; --radius-md: 8px; --radius-lg: 14px; --radius-full: 9999px`) and apply consistently.

---

### 10. Custom scrollbar styling only works in WebKit

**Severity:** Minor
**Location:** Lines 568-571

**Problem:**
`::-webkit-scrollbar` styles won't work in Firefox. School Chromebooks use Chrome (WebKit), so this is fine for the primary audience, but Firefox users get unstyled scrollbars.

**Recommendation:**
Low priority — fine for now since target is Chromebooks. Could add `scrollbar-width: thin; scrollbar-color: #b0bcd0 transparent;` for Firefox.

---

### 11. Print stylesheet is very minimal

**Severity:** Minor
**Location:** Line 5095

**Problem:**
The print style is just `body{padding:12px;}`. If a teacher prints a student's results or the dashboard, it won't look good.

**Recommendation:**
Low priority, but could add `@media print` rules to hide navigation, show tables at full width, and use black text on white.

---

### 12. No `<h1>` on the login screen

**Severity:** Minor
**Location:** Line 838
**Category:** Accessibility

**Problem:**
The login screen's main title "Hamilton / Holy Cross" is a `<div class="nxt-logo-mark">` not an `<h1>`. Screen readers won't identify it as the page heading.

**Recommendation:**
Change to `<h1 class="nxt-logo-mark">` — the visual styling stays the same.

---

## Suggestions

### 13. Consider a dropdown for class code instead of free text

Students (8-9 year olds) have to type their class code exactly right. A `<select>` dropdown would eliminate typos entirely and be faster on Chromebook touchpads. The current fuzzy matching for names is great, but class codes don't benefit from it since they must be exact.

### 14. Add visual feedback when tools are toggled

When the highlighter or eliminator is activated, consider a brief toast or a border glow on the passage/question area so students know the tool is "on" and where to use it. The toolbar button changes color, but young students may not connect that to what happens next.

### 15. Consider larger touch targets for mobile/Chromebook use

The question strip chips (30×30px) and some toolbar buttons (min-width 70px) are on the small side for 3rd graders using trackpads or touchscreens. The [WCAG 2.5.8 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) recommends 44×44px minimum for interactive elements.

### 16. Teacher dashboard could show which teacher is logged in more prominently

The "Logged in as: Ms. Watt" text in the subtitle is small and easy to miss. Since teachers now log in by name, consider showing a welcome header or badge so they feel oriented.

---

## Positive Observations

- **Excellent NYS test fidelity:** The test screen closely mirrors the actual CBT interface (split passage/questions, lined paper for written responses, bookmark flags, question strip navigation). This is the #1 thing that matters for test prep.
- **Thoughtful accessibility foundation:** Skip link, `aria-pressed` on toggle buttons, `aria-label` on interactive elements, `role="dialog"` on modals, `prefers-reduced-motion` support — well above average for a school tool.
- **Strong error handling on login:** Fuzzy name matching with "Did you mean?" suggestions is perfect for 3rd graders who can't spell perfectly. The class code validation is clear.
- **Good use of color coding:** Pass/warn/fail colors are consistent and meaningful throughout (green for pass, amber for in-progress, red for fail).
- **Content Security Policy:** Having CSP headers on a student-facing tool is a nice security touch.
- **Scratch paper feature:** Mirrors the real state test CBT scratch paper — students will feel prepared.

---

## Prioritized Next Steps

1. **Fix teacher hint visibility** (Critical #1) — 2-minute CSS fix
2. **Update login label from "Student First Name" to "Your Name"** (Major #3) — 1-minute text change
3. **Update class code hint to be generic** (Major #5) — 1-minute text change
4. **Add tablet breakpoint for Chromebook zoom** (Critical #2) — 30-minute CSS addition
5. **Add empty state for test list** (Major #4) — 10-minute JS addition
6. **Add secondary state indicators for color-blind users** (Major #6) — 20-minute CSS/JS update

---

*Generated by Design Review on 2026-04-04. Issues 1-3 are quick wins that can be fixed in under 5 minutes total.*
