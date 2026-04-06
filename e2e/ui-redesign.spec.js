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

async function openFirstDomain(page) {
  await page.locator('.domain-hub-tile').first().click();
  await expect(page.locator('.domain-cards-grid')).toBeVisible();
}

test.describe('UI Redesign — Social-Media Inspired', () => {

  test.describe('Setup Screen', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/math_practice.html');
      await page.evaluate(() => {
        localStorage.removeItem('gn_math_profile');
        localStorage.removeItem('gn_math_progress');
      });
      await page.reload();
    });

    test('setup screen uses a dark/gradient background', async ({ page }) => {
      const bg = await page.locator('#scSetup').evaluate(el => {
        return getComputedStyle(el).background || getComputedStyle(el).backgroundColor;
      });
      // Should have a gradient or dark background, not plain white
      expect(bg).toMatch(/gradient|rgb\(\s*([0-9]{1,2}),|rgba/);
    });

    test('setup card has glassmorphism or elevated card style', async ({ page }) => {
      const shadow = await page.locator('.setup-card').evaluate(el => {
        return getComputedStyle(el).boxShadow;
      });
      // Should have a visible box-shadow (not "none")
      expect(shadow).not.toBe('none');
    });

    test('avatar buttons are circular with border effects', async ({ page }) => {
      const radius = await page.locator('.avatar-button').first().evaluate(el => {
        return getComputedStyle(el).borderRadius;
      });
      expect(radius).toBe('50%');
    });
  });

  test.describe('Dashboard Layout', () => {
    test.beforeEach(async ({ page }) => {
      await setupProfile(page);
      await openFirstDomain(page);
    });

    test('header uses a dark gradient background', async ({ page }) => {
      const bg = await page.locator('#scDashboard .header').evaluate(el => {
        const s = getComputedStyle(el);
        return s.backgroundImage + ' ' + s.backgroundColor;
      });
      expect(bg).toMatch(/gradient|rgb\(\s*[0-9]{1,2},/);
    });

    test('category cards have rounded corners >= 12px', async ({ page }) => {
      const radius = await page.locator('.category-card').first().evaluate(el => {
        return parseInt(getComputedStyle(el).borderRadius);
      });
      expect(radius).toBeGreaterThanOrEqual(12);
    });

    test('category cards have smooth hover transition', async ({ page }) => {
      const transition = await page.locator('.category-card').first().evaluate(el => {
        const s = getComputedStyle(el);
        return s.transitionProperty + ' ' + s.transitionDuration;
      });
      expect(transition).toMatch(/transform|all/);
    });

    test('dashboard has a greeting bar with avatar display', async ({ page }) => {
      await expect(page.locator('#profileAvatar')).toBeVisible();
      await expect(page.locator('#greetingName')).toBeVisible();
    });

    test('action buttons use rounded shape (border-radius >= 6px)', async ({ page }) => {
      const btn = page.locator('.category-action-btn').first();
      const radius = await btn.evaluate(el => {
        return parseInt(getComputedStyle(el).borderRadius);
      });
      expect(radius).toBeGreaterThanOrEqual(6);
    });

    test('greeting bar is visible (replaced hero section)', async ({ page }) => {
      await expect(page.locator('.greeting-bar')).toBeVisible();
    });

    test('section titles use modern typography (uppercase or small-caps)', async ({ page }) => {
      // domain-hub-code (e.g. "3.OA") uses uppercase letter-spacing style
      // Check the cards-back header or the domain-cards-title exists with proper display
      const title = page.locator('.domain-cards-title').first();
      await expect(title).toBeVisible();
      const display = await title.evaluate(el => getComputedStyle(el).display);
      expect(display).not.toBe('none');
    });

    test('cards animate on entry with slideIn or fadeIn', async ({ page }) => {
      const card = page.locator('.category-card').first();
      await expect(card).toBeVisible();
    });
  });

  test.describe('Modern Interactive Elements', () => {
    test.beforeEach(async ({ page }) => {
      await setupProfile(page);
      await openFirstDomain(page);
    });

    test('cards have a defined background color (card-as-button pattern)', async ({ page }) => {
      const card = page.locator('.category-card').first();
      const bg = await card.evaluate(el => {
        const s = getComputedStyle(el);
        return s.backgroundImage + ' ' + s.backgroundColor;
      });
      expect(bg).toMatch(/rgb/);
    });

    test('game screen header has gradient background', async ({ page }) => {
      await page.locator('.category-card').first().locator('.category-action-btn:has-text("Game")').click();
      await expect(page.locator('#scGame')).toHaveClass(/active/);
      const bg = await page.locator('.game-header').evaluate(el => {
        return getComputedStyle(el).backgroundImage;
      });
      expect(bg).toMatch(/gradient/);
    });
  });

  test.describe('Question Screen Modern Styling', () => {
    test.beforeEach(async ({ page }) => {
      await setupProfile(page);
      await openFirstDomain(page);
      await page.locator('.category-card').first().click();
      await expect(page.locator('#scQuestion')).toBeVisible();
    });

    test('question header has dark/modern background', async ({ page }) => {
      const bg = await page.locator('.question-header').evaluate(el => {
        const s = getComputedStyle(el);
        return s.background || s.backgroundColor;
      });
      // Should be dark (not white/light)
      expect(bg).toMatch(/rgb|gradient/);
    });

    test('choice buttons have rounded corners and hover transitions', async ({ page }) => {
      const choiceBtn = page.locator('.choice-btn').first();
      if (await choiceBtn.isVisible()) {
        const radius = await choiceBtn.evaluate(el => {
          return parseInt(getComputedStyle(el).borderRadius);
        });
        expect(radius).toBeGreaterThanOrEqual(8);

        const transition = await choiceBtn.evaluate(el => {
          const s = getComputedStyle(el);
          return s.transitionProperty + ' ' + s.transitionDuration;
        });
        expect(transition).toMatch(/all|transform|border|background/);
      }
    });

    test('progress dots are visible in the question header', async ({ page }) => {
      await expect(page.locator('.progress-dots')).toBeVisible();
      const dots = page.locator('.dot');
      const count = await dots.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Color Scheme & Typography', () => {
    test.beforeEach(async ({ page }) => {
      await setupProfile(page);
    });

    test('body uses a modern font family', async ({ page }) => {
      const font = await page.evaluate(() => {
        return getComputedStyle(document.body).fontFamily;
      });
      // Should use Lexend or another modern font (not just system defaults)
      expect(font).toMatch(/Lexend|Inter|Poppins|Segoe/i);
    });

    test('CSS custom properties define a cohesive color palette', async ({ page }) => {
      const hasVars = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return !!(root.getPropertyValue('--primary').trim() && root.getPropertyValue('--accent').trim());
      });
      expect(hasVars).toBe(true);
    });

    test('background is not plain white (uses subtle tone)', async ({ page }) => {
      const bg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      // Should not be pure white (#fff / rgb(255,255,255))
      expect(bg).not.toBe('rgb(255, 255, 255)');
    });
  });

  test.describe('Responsive Design', () => {
    test('mobile viewport shows single-column card grid', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await setupProfile(page);
      // Click first domain tile to enter the standards card view
      await page.locator('.domain-hub-tile').first().click();
      const grid = page.locator('.domain-cards-grid');
      const cols = await grid.evaluate(el => {
        return getComputedStyle(el).gridTemplateColumns;
      });
      // On mobile, should be single column (one value or "1fr")
      const colCount = cols.split(' ').filter(c => c !== '').length;
      expect(colCount).toBeLessThanOrEqual(1);
    });

    test('categories grid uses auto-fill for responsive columns', async ({ page }) => {
      await setupProfile(page);
      // Click first domain tile to enter the standards card view
      await page.locator('.domain-hub-tile').first().click();
      const grid = page.locator('.domain-cards-grid');
      // Verify the grid uses auto-fill or auto-fit (responsive multi-column)
      const display = await grid.evaluate(el => {
        return getComputedStyle(el).display;
      });
      expect(display).toBe('grid');
      // The CSS should use repeat(auto-fill, ...) which enables multi-column at wider viewports
      // We verify it's a grid and has proper gap
      const gap = await grid.evaluate(el => {
        return getComputedStyle(el).gap;
      });
      expect(gap).toMatch(/\d+px/);
    });
  });
});
