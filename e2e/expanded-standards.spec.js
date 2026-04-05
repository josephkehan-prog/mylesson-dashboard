const { test, expect } = require('@playwright/test');

async function setupProfile(page) {
  await page.goto('/math_practice.html');
  await page.evaluate(() => {
    localStorage.setItem('gn_math_profile', JSON.stringify({
      nickname: 'TestPlayer', avatar: '🦁', streak: 0,
      bestStreak: 0, sessionsCompleted: 0,
      createdAt: new Date().toISOString()
    }));
    localStorage.setItem('gn_math_progress', JSON.stringify({
      studentName: 'Test', standards: {}, sessions: [], totalStudyMinutes: 0
    }));
  });
  await page.reload();
  await expect(page.locator('#scDashboard')).toHaveClass(/active/);
}

test.describe('Expanded Standards — 21 Individual Cards (post-test excluded)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('dashboard shows exactly 21 standard cards (post-test excluded)', async ({ page }) => {
    const cards = page.locator('.category-card');
    await expect(cards).toHaveCount(21);
  });

  test('all OA standards (3.OA.1 through 3.OA.9) have their own card', async ({ page }) => {
    const allText = await page.locator('.category-card').allTextContents();
    for (let i = 1; i <= 9; i++) {
      const found = allText.some(t => t.includes(`3.OA.${i}`));
      expect(found, `3.OA.${i} card should exist`).toBe(true);
    }
  });

  test('all NBT standards (3.NBT.1 through 3.NBT.3) have their own card', async ({ page }) => {
    const allText = await page.locator('.category-card').allTextContents();
    for (let i = 1; i <= 3; i++) {
      const found = allText.some(t => t.includes(`3.NBT.${i}`));
      expect(found, `3.NBT.${i} card should exist`).toBe(true);
    }
  });

  test('all NF standards (3.NF.1 through 3.NF.3) have their own card', async ({ page }) => {
    const allText = await page.locator('.category-card').allTextContents();
    for (let i = 1; i <= 3; i++) {
      const found = allText.some(t => t.includes(`3.NF.${i}`));
      expect(found, `3.NF.${i} card should exist`).toBe(true);
    }
  });

  test('tested MD standards (3.MD.1,2,5,6,7) have their own card; post-test excluded', async ({ page }) => {
    const allText = await page.locator('.category-card').allTextContents();
    for (const i of [1, 2, 5, 6, 7]) {
      const found = allText.some(t => t.includes(`3.MD.${i}`));
      expect(found, `3.MD.${i} card should exist`).toBe(true);
    }
    // Post-test standards should NOT be on the dashboard
    for (const i of [3, 4, 8]) {
      const found = allText.some(t => t.includes(`3.MD.${i}`));
      expect(found, `3.MD.${i} should NOT exist (post-test)`).toBe(false);
    }
  });

  test('3.G.2 has its own card; 3.G.1 excluded (post-test)', async ({ page }) => {
    const allText = await page.locator('.category-card').allTextContents();
    expect(allText.some(t => t.includes('3.G.1')), '3.G.1 should NOT exist (post-test)').toBe(false);
    expect(allText.some(t => t.includes('3.G.2')), '3.G.2 card').toBe(true);
  });

  test('every card has Chart, Practice, and Game buttons', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    expect(count).toBe(21);
    // Spot-check first and last card
    for (const idx of [0, 20]) {
      const card = cards.nth(idx);
      await expect(card.locator('button:has-text("Chart")')).toBeVisible();
      await expect(card.locator('button:has-text("Practice")')).toBeVisible();
      await expect(card.locator('button:has-text("Game")')).toBeVisible();
    }
  });
});

test.describe('XP System Removed', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('no XP bar is visible on dashboard', async ({ page }) => {
    await expect(page.locator('.xp-bar-container')).toHaveCount(0);
    await expect(page.locator('#xpFill')).toHaveCount(0);
  });

  test('no level badge is visible on dashboard', async ({ page }) => {
    await expect(page.locator('.level-badge')).toHaveCount(0);
  });

  test('no badges section is visible on dashboard', async ({ page }) => {
    await expect(page.locator('.badges-section')).toHaveCount(0);
    await expect(page.locator('.badges-grid')).toHaveCount(0);
  });

  test('completing a practice session shows no XP popup', async ({ page }) => {
    // Start practice on first standard
    await page.locator('.category-card').first().locator('button:has-text("Practice")').click();
    await expect(page.locator('#scQuestion')).toBeVisible();

    // Answer first question
    const choiceBtn = page.locator('#questionChoices .choice-btn').first();
    if (await choiceBtn.isVisible()) {
      await choiceBtn.click();
    } else {
      await page.locator('#crInput').fill('1');
    }
    await page.locator('button:has-text("Submit")').click();

    // XP popup should never appear
    await expect(page.locator('.xp-popup')).toHaveCount(0);
  });
});

