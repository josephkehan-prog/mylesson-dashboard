const { test, expect } = require('@playwright/test');

// Helpers
async function clearState(page) {
  await page.evaluate(() => {
    Object.keys(localStorage).filter(k => k.startsWith('nxt') || k.startsWith('nexterra')).forEach(k => localStorage.removeItem(k));
  });
}

async function loginAsStudent(page, name = 'Sarjo Touray', code = 'HAMILTON') {
  await page.fill('#ln-name', name);
  await page.fill('#ln-code', code);
  await page.click('.btn-signin');
}

// ─────────────────────────────────────────────
// Login Tracking
// ─────────────────────────────────────────────
test.describe('Login Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nexterra_student.html');
    await clearState(page);
    await page.reload();
  });

  test('records login event to Supabase when student logs in', async ({ page }) => {
    const loginRequests = [];
    page.on('request', req => {
      if (req.url().includes('supabase') && req.url().includes('/logins')) {
        loginRequests.push(req);
      }
    });

    await loginAsStudent(page);
    await page.waitForTimeout(1000);

    expect(loginRequests.length).toBeGreaterThanOrEqual(1);
    expect(loginRequests[0].method()).toBe('POST');
  });

  test('login POST goes to Supabase, not Google Apps Script', async ({ page }) => {
    const googleRequests = [];
    const supabaseRequests = [];
    page.on('request', req => {
      if (req.url().includes('script.google.com')) googleRequests.push(req);
      if (req.url().includes('supabase.co'))       supabaseRequests.push(req);
    });

    await loginAsStudent(page);
    await page.waitForTimeout(1000);

    expect(googleRequests.length).toBe(0);
    expect(supabaseRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('login payload includes student name and class code', async ({ page }) => {
    let loginPayload = null;
    page.on('request', req => {
      if (req.url().includes('supabase') && req.url().includes('/logins') && req.method() === 'POST') {
        try { loginPayload = JSON.parse(req.postData()); } catch {}
      }
    });

    await loginAsStudent(page, 'Sarjo Touray', 'HAMILTON');
    await page.waitForTimeout(1000);

    expect(loginPayload).not.toBeNull();
    expect(loginPayload.student).toBe('Sarjo Touray');
    expect(loginPayload.class_code).toBe('HAMILTON');
    expect(loginPayload.login_type).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// Submission Tracking
// ─────────────────────────────────────────────
test.describe('Submission Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nexterra_student.html');
    await clearState(page);
    // Mock Supabase so submissions don't fail in test env
    await page.route('**/rest/v1/**', route => route.fulfill({ status: 201, body: '[]' }));
    await page.reload();
  });

  test('POST submission goes to Supabase /submissions, not Google Sheets', async ({ page }) => {
    const submissionRequests = [];
    const googleRequests = [];
    page.on('request', req => {
      if (req.url().includes('supabase') && req.url().includes('/submissions') && req.method() === 'POST')
        submissionRequests.push(req);
      if (req.url().includes('script.google.com'))
        googleRequests.push(req);
    });

    await loginAsStudent(page);
    await page.evaluate(() => {
      window.ST.lesson = { id: 'test_id', title: 'Test Lesson', subject: 'Math', questions: [] };
      window.ST.answers = { 0: 'A', 1: 'B' };
      window.ST.timeTaken = '3m 00s';
      window.confirmSubmit();
    });
    await page.waitForTimeout(2000);

    expect(googleRequests.filter(r => r.method() === 'POST').length).toBe(0);
    expect(submissionRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('submission payload includes student, class_code, lesson, answers', async ({ page }) => {
    let submissionPayload = null;
    page.on('request', req => {
      if (req.url().includes('supabase') && req.url().includes('/submissions') && req.method() === 'POST') {
        try { submissionPayload = JSON.parse(req.postData()); } catch {}
      }
    });

    await loginAsStudent(page);
    await page.evaluate(() => {
      window.ST.lesson = { id: 'math_2025_p1', title: '2025 Math Practice 1', subject: 'Math', questions: [] };
      window.ST.answers = { 0: 'B', 1: 'C' };
      window.ST.timeTaken = '5m 30s';
      window.confirmSubmit();
    });
    await page.waitForTimeout(2000);

    expect(submissionPayload).not.toBeNull();
    expect(submissionPayload.student).toBeTruthy();
    expect(submissionPayload.class_code).toBeTruthy();
    expect(submissionPayload.lesson).toBeTruthy();
    expect(submissionPayload.answers).toBeDefined();
  });

  test('offline queue stores submission in localStorage when network fails', async ({ page }) => {
    // Override the beforeEach fulfillment route for submissions with an abort (LIFO wins)
    await page.route('**/rest/v1/submissions*', route => route.abort());
    await page.reload();

    await loginAsStudent(page);
    await page.evaluate(() => {
      window.ST.lesson = { id: 'offline_test', title: 'Offline Lesson', subject: 'Math', questions: [] };
      window.ST.answers = { 0: 'A' };
      window.ST.timeTaken = '1m 00s';
      window.confirmSubmit();
    });
    // Wait for 3 retry attempts (1s + 2s + buffer)
    await page.waitForTimeout(5000);

    const queue = await page.evaluate(() => {
      const raw = localStorage.getItem('nxt_offline_q');
      return raw ? JSON.parse(raw) : [];
    });
    expect(queue.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
// Teacher Dashboard
// ─────────────────────────────────────────────
test.describe('Teacher Dashboard - Supabase source', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nexterra_student.html');
    await clearState(page);
    // Stub Supabase responses for teacher dashboard tests
    await page.route('**/rest/v1/submissions*', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '1', student: 'Sarjo Touray', class_code: 'HAMILTON', lesson: '2025 Math Practice 1',
          correct: 24, total: 30, percent: 80, time_taken: '5m', submitted_at: new Date().toISOString() }
      ])
    }));
    await page.route('**/rest/v1/reopens*', route => route.fulfill({
      status: 200, contentType: 'application/json', body: '[]'
    }));
    await page.route('**/rest/v1/logins*', route => route.fulfill({
      status: 201, body: '[]'
    }));
    await page.reload();
  });

  test('teacher dashboard fetches from Supabase, not Google Sheets', async ({ page }) => {
    const googleRequests = [];
    const supabaseRequests = [];
    page.on('request', req => {
      if (req.url().includes('script.google.com')) googleRequests.push(req);
      if (req.url().includes('supabase.co') && req.url().includes('/submissions')) supabaseRequests.push(req);
    });

    // Login as teacher (PIN-based via teacher button)
    await page.evaluate(() => {
      if (typeof loadTeacher === 'function') loadTeacher();
    });
    await page.waitForTimeout(1500);

    expect(googleRequests.length).toBe(0);
    expect(supabaseRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('data source indicator shows Supabase, not "Google Sheets"', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof loadTeacher === 'function') loadTeacher();
    });
    await page.waitForTimeout(1500);

    const statsHtml = await page.locator('#teacher-stats').innerHTML().catch(() => '');
    const contentHtml = await page.locator('#teacher-content').innerHTML().catch(() => '');
    const combined = statsHtml + contentHtml;

    expect(combined).not.toContain('Google Sheets');
    expect(combined.toLowerCase()).toContain('supabase');
  });

  test('teacher dashboard renders submissions from Supabase data', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof loadTeacher === 'function') loadTeacher();
    });
    await page.waitForTimeout(1500);

    const content = await page.locator('#teacher-content').textContent().catch(() => '');
    expect(content).toContain('Sarjo Touray');
  });

  test('checkAndApplyReopens fetches from Supabase /reopens endpoint', async ({ page }) => {
    const reopenRequests = [];
    page.on('request', req => {
      if (req.url().includes('supabase') && req.url().includes('/reopens') && req.method() === 'GET')
        reopenRequests.push(req);
    });

    await loginAsStudent(page);
    await page.waitForTimeout(1500);

    expect(reopenRequests.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
// CONFIG shape
// ─────────────────────────────────────────────
test.describe('CONFIG shape', () => {
  test('CONFIG has supabase.url and supabase.anonKey, not sheetsUrl', async ({ page }) => {
    await page.goto('/nexterra_student.html');

    const config = await page.evaluate(() => ({
      hasSheetsUrl: !!window.CONFIG.sheetsUrl,
      hasSupabase:  !!(window.CONFIG.supabase && window.CONFIG.supabase.url && window.CONFIG.supabase.anonKey)
    }));

    expect(config.hasSheetsUrl).toBe(false);
    expect(config.hasSupabase).toBe(true);
  });
});
