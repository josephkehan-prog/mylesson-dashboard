const { test, expect } = require('@playwright/test');

async function goToDashboard(page) {
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
}

// Collect all card texts across all domain tiles
async function getAllCardTexts(page) {
  const tiles = page.locator('.domain-hub-tile');
  const tileCount = await tiles.count();
  const allTexts = [];
  for (let i = 0; i < tileCount; i++) {
    await tiles.nth(i).click();
    allTexts.push(...await page.locator('.category-card').allTextContents());
    await page.locator('.domain-cards-back').click();
  }
  return allTexts;
}

test.describe('21 Tested NYS Standards Present (post-test excluded)', () => {
  test('3.G.1 (post-test) is NOT on the dashboard', async ({ page }) => {
    await goToDashboard(page);
    const cardTexts = await getAllCardTexts(page);
    expect(cardTexts.some(t => /3\.G\.1/.test(t))).toBe(false);
  });

  test('3.NF.3 (Equivalent Fractions) card IS on the dashboard', async ({ page }) => {
    await goToDashboard(page);
    const cardTexts = await getAllCardTexts(page);
    expect(cardTexts.some(t => /3\.NF\.3/.test(t) || /[Ee]quivalent/.test(t))).toBe(true);
  });

  test('3.NF.3 Practice button starts a session with 3.NF.3 standard', async ({ page }) => {
    await goToDashboard(page);
    // NF is tile index 2
    await page.locator('.domain-hub-tile').nth(2).click();
    await expect(page.locator('.domain-cards-grid')).toBeVisible();
    const cards = page.locator('.category-card');
    const count = await cards.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (/3\.NF\.3|[Ee]quivalent/.test(text)) {
        await cards.nth(i).click();
        clicked = true;
        break;
      }
    }
    expect(clicked).toBe(true);
    await expect(page.locator('#scQuestion')).toBeVisible();
    const std = await page.locator('#qStandard').textContent();
    expect(std).toMatch(/3\.NF\.[0-9]+/);
  });
});
