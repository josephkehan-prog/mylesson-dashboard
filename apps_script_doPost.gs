/**
 * Nexterra Practice Portal — Google Apps Script (complete replacement)
 * ─────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM PREVIOUS VERSION:
 *   - doPost() now independently scores submissions using ANSWER_KEYS.
 *     For the 12 built-in lessons: client-reported score is IGNORED — the
 *     server computes and records the correct score.
 *   - For custom (teacher-built) lessons: no server-side answer key exists,
 *     so the client-reported score is accepted as a fallback and flagged
 *     "client" in the new scoreSource column.
 *   - doGet() now reads rows by HEADER NAME (not column position), so adding
 *     new columns won't break the teacher dashboard.
 *   - A new scoreSource column (I) is appended — "server", "client", or
 *     "unscored". Existing rows simply won't have this column (empty).
 *   - The date-as-score bug is fixed: score is now always written as
 *     "correct/total" (e.g. "12/16") or "SR_ONLY".
 *
 * HOW TO DEPLOY:
 *   1. script.google.com → your project → paste this entire file
 *      (replace the existing Code.gs content)
 *   2. Deploy → Manage Deployments → New deployment
 *      Execute as: Me  |  Who has access: Anyone
 *   3. Copy the new /exec URL → paste into CONFIG.sheetsUrl in nexterra_student.html
 *      (search for ROTATE_URL in the file)
 *   4. Archive the old deployment
 */

