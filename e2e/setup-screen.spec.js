const { test, expect } = require('@playwright/test');

test.describe('Setup Screen', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so we always see the setup screen
    await page.goto('/math_practice.html');
    await page.evaluate(() => {
      localStorage.removeItem('gn_math_profile');
      localStorage.removeItem('gn_math_progress');
    });
    await page.reload();
  });

  test('setup screen is visible on first visit', async ({ page }) => {
    const setup = page.locator('#scSetup');
    await expect(setup).toBeVisible();
    await expect(setup).toHaveClass(/active/);
  });

  test('start button is disabled until avatar and nickname are provided', async ({ page }) => {
    const btn = page.locator('#startButton');
    await expect(btn).toBeDisabled();

    // Pick avatar only — still disabled
    await page.locator('.avatar-button').first().click();
    await expect(btn).toBeDisabled();

    // Type nickname — now enabled
    await page.fill('#nicknameInput', 'TestKid');
    await expect(btn).toBeEnabled();
  });

  test('setup screen hides and dashboard shows after clicking Start Playing', async ({ page }) => {
    // Complete the setup form
    await page.locator('.avatar-button').first().click();
    await page.fill('#nicknameInput', 'TestKid');
    await page.locator('#startButton').click();

    // Setup screen must be hidden
    const setup = page.locator('#scSetup');
    await expect(setup).not.toBeVisible();

    // Dashboard screen must be visible
    const dashboard = page.locator('#scDashboard');
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toHaveClass(/active/);
  });

  test('profile is saved to localStorage after setup', async ({ page }) => {
    await page.locator('.avatar-button').first().click();
    await page.fill('#nicknameInput', 'TestKid');
    await page.locator('#startButton').click();

    const profile = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('gn_math_profile'))
    );
    expect(profile).toBeTruthy();
    expect(profile.nickname).toBe('TestKid');
    expect(profile.streak).toBe(0);
  });

  test('returning user skips setup and sees dashboard', async ({ page }) => {
    // Create a profile manually
    await page.evaluate(() => {
      localStorage.setItem('gn_math_profile', JSON.stringify({
        nickname: 'ReturnKid',
        avatar: '🦁',
        streak: 0,
        bestStreak: 0,
        sessionsCompleted: 0,
      }));
    });
    await page.reload();

    await expect(page.locator('#scSetup')).not.toBeVisible();
    await expect(page.locator('#scDashboard')).toBeVisible();
  });
});