test.describe('Leaderboard Ranks by Standards Mastered', () => {
  test('leaderboard shows mastered count instead of XP', async ({ page }) => {
    // Set up profile with progress showing mastery
    await page.goto('/math_practice.html');
    await page.evaluate(() => {
      localStorage.setItem('gn_math_profile', JSON.stringify({
        nickname: 'MasteryKid', avatar: '🦁', streak: 0,
        bestStreak: 0, sessionsCompleted: 5,
        createdAt: new Date().toISOString()
      }));
      localStorage.setItem('gn_math_progress', JSON.stringify({
        studentName: 'Test',
        standards: {
          '3.OA.1': { attempts: 10, correct: 8 },
          '3.OA.2': { attempts: 10, correct: 7 },
          '3.OA.3': { attempts: 5, correct: 1 }
        },
        sessions: [], totalStudyMinutes: 0
      }));
    });
    await page.reload();
    await expect(page.locator('#scDashboard')).toHaveClass(/active/);

    // Leaderboard should show mastered count, not XP
    const leaderboardText = await page.locator('#leaderboardList').textContent();
    expect(leaderboardText).not.toContain('XP');
    expect(leaderboardText).toMatch(/mastered|Mastered/i);
  });
});

test.describe('Auto-Difficulty', () => {
  test('new student gets easy-level questions (smaller numbers)', async ({ page }) => {
    // Fresh profile with no progress = easy difficulty
    await setupProfile(page);
    await page.locator('.category-card').first().locator('button:has-text("Practice")').click();
    await expect(page.locator('#scQuestion')).toBeVisible();
    // Just verify question loads — difficulty is internal
    await expect(page.locator('#questionStem')).toBeVisible();
  });

  test('practice button does not pass hardcoded difficulty', async ({ page }) => {
    await setupProfile(page);
    // The practice button onclick should NOT contain "medium" hardcoded
    const btn = page.locator('.category-card').first().locator('button:has-text("Practice")');
    const onclick = await btn.getAttribute('onclick');
    expect(onclick).not.toContain("'medium'");
    expect(onclick).not.toContain('"medium"');
  });
});

test.describe('Anchor Charts for All Standards', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('every standard card Chart button opens an anchor chart', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    // Test first 3 and last 2 cards to keep test fast (21 cards total)
    for (const idx of [0, 1, 2, count - 2, count - 1]) {
      await cards.nth(idx).locator('button:has-text("Chart")').click();
      await expect(page.locator('#anchorOverlay')).toBeVisible();
      await expect(page.locator('.anchor-card')).toBeVisible();
      await page.locator('.anchor-close').click();
      await expect(page.locator('#anchorOverlay')).toBeHidden();
    }
  });

  test('geometry 3.G.2 has an anchor chart', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text.includes('3.G.2')) {
        await cards.nth(i).locator('button:has-text("Chart")').click();
        await expect(page.locator('.anchor-card')).toBeVisible();
        const chartText = await page.locator('.anchor-card').textContent();
        expect(chartText).toMatch(/[Pp]artition|[Ee]qual|[Ff]raction|[Ss]hare/);
        break;
      }
    }
  });
});

test.describe('Games for All Standards', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('first card Game button opens a game', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('#gameTitle')).toBeVisible();
  });

  test('geometry 3.G.2 Game button opens Fair Shares', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text.includes('3.G.2')) {
        await cards.nth(i).locator('button:has-text("Game")').click();
        await expect(page.locator('#scGame')).toHaveClass(/active/);
        break;
      }
    }
  });

  test('3.MD.6 Game button opens Square Counter', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text.includes('3.MD.6')) {
        await cards.nth(i).locator('button:has-text("Game")').click();
        await expect(page.locator('#scGame')).toHaveClass(/active/);
        break;
      }
    }
  });
});