// ─── ANSWER KEYS ─────────────────────────────────────────────────────────────
// Source: extracted from LESSONS array in nexterra_student.html
// Each question: {t: "mc"|"sr", a: "A"|"B"|"C"|"D"|null}
// ADD NEW LESSONS HERE whenever you add them to the portal's LESSONS array.
const ANSWER_KEYS = {
  "math-2024": [
    {t:"mc",a:"A"},{t:"mc",a:"B"},{t:"mc",a:"B"},{t:"mc",a:"D"},
    {t:"mc",a:"C"},{t:"mc",a:"B"},{t:"mc",a:"D"},{t:"mc",a:"B"},
    {t:"mc",a:"D"},{t:"mc",a:"C"},{t:"mc",a:"B"},{t:"mc",a:"B"},
    {t:"mc",a:"D"},{t:"mc",a:"C"},{t:"mc",a:"A"},{t:"mc",a:"C"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-2025": [
    {t:"mc",a:"C"},{t:"mc",a:"D"},{t:"mc",a:"D"},{t:"mc",a:"D"},
    {t:"mc",a:"B"},{t:"mc",a:"B"},{t:"mc",a:"B"},{t:"mc",a:"C"},
    {t:"mc",a:"C"},{t:"mc",a:"A"},{t:"mc",a:"B"},{t:"mc",a:"B"},
    {t:"mc",a:"C"},{t:"mc",a:"C"},{t:"mc",a:"B"},{t:"mc",a:"C"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-practice-mc": [
    {t:"mc",a:"B"},{t:"mc",a:"C"},{t:"mc",a:"C"},{t:"mc",a:"C"},
    {t:"mc",a:"C"},{t:"mc",a:"C"},{t:"mc",a:"B"},{t:"mc",a:"B"},
    {t:"mc",a:"B"},{t:"mc",a:"D"},{t:"mc",a:"B"},{t:"mc",a:"D"}
  ],
  "math-practice-cr":   [{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}],
  "math-practice-draw": [{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}],
  "math-practice-mixed": [
    {t:"mc",a:"B"},{t:"mc",a:"B"},{t:"mc",a:"A"},{t:"mc",a:"C"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-oa-mixed": [
    {t:"mc",a:"B"},{t:"mc",a:"D"},{t:"mc",a:"C"},{t:"mc",a:"B"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-nbt-mixed": [
    {t:"mc",a:"B"},{t:"mc",a:"D"},{t:"mc",a:"B"},{t:"mc",a:"B"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-nf-mixed": [
    {t:"mc",a:"C"},{t:"mc",a:"C"},{t:"mc",a:"C"},{t:"mc",a:"B"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-md-mixed": [
    {t:"mc",a:"B"},{t:"mc",a:"B"},{t:"mc",a:"C"},{t:"mc",a:"C"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-g-mixed": [
    {t:"mc",a:"C"},{t:"mc",a:"B"},{t:"mc",a:"C"},{t:"mc",a:"B"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ],
  "math-totaling": [
    {t:"mc",a:"C"},{t:"mc",a:"D"},{t:"mc",a:"C"},{t:"mc",a:"B"},
    {t:"mc",a:"C"},{t:"mc",a:"A"},
    {t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null},{t:"sr",a:null}
  ]
};

// ─── SERVER-SIDE SCORING ──────────────────────────────────────────────────────
function serverScore(lessonId, answersObj) {
  var key = ANSWER_KEYS[lessonId];
  if (!key) return null;  // unknown lesson — no server key

  var correct = 0, mcTotal = 0, srCount = 0;
  for (var i = 0; i < key.length; i++) {
    if (key[i].t === 'mc') {
      mcTotal++;
      if (String(answersObj[i]) === key[i].a) correct++;
    } else {
      srCount++;
    }
  }
  var pct = mcTotal > 0 ? correct / mcTotal : null;
  return { correct: correct, mcTotal: mcTotal, srCount: srCount, pct: pct };
}

// ─── SHEET HELPERS ────────────────────────────────────────────────────────────
// Ensures the Submissions sheet has header row; returns the sheet.
function getSubmissionsSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Submissions') || ss.getSheets()[0];

  // Add headers if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp','Student','ClassCode','Lesson','LessonId',
      'Score','Pct','Correct','Total','SRCount','TimeTaken','Answers','ScoreSource'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Read header row and return a name→columnIndex map (0-based).
function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  headers.forEach(function(h, i) { map[String(h).trim()] = i; });
  return map;
}

// ─── doPost ──────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = getSubmissionsSheet();

    // Parse submitted answers
    var answersObj = {};
    try {
      answersObj = typeof data.answers === 'string'
        ? JSON.parse(data.answers) : (data.answers || {});
      // Handle double-encoded answers (bug in some old clients)
      if (typeof answersObj === 'string') answersObj = JSON.parse(answersObj);
    } catch(err) { answersObj = {}; }

    // Score server-side for known lessons; fall back to client score for custom
    var score = serverScore(data.lessonId, answersObj);
    var scoreSource, scoreDisplay, pctValue, correct, mcTotal, srCount;

    if (score) {
      // ✅ Server-scored — authoritative
      scoreSource  = 'server';
      correct      = score.correct;
      mcTotal      = score.mcTotal;
      srCount      = score.srCount;
      pctValue     = score.pct !== null ? score.pct : '';
      scoreDisplay = mcTotal > 0 ? correct + '/' + mcTotal : 'SR_ONLY';
    } else {
      // ⚠️ Custom lesson — accept client-reported score as fallback
      scoreSource  = 'client';
      // data.clientScore is "correct/total" like "12/16" or "SR_ONLY"
      scoreDisplay = data.clientScore || 'SR_ONLY';
      pctValue     = typeof data.clientPct === 'number' ? data.clientPct : '';
      correct      = data.clientCorrect || '';
      mcTotal      = data.clientTotal   || '';
      srCount      = data.srCount       || 0;
    }

    sheet.appendRow([
      new Date(),                    // Timestamp
      data.name     || '',           // Student
      data.class    || '',           // ClassCode
      data.lesson   || '',           // Lesson title
      data.lessonId || '',           // LessonId
      scoreDisplay,                  // Score ("correct/total" or "SR_ONLY")
      pctValue,                      // Pct (decimal, e.g. 0.75)
      correct,                       // Correct
      mcTotal,                       // Total
      srCount,                       // SRCount
      data.timeTaken || '',          // TimeTaken
      JSON.stringify(answersObj),    // Answers
      scoreSource                    // ScoreSource
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({
        status:      'ok',
        score:       scoreDisplay,
        pct:         pctValue,
        correct:     correct,
        total:       mcTotal,
        srCount:     srCount,
        scoreSource: scoreSource
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    Logger.log('doPost error: ' + err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── doGet — returns all submissions for the teacher dashboard ────────────────
// Reads by HEADER NAME so adding new columns never breaks field mapping.
function doGet(e) {
  try {
    var sheet = getSubmissionsSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput('[]').setMimeType(ContentService.MimeType.JSON);
    }

    var hmap    = getHeaderMap(sheet);
    var allRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    // Helper: safely read a cell by header name
    function col(row, name) {
      var idx = hmap[name];
      return idx !== undefined ? row[idx] : '';
    }

    var result = allRows.map(function(row) {
      var raw = col(row, 'Score') || col(row, 'score') || '';
      // Guard: if cell is a Date object (legacy bug), convert to readable string
      if (raw instanceof Date) raw = raw.toLocaleDateString();
      var rawPct = col(row, 'Pct') || col(row, 'pct') || '';

      return {
        time:        formatTimestamp(col(row, 'Timestamp') || col(row, 'time')),
        student:     col(row, 'Student')   || col(row, 'student')   || '',
        classCode:   col(row, 'ClassCode') || col(row, 'classCode') || '',
        lesson:      col(row, 'Lesson')    || col(row, 'lesson')    || '',
        lessonId:    col(row, 'LessonId')  || col(row, 'lessonId')  || '',
        score:       String(raw),
        pct:         String(rawPct),
        correct:     col(row, 'Correct')   || '',
        total:       col(row, 'Total')     || '',
        srCount:     col(row, 'SRCount')   || 0,
        timeTaken:   col(row, 'TimeTaken') || col(row, 'timeTaken') || '',
        answers:     col(row, 'Answers')   || col(row, 'answers')   || '{}',
        scoreSource: col(row, 'ScoreSource') || ''
      };
    });

    // Filter out empty rows (no student + no lesson)
    result = result.filter(function(r) { return r.student || r.lesson; });

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    Logger.log('doGet error: ' + err);
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function formatTimestamp(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toString();
  return String(val);
}
