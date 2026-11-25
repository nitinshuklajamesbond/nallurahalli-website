const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

async function runAudit() {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'nallurahalli-audit-'));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: '3456' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve);
      server.once('error', reject);
      server.once('exit', code => reject(new Error(`Server exited: ${code}`)));
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith('http://localhost:3456/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    const url = 'http://localhost:3456/2km-loop.html';
    for (const name of ['index', 'whereabouts', 'updates', 'sources', 'about', '2km-loop']) {
      assert.equal((await page.goto(`http://localhost:3456/${name}.html`)).status(), 200);
    }
    const visiblePhase = async phase => {
      assert.deepEqual(await page.locator('.phase-panel:visible').evaluateAll(nodes => nodes.map(node => node.id)), [`phase-${phase}`]);
      assert.equal(await page.locator(`#tab-${phase}`).getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('.phase-tab[tabindex="0"]').count(), 1);
    };
    await visiblePhase(2);
    assert.equal(await page.locator('.fund-progress-wrap').isHidden(), true);
    await page.locator('.map-card img').scrollIntoViewIfNeeded();
    await page.locator('.map-card img').evaluate(node => node.decode());
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
    for (const phase of [1, 3, 4, 2]) {
      await page.locator(`#tab-${phase}`).click();
      await visiblePhase(phase);
    }
    await page.locator('#tab-2').focus();
    for (const [key, phase] of [['ArrowRight', 3], ['End', 4], ['ArrowRight', 1], ['ArrowLeft', 4], ['Home', 1]]) {
      await page.keyboard.press(key);
      await visiblePhase(phase);
      assert.equal(await page.locator(`#tab-${phase}`).evaluate(node => node === document.activeElement), true);
    }
    await page.locator('.phase-step[data-goto-phase="2"]').click();
    await visiblePhase(2);
    await page.locator('.phase-link[data-goto-phase="3"]').click();
    await visiblePhase(3);
    for (const phase of [1, 2, 3, 4]) {
      await page.locator(`#tab-${phase}`).click();
      for (const image of await page.locator(`#phase-${phase} img`).all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(node => node.decode());
      }
      for (const slider of await page.locator(`#phase-${phase} .compare-slider-input`).all()) {
        for (const value of ['25', '75']) {
          await slider.fill(value);
          assert.equal(await slider.evaluate(node => node.closest('.compare-box').querySelector('.compare-overlay').style.width), `${value}%`);
        }
        const widths = await slider.evaluate(node => {
          const box = node.closest('.compare-box');
          return [box.offsetWidth, box.querySelector('.compare-overlay img').offsetWidth];
        });
        assert.equal(widths[0], widths[1]);
      }
    }
    await page.locator('#tab-2').click();
    await page.locator('.nav-menu .lang-btn').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'kn');
    assert.equal(await page.locator('.page-hero-title').textContent(), await page.locator('.page-hero-title').getAttribute('data-kn'));
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'kn');
    await page.locator('.nav-menu .lang-btn').click();
    await page.locator('.faq summary').first().click();
    assert.equal(await page.locator('.faq details').first().getAttribute('open'), '');

    // Exercise confirmed, zero, invalid and over-target donations before initialization.
    for (const [raised, goal, width] of [['0', '3070000', '0%'], ['1535000', '3070000', '50%'], ['4000000', '3070000', '100%'], ['oops', '3070000', null], ['-1', '3070000', null], ['10', '0', null]]) {
      await page.route('**/2km-loop.html', async route => {
        const html = fs.readFileSync(path.join(__dirname, '2km-loop.html'), 'utf8').replace('data-goal="3070000" data-raised=""', `data-goal="${goal}" data-raised="${raised}"`);
        await route.fulfill({ contentType: 'text/html', body: html });
      });
      await page.goto(url);
      assert.equal(await page.locator('.fund-progress-wrap').isVisible(), width !== null);
      if (width !== null) assert.equal(await page.locator('.fund-progress-fill').evaluate(node => node.style.width), width);
      await page.unroute('**/2km-loop.html');
    }
    await page.goto(url);
    const links = await page.locator('a[href], link[rel="stylesheet"], script[src], img, video[poster], source').evaluateAll(nodes => nodes.flatMap(node => ['href', 'src', 'poster'].map(key => node.getAttribute(key)).filter(value => value && !/^(https?:|data:)/.test(value))));
    for (const link of new Set(links)) {
      const target = new URL(link, url);
      assert.equal((await page.request.get(target.href)).status(), 200, link);
      if (target.hash) assert.equal(await page.locator(target.hash).count(), 1, link);
    }
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      for (const phase of [1, 2, 3, 4]) {
        await page.locator(`#tab-${phase}`).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px, phase ${phase}`);
      }
      if (width === 390) {
        await page.locator('#tab-2').click();
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        await page.locator('.mobile-toggle').click();
        assert.equal(await page.locator('.mobile-drawer').evaluate(node => node.classList.contains('open')), true);
        await page.locator('.mobile-drawer-close').click();
        assert.equal(await page.locator('.mobile-drawer').evaluate(node => node.classList.contains('open')), false);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: page smoke checks, phase navigation/keyboard, comparisons/images, language, FAQ, fundraising, local links, mobile drawer and responsive widths. Screenshots: ${output}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

runAudit().catch(error => { console.error(error); process.exitCode = 1; });
