const { test, expect } = require('@playwright/test');

// Helper: set up a profile so we skip the setup screen and go straight to dashboard
async function setupProfile(page) {
  await page.goto('/math_practice.html');
  await page.evaluate(() => {
    localStorage.setItem('gn_math_profile', JSON.stringify({
      nickname: 'TestPlayer', avatar: '🦁', xp: 50, streak: 0,
      bestStreak: 0, badges: [], sessionsCompleted: 0,
      createdAt: new Date().toISOString()
    }));
    localStorage.setItem('gn_math_progress', JSON.stringify({
      studentName: 'Test', standards: {}, sessions: [], totalStudyMinutes: 0
    }));
  });
  await page.reload();
  await expect(page.locator('#scDashboard')).toHaveClass(/active/);
}

test.describe('Anchor Charts', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('anchor chart modal opens when Help button is clicked', async ({ page }) => {
    const chartBtn = page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")');
    await expect(chartBtn).toBeVisible();
    await chartBtn.click();

    const overlay = page.locator('#anchorOverlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('.anchor-card')).toBeVisible();
    await expect(page.locator('.anchor-card-title')).toBeVisible();
  });

  test('anchor chart displays vocabulary tags', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    const tags = page.locator('.anchor-vocab-tag');
    const count = await tags.count();
    expect(count).toBeGreaterThan(0);
  });

  test('anchor chart displays SVG visual', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    await expect(page.locator('.anchor-visual svg')).toBeVisible();
  });

  test('anchor chart displays example and remember sections', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    await expect(page.locator('.anchor-example')).toBeVisible();
    await expect(page.locator('.anchor-remember')).toBeVisible();
  });

  test('anchor chart closes when X button is clicked', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    await expect(page.locator('.anchor-card')).toBeVisible();
    await page.locator('.anchor-close').click();
    await expect(page.locator('#anchorOverlay')).toBeHidden();
  });

  test('anchor chart closes when clicking overlay background', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    await expect(page.locator('.anchor-card')).toBeVisible();
    // Click on the overlay itself, not the card
    await page.locator('#anchorOverlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#anchorOverlay')).toBeHidden();
  });
});

test.describe('Dashboard Cards', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('each standard card is tappable and has Help and Game action buttons', async ({ page }) => {
    const cards = page.locator('.category-card');
    const count = await cards.count();
    expect(count).toBe(21);

    // Check the first card has Help and Game action buttons; card itself is the Practice button
    const firstCard = cards.first();
    await expect(firstCard.locator('.category-action-btn:has-text("Help")')).toBeVisible();
    await expect(firstCard.locator('.category-action-btn:has-text("Game")')).toBeVisible();
    // Card itself should be a button (tap to practice)
    const tagName = await firstCard.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('button');
  });
});

test.describe('Game Screen', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('game screen loads when Game button is clicked', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('#gameTitle')).toBeVisible();
    await expect(page.locator('.game-area')).toBeVisible();
  });

  test('game displays round counter and score bar', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#gameRound')).toHaveText('1');
    await expect(page.locator('#gameTotalRounds')).toHaveText('5');
    const dots = page.locator('.game-score-dot');
    const count = await dots.count();
    expect(count).toBe(5);
  });

  test('back button returns to dashboard from game', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await page.locator('#scGame .btn-ghost').click();
    await expect(page.locator('#scDashboard')).toHaveClass(/active/);
  });
});

test.describe('Array Builder Game (3.OA.1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('array builder renders clickable grid cells', async ({ page }) => {
    // Click the first card's game button (3.OA.1)
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    const cells = page.locator('.array-cell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking array cells toggles filled state', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    const cell = page.locator('.array-cell').first();
    await cell.click();
    await expect(cell).toHaveClass(/filled/);
    // Click again to unfill
    await cell.click();
    await expect(cell).not.toHaveClass(/filled/);
  });
});

test.describe('Fraction Pizza Game (3.NF.1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('fraction pizza renders SVG with clickable slices', async ({ page }) => {
    // 3.NF.1 is the 13th standard card (0-indexed: 12)
    await page.locator('.category-card').nth(12).locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('.pizza-svg')).toBeVisible();
    const slices = page.locator('.pizza-slice');
    const count = await slices.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking pizza slices toggles shading', async ({ page }) => {
    await page.locator('.category-card').nth(12).locator('button:has-text("Game")').click();
    const slice = page.locator('.pizza-slice').first();
    await slice.click();
    await expect(slice).toHaveClass(/filled/);
  });
});

test.describe('Clock Challenge Game (3.MD.1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('clock challenge renders clock SVG and controls', async ({ page }) => {
    // 3.MD.1 is the 16th standard card (0-indexed: 15)
    await page.locator('.category-card').nth(15).locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('.clock-svg')).toBeVisible();
    await expect(page.locator('.clock-controls')).toBeVisible();
    await expect(page.locator('#clockDisplay')).toBeVisible();
  });

  test('hour and minute buttons adjust the clock display', async ({ page }) => {
    await page.locator('.category-card').nth(15).locator('button:has-text("Game")').click();
    const display = page.locator('#clockDisplay');
    const initial = await display.textContent();

    // Click the hour forward button
    await page.locator('.clock-adj-btn').nth(3).click();
    const afterHour = await display.textContent();
    expect(afterHour).not.toBe(initial);
  });
});

test.describe('Practice Mode Still Works', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
  });

  test('tapping a card launches question screen', async ({ page }) => {
    // Card itself is the Practice button — click the card body (not action buttons)
    await page.locator('.category-card').first().click();
    await expect(page.locator('#scQuestion')).toHaveClass(/active/);
    await expect(page.locator('#questionStem')).toBeVisible();
  });
});
