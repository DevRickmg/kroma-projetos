const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 750, height: 1000 } });
  const src = path.join(__dirname, 'pacotes-whatsapp-mobile.html');
  await page.goto('file://' + src, { waitUntil: 'networkidle' });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.pdf({
    path: path.join(__dirname, 'kroma-alessandro-pacotes-whatsapp-mobile.pdf'),
    width: '750px',
    height: height + 'px',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    pageRanges: '1',
  });
  await browser.close();
  console.log('done', height);
})();
