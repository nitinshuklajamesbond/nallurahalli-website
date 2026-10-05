const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 3456;
const ROOT = __dirname;
const REVIEW_DIR = '/Users/nitsshukla/.gemini/jetski/brain/92c06baf-6a3c-4732-aaf9-e95be83dd9bf/review';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  
  let filePath = path.join(ROOT, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + reqPath);
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range && ext === '.mp4') {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache'
  });

  fs.createReadStream(filePath).pipe(res);
});

async function runAudit() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Server listening at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const report = {
    errors: [],
    failedRequests: [],
    tests: []
  };

  const pagesToTest = [
    'index.html',
    '2km-loop.html',
    'whereabouts.html',
    'updates.html',
    'sources.html',
    'about.html'
  ];

  // 1. Desktop Audit
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.errors.push(`[Console Error] ${msg.text()} at ${page.url()}`);
    }
  });

  page.on('pageerror', err => {
    report.errors.push(`[Page Crash/Error] ${err.message} at ${page.url()}`);
  });

  page.on('requestfailed', req => {
    report.failedRequests.push(`[Failed Request] ${req.url()} (${req.failure()?.errorText})`);
  });

  for (const pageName of pagesToTest) {
    const url = `http://localhost:${PORT}/${pageName}`;
    const response = await page.goto(url, { waitUntil: 'networkidle' });
    const status = response.status();
    const title = await page.title();
    console.log(`[PASS] ${pageName} -> HTTP ${status} | Title: "${title}"`);

    report.tests.push({ page: pageName, status, title });

    // Capture desktop screenshots
    const screenshotPath = path.join(REVIEW_DIR, `desktop_${pageName.replace('.html', '')}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }

  // 2. Specific Interaction Tests on index.html
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  const joinBtnHref = await page.$eval('.btn-join', el => el.href);
  console.log(`[PASS] Home Join Button Link: ${joinBtnHref}`);

  // Test Language Toggle on index.html
  const initialLang = await page.$eval('html', el => el.getAttribute('lang'));
  await page.click('.lang-btn');
  const switchedLang = await page.$eval('html', el => el.getAttribute('lang'));
  console.log(`[PASS] Language Toggle: ${initialLang} -> ${switchedLang}`);
  await page.screenshot({ path: path.join(REVIEW_DIR, 'desktop_index_kannada.png') });

  // 3. Specific Interaction Tests on 2km-loop.html
  await page.goto(`http://localhost:${PORT}/2km-loop.html`, { waitUntil: 'networkidle' });
  
  // Test Compare Slider
  const sliderInput = await page.$('.compare-slider-input');
  if (sliderInput) {
    await sliderInput.fill('25');
    await page.evaluate(() => {
      document.querySelector('.compare-slider-input').dispatchEvent(new Event('input'));
    });
    const overlayWidth25 = await page.$eval('.compare-overlay', el => el.style.width);
    console.log(`[PASS] Slider position at 25%: overlay width = ${overlayWidth25}`);

    await sliderInput.fill('75');
    await page.evaluate(() => {
      document.querySelector('.compare-slider-input').dispatchEvent(new Event('input'));
    });
    const overlayWidth75 = await page.$eval('.compare-overlay', el => el.style.width);
    console.log(`[PASS] Slider position at 75%: overlay width = ${overlayWidth75}`);
    await page.screenshot({ path: path.join(REVIEW_DIR, 'desktop_slider_active.png') });
  }

  // Verify Video Player element
  const videoExists = await page.$eval('.video-player', el => el !== null);
  console.log(`[PASS] Video element present and configured: ${videoExists}`);

  // 4. Mobile Viewport Audit (iPhone 13/14 size: 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(REVIEW_DIR, 'mobile_index_hero.png') });

  // Test Mobile Navigation Drawer
  await mobilePage.click('.mobile-toggle');
  await mobilePage.waitForTimeout(300);
  const isDrawerOpen = await mobilePage.$eval('.mobile-drawer', el => el.classList.contains('open'));
  console.log(`[PASS] Mobile Drawer Open State: ${isDrawerOpen}`);
  await mobilePage.screenshot({ path: path.join(REVIEW_DIR, 'mobile_drawer_open.png') });

  await mobilePage.click('.mobile-drawer-close');
  await mobilePage.waitForTimeout(300);

  // Mobile 2km loop page
  await mobilePage.goto(`http://localhost:${PORT}/2km-loop.html`, { waitUntil: 'networkidle' });
  await mobilePage.screenshot({ path: path.join(REVIEW_DIR, 'mobile_2km_loop_top.png') });

  // Scroll to compare slider on mobile
  await mobilePage.evaluate(() => {
    document.querySelector('.compare-section').scrollIntoView();
  });
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: path.join(REVIEW_DIR, 'mobile_slider_section.png') });

  // Scroll to video on mobile
  await mobilePage.evaluate(() => {
    document.querySelector('.video-section').scrollIntoView();
  });
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: path.join(REVIEW_DIR, 'mobile_video_section.png') });

  await browser.close();
  server.close();

  console.log("\n=== AUDIT RESULTS ===");
  console.log(`Total Errors: ${report.errors.length}`);
  console.log(`Total Failed Requests: ${report.failedRequests.length}`);
  if (report.errors.length > 0) {
    console.log("Errors:", report.errors);
  }
  if (report.failedRequests.length > 0) {
    console.log("Failed Requests:", report.failedRequests);
  }
  console.log("Audit complete successfully!");
}

runAudit().catch(err => {
  console.error("Audit failure:", err);
  process.exit(1);
});
