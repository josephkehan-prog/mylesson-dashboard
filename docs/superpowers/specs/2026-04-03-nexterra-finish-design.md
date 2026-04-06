# Nexterra Student Portal — Finish & Restructure Design

**Date:** 2026-04-03
**File:** `nexterra_student.html` → deployed as `nexterra.html` on GitHub Pages
**Approach:** Option B — Fix & Restructure (targeted fixes + teacher-managed assignment system)

---

## Overview

The Nexterra portal is a single-file HTML app for Hamilton/Holy Cross/Watt/Almonte 3rd grade students to take NYS ELA and Math practice tests. The current build has a working test-taking engine but suffers from hardcoded content, performance issues, UI bugs, and missing teacher tools. This spec covers everything needed to finish the site to a production-ready state, with content loading deferred until the teacher provides source files.

---

## Scope

### 1. Clear All Existing Assignments

Remove all 9 hardcoded lessons from the `LESSONS` array in the JavaScript (8 math + 1 ELA). Replace with an empty array `[]`.

**Student experience:** The test list screen shows a clean empty state — a centered icon, "No assignments yet" heading, and "Check back soon!" subtext in the existing brand colors.

**Teacher experience:** The dashboard reflects 0 assignments, ready to receive new ones.

---

### 2. Teacher Assignment Manager

A new "Assignments" tab in the teacher dashboard replaces the current hardcoded lesson system. Teachers can add, preview, and delete assignments without editing any code.

**Add assignment flow:**
- Modal form with: Title, Subject (ELA / Math dropdown), Duration (minutes), and a textarea for pasting questions as JSON
- On save, the assignment appears immediately on the student test list
- Validation: title required, subject required, at least 1 question required

**Assignment table:**
- Columns: Title, Subject, Questions (count), Status (Active / Draft), Actions
- Actions: Delete (with confirmation prompt)
- Empty state row: "No assignments added yet — click Add Assignment to get started"

**Question JSON format** (teachers paste this into the form):
```json
[
  {
    "type": "mc",
    "text": "Question text here",
    "choices": ["A. Option", "B. Option", "C. Option", "D. Option"],
    "answer": "A"
  },
  {
    "type": "sr",
    "text": "Short response question text here"
  }
]
```

**Storage:** Assignments stored in `localStorage` under key `nxt_assignments`. This matches the existing app's storage pattern.

**Import from JSON:** Secondary button allows pasting a full assignment object (title + questions) as JSON for bulk loading.

---

### 3. Question Text Size Increase

Increase font sizes in the test interface for 3rd-grade readability:

| Element | Current | New |
|---|---|---|
| Question text | ~13px | 17px |
| Answer choices | ~12px | 16px |
| Choice padding | ~8px 12px | 12px 16px |
| Passage text | ~13px | 16px |

---

### 4. Dead Links Audit & Fix

Audit every screen for broken links, missing `href` targets, and non-functional buttons. Known areas to check:
- Navigation arrows in the test interface
- Review screen "Go to question" links
- Teacher dashboard tab switching
- Any `src` references to images that no longer exist (images were referenced for math questions that were never populated)
- All `onclick` handlers that reference functions no longer present after content cleanup

---

### 5. Broken UI Fixes

Screen-by-screen layout audit. Known issues from user report: overlapping elements, clipped content, general layout breaks. Each screen to audit:

- **Login screen** — card centering, input focus states
- **Test list screen** — card grid on narrow viewports, empty state centering
- **Test interface** — passage panel / question pane split on smaller screens, toolbar overflow
- **Review screen** — question list scroll, stat card layout
- **Completion screen** — progress ring centering, badge alignment
- **Teacher dashboard** — tab content overflow, table responsiveness, modal z-index

---

### 6. Performance Improvements

- Remove all question/passage/image data tied to the cleared lessons (the bulk of the file size)
- Remove any dead JavaScript functions that only served the removed lessons
- Verify Fuse.js is lazy-loaded on first keystroke only (already implemented per code review — confirm it's still wired correctly after cleanup)
- Target: reduce file from ~72k tokens to significantly smaller

---

### 7. Better Teacher Reports

The existing Reports tab is enhanced with:

**Summary stat cards (top of tab):**
- Total Submissions
- Class Average %
- Passing Count
- Below Passing Count

**Per-student table:**

| Student | Assignment | Score % | MC % | SR % | Status |
|---|---|---|---|---|---|
| Name | Title | 84% | 88% | 78% | PASS / BELOW |

- PASS badge: green background, green text
- BELOW badge: red background, red text
- Pass thresholds: ELA 70%, Math 65% (existing CONFIG values)
- Table sortable by Score % column
- Data sourced from `localStorage` submission records

---

### 8. CSV Export

Two export buttons at the top of the Reports tab:

- **Export CSV — All Students** — downloads `scores_YYYY-MM-DD.csv`
- **Export CSV — Below Passing Only** — same format, filtered

**CSV columns:** Student Name, Class, Assignment, Subject, Score %, MC %, SR %, Pass/Fail, Time Spent (mm:ss), Submission Date

Export is client-side (no server needed) using a Blob download.

---

### 9. Paper Work Photo Submission

After a student completes all questions and clicks "Submit," a new screen appears before the score/completion screen:

**"Show Your Work" upload screen:**
- Heading: "Almost done! Upload a photo of your paper work."
- Subtext: "Take a picture of the paper where you showed your work. This helps your teacher see how you solved the problems."
- Large upload button / camera icon tap area (uses `<input type="file" accept="image/*" capture="environment">` for mobile camera access on supported devices)
- Preview thumbnail of the selected image
- "Submit with photo" primary button
- "Skip — I didn't use paper" secondary link (allowed but logged)

**What gets stored:**
- Photo is stored as a base64 data URL in the submission record in `localStorage`
- Flagged as `hasWorkPhoto: true` or `hasWorkPhoto: false` (skipped) in the record

**Teacher Reports integration:**
- Reports table gains a "Work Photo" column with a thumbnail or "View" link
- Clicking opens the image in a lightbox/modal
- CSV export includes a `Has Work Photo` (Yes/No) column

**Constraints:**
- Image is compressed client-side to JPEG at 0.7 quality before storage (reuses existing drawing tool export pattern)
- Max image size warning shown if file > 5MB before compression
- Photo is not sent to Google Sheets (too large for Apps Script) — stored locally only

---

## Out of Scope (This Build)

- **ELA and Math content** — passages and questions will be loaded via the Assignment Manager when the teacher provides source files. No content is being written or generated in this build.
- **Server-side data persistence** — all data remains in localStorage. Google Sheets integration for scores is already in place and is not being modified.
- **Offline/PWA support**
- **Accessibility audit** (beyond the font size fix)

---

## Data Architecture

No schema changes to existing localStorage keys. New keys added:

| Key | Value |
|---|---|
| `nxt_assignments` | `JSON.stringify(Assignment[])` — teacher-managed lessons |
| Submission records | Existing structure + `hasWorkPhoto: boolean` + `workPhotoData: string \| null` |

The existing `LESSONS` constant in JS is replaced at runtime by loading from `nxt_assignments`. If `nxt_assignments` is empty or missing, the student test list shows the empty state.

---

## Files Changed

- `nexterra_student.html` — all changes are in this single file
- No new files, no backend changes, no dependency additions
