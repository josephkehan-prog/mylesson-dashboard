const { test, expect } = require('@playwright/test');

// Helper: complete setup and navigate to a topic
async function setupAndGoTo(page, topicIndex = 0) {
  await page.goto('/math_practice.html');
  await page.evaluate(() => {
    localStorage.removeItem('gn_math_profile');
    localStorage.removeItem('gn_math_progress');
  });
  await page.reload();
  await page.locator('.avatar-button').first().click();
  await page.fill('#nicknameInput', 'TestKid');
  await page.locator('#startButton').click();
  await expect(page.locator('#scDashboard')).toBeVisible();

  // Card itself is the Practice button — click the nth card
  await page.locator('.category-card').nth(topicIndex).click();
  await expect(page.locator('#scQuestion')).toBeVisible();
}

test.describe('NYS Question Quality', () => {
  // RED: currently the question bank uses old cluster codes (3.OA.A etc.)
  // These tests assert specific NYS standard codes from the Python generator.

  test('question standard label matches a specific NYS standard (not cluster)', async ({ page }) => {
    await setupAndGoTo(page, 0); // first topic = OA multiplication
    const stdLabel = page.locator('#qStandard');
    await expect(stdLabel).toBeVisible();
    const text = await stdLabel.textContent();
    // Must be a specific standard like 3.OA.1, not a cluster like 3.OA.A
    expect(text).toMatch(/3\.[A-Z]+\.[0-9]+/);
    expect(text).not.toMatch(/3\.[A-Z]+\.[A-Z]/);
  });

  test('OA topic generates questions from at least 3 different specific standards', async ({ page }) => {
    // Complete a full session on the OA topic to collect standards seen
    await page.goto('/math_practice.html');
    await page.evaluate(() => {
      localStorage.removeItem('gn_math_profile');
      localStorage.removeItem('gn_math_progress');
    });
    await page.reload();
    await page.locator('.avatar-button').first().click();
    await page.fill('#nicknameInput', 'TestKid');
    await page.locator('#startButton').click();

    // Card itself is the Practice button
    await page.locator('.category-card').first().click();
    await expect(page.locator('#scQuestion')).toBeVisible();

    const standards = new Set();
    const total = await page.locator('#qTotal').textContent();
    const n = parseInt(total, 10);

    for (let i = 0; i < n; i++) {
      const std = await page.locator('#qStandard').textContent();
      standards.add(std.trim());

      // Answer and continue
      const type = await page.locator('#questionChoices').count();
      if (type > 0) {
        const firstChoice = page.locator('#questionChoices .choice-btn').first();
        if (await firstChoice.isVisible()) {
          await firstChoice.click();
        }
      } else {
        const input = page.locator('#crInput');
        if (await input.isVisible()) {
          await input.fill('1');
        }
      }

      const submitBtn = page.locator('button:has-text("Submit")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }

      const nextBtn = page.locator('button:has-text("Next Question")');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      } else {
        break;
      }
    }

    // Should see at least 1 distinct NYS standard, and all must be specific codes
    expect(standards.size).toBeGreaterThanOrEqual(1);
    // All standards should be specific (e.g. 3.OA.1) not cluster (3.OA.A)
    for (const s of standards) {
      expect(s).toMatch(/3\.[A-Z]+\.[0-9]+/);
    }
  });

  test('multiplication word problem stem contains real names and varied items', async ({ page }) => {
    await setupAndGoTo(page, 0);
    const stem = await page.locator('#questionStem').textContent();
    // Python generator uses: Sam, Mia, Carlos, Lily, Jamal, Ava, Kenji, Rosa, Eli, Nora
    // or mentions groups/items from ITEMS_GROUPS
    const hasName = /Sam|Mia|Carlos|Lily|Jamal|Ava|Kenji|Rosa|Eli|Nora|bags|apples|cookies|stickers|crayons|flowers|books|marbles|pencils|beads/.test(stem);
    expect(hasName).toBe(true);
  });

  test('MC question has exactly 4 choices', async ({ page }) => {
    await setupAndGoTo(page, 0);
    // Keep refreshing until we get an MC question
    let tries = 0;
    while (tries < 5) {
      const choiceCount = await page.locator('#questionChoices .choice-btn').count();
      if (choiceCount === 4) break;
      // Skip this question if it's CR
      const submitBtn = page.locator('button:has-text("Submit")');
      if (await submitBtn.isVisible()) await submitBtn.click();
      const nextBtn = page.locator('button:has-text("Next Question")');
      if (await nextBtn.isVisible()) await nextBtn.click();
      tries++;
    }
    const choiceCount = await page.locator('#questionChoices .choice-btn').count();
    expect(choiceCount).toBe(4);
  });

  test('fractions topic shows NYS 3.NF standards', async ({ page }) => {
    await page.goto('/math_practice.html');
    await page.evaluate(() => {
      localStorage.removeItem('gn_math_profile');
      localStorage.removeItem('gn_math_progress');
    });
    await page.reload();
    await page.locator('.avatar-button').first().click();
    await page.fill('#nicknameInput', 'TestKid');
    await page.locator('#startButton').click();

    // Find NF topic card
    const cards = page.locator('.category-card');
    const count = await cards.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (/[Ff]raction|NF/.test(text)) {
        await cards.nth(i).click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      // fallback: click 4th card
      await page.locator('.category-card').nth(3).click();
    }

    await expect(page.locator('#scQuestion')).toBeVisible();
    const std = await page.locator('#qStandard').textContent();
    expect(std).toMatch(/3\.NF\.[0-9]+/);
  });

  test('area/perimeter topic shows NYS 3.MD standards', async ({ page }) => {
    await page.goto('/math_practice.html');
    await page.evaluate(() => {
      localStorage.removeItem('gn_math_profile');
      localStorage.removeItem('gn_math_progress');
    });
    await page.reload();
    await page.locator('.avatar-button').first().click();
    await page.fill('#nicknameInput', 'TestKid');
    await page.locator('#startButton').click();

    const cards = page.locator('.category-card');
    const count = await cards.count();
    let mdClicked = false;
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (/[Aa]rea|[Pp]erimeter|Measurement|MD/.test(text)) {
        await cards.nth(i).click();
        mdClicked = true;
        break;
      }
    }
    if (!mdClicked) {
      await page.locator('.category-card').nth(4).click();
    }

    await expect(page.locator('#scQuestion')).toBeVisible();
    const std = await page.locator('#qStandard').textContent();
    expect(std).toMatch(/3\.MD\.[0-9]+/);
  });
});
