const { chromium } = require('playwright');
const path = require('path');

const files = [
  { html: 'investimento.html', pdf: 'kroma-ipro3d-preco-servico.pdf' },
  { html: 'bot-ou-agente-ia.html', pdf: 'kroma-ipro3d-bot-ou-agente-ia.pdf' },
];

(async () => {
  const browser = await chromium.launch();
  for (const f of files) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const filePath = 'file:///' + path.resolve(__dirname, f.html).replace(/\\/g, '/');
    await page.goto(filePath, { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.resolve(__dirname, f.pdf),
      width: '1600px',
      height: '900px',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    await page.close();
    console.log('OK:', f.pdf);
  }
  await browser.close();
})();
