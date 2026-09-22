const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const src = path.join(__dirname, 'pacotes-whatsapp.html');
  await page.goto('file://' + src, { waitUntil: 'networkidle' });
  await page.pdf({
    path: path.join(__dirname, 'kroma-alessandro-pacotes-whatsapp.pdf'),
    width: '1600px',
    height: '900px',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await browser.close();
  console.log('done');
})();
