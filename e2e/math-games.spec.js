const { test, expect } = require('@playwright/test');

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

// Opens first domain tile (OA) so standard cards are visible
async function openFirstDomain(page) {
  await page.locator('.domain-hub-tile').first().click();
  await expect(page.locator('.domain-cards-grid')).toBeVisible();
}

// Opens a domain by index, returns to hub after use
async function openDomainByIndex(page, idx) {
  await page.locator('.domain-hub-tile').nth(idx).click();
  await expect(page.locator('.domain-cards-grid')).toBeVisible();
}

// Find and launch game for a standard code across all domains
async function launchGameForStandard(page, code) {
  const tiles = page.locator('.domain-hub-tile');
  const tileCount = await tiles.count();
  for (let t = 0; t < tileCount; t++) {
    await tiles.nth(t).click();
    const cards = page.locator('.category-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text.includes(code)) {
        await cards.nth(i).locator('button:has-text("Game")').click();
        return;
      }
    }
    await page.locator('.domain-cards-back').click();
  }
}

test.describe('Anchor Charts', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    await openFirstDomain(page);
  });

  test('anchor chart modal opens when Help button is clicked', async ({ page }) => {
    const chartBtn = page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")');
    await expect(chartBtn).toBeVisible();
    await chartBtn.click();
    await expect(page.locator('#anchorOverlay')).toBeVisible();
    await expect(page.locator('.anchor-card')).toBeVisible();
    await expect(page.locator('.anchor-card-title')).toBeVisible();
  });

  test('anchor chart displays vocabulary tags', async ({ page }) => {
    await page.locator('.category-card').first().locator('.category-action-btn:has-text("Help")').click();
    const tags = page.locator('.anchor-vocab-tag');
    expect(await tags.count()).toBeGreaterThan(0);
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
    await page.locator('#anchorOverlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#anchorOverlay')).toBeHidden();
  });
});

test.describe('Dashboard Cards', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    await openFirstDomain(page);
  });

  test('each standard card is tappable and has Help and Game action buttons', async ({ page }) => {
    const firstCard = page.locator('.category-card').first();
    await expect(firstCard.locator('.category-action-btn:has-text("Help")')).toBeVisible();
    await expect(firstCard.locator('.category-action-btn:has-text("Game")')).toBeVisible();
    const tagName = await firstCard.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('button');
  });
});

test.describe('Game Screen', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    await openFirstDomain(page);
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
    expect(await dots.count()).toBe(5);
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
    // OA is the first domain — 3.OA.1 is first card
    await openFirstDomain(page);
  });

  test('array builder renders clickable grid cells', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    const cells = page.locator('.array-cell');
    expect(await cells.count()).toBeGreaterThan(0);
  });

  test('clicking array cells toggles filled state', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    const cell = page.locator('.array-cell').first();
    await cell.click();
    await expect(cell).toHaveClass(/filled/);
    await cell.click();
    await expect(cell).not.toHaveClass(/filled/);
  });
});

test.describe('Fraction Pizza Game (3.NF.1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    // NF is the 3rd domain tile (index 2)
    await openDomainByIndex(page, 2);
  });

  test('fraction pizza renders SVG with clickable slices', async ({ page }) => {
    // 3.NF.1 is the first card in the NF domain
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('.pizza-svg')).toBeVisible();
    expect(await page.locator('.pizza-slice').count()).toBeGreaterThan(0);
  });

  test('clicking pizza slices toggles shading', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    const slice = page.locator('.pizza-slice').first();
    await slice.click();
    await expect(slice).toHaveClass(/filled/);
  });
});

test.describe('Clock Challenge Game (3.MD.1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    // MD is the 4th domain tile (index 3)
    await openDomainByIndex(page, 3);
  });

  test('clock challenge renders clock SVG and controls', async ({ page }) => {
    // 3.MD.1 is the first card in the MD domain
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    await expect(page.locator('#scGame')).toHaveClass(/active/);
    await expect(page.locator('.clock-svg')).toBeVisible();
    await expect(page.locator('.clock-controls')).toBeVisible();
    await expect(page.locator('#clockDisplay')).toBeVisible();
  });

  test('hour and minute buttons adjust the clock display', async ({ page }) => {
    await page.locator('.category-card').first().locator('button:has-text("Game")').click();
    const display = page.locator('#clockDisplay');
    const initial = await display.textContent();
    await page.locator('.clock-adj-btn').nth(3).click();
    const afterHour = await display.textContent();
    expect(afterHour).not.toBe(initial);
  });
});

test.describe('Practice Mode Still Works', () => {
  test.beforeEach(async ({ page }) => {
    await setupProfile(page);
    await openFirstDomain(page);
  });

  test('tapping a card launches question screen', async ({ page }) => {
    await page.locator('.category-card').first().click();
    await expect(page.locator('#scQuestion')).toHaveClass(/active/);
    await expect(page.locator('#questionStem')).toBeVisible();
  });
});
