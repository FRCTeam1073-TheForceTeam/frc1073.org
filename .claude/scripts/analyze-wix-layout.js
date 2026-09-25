const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    const url = process.argv[2] || 'https://hbrb1073.wixsite.com/frc1073/about-the-team';
    const repoRoot = path.dirname(path.dirname(path.dirname(__filename)));
    const outputDir = path.join(repoRoot, '.tmp', 'wix-page');

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Extract images with their position relative to content
    const layout = await page.evaluate(() => {
      const mainContent = document.querySelector('main') || document.body;
      const elements = [];

      // Get all headings and images in order
      const allElements = mainContent.querySelectorAll('h1, h2, h3, img');

      allElements.forEach((el, idx) => {
        if (el.tagName === 'IMG') {
          if (el.offsetHeight > 0) { // Only visible images
            elements.push({
              type: 'image',
              alt: el.alt,
              width: el.width,
              height: el.height
            });
          }
        } else if (el.textContent.trim()) {
          elements.push({
            type: el.tagName.toLowerCase(),
            text: el.textContent.substring(0, 50).trim()
          });
        }
      });

      return elements;
    });

    // Save layout analysis
    const layoutFile = path.join(outputDir, 'layout.json');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(layoutFile, JSON.stringify(layout, null, 2));

    console.log('Page Layout (Headings and Images in order):');
    console.log('==========================================\n');
    layout.forEach((el, idx) => {
      if (el.type === 'image') {
        console.log(`[${idx}] IMAGE: ${el.alt || '(no alt text)'} (${el.width}x${el.height})`);
      } else {
        console.log(`[${idx}] ${el.type.toUpperCase()}: "${el.text}..."`);
      }
    });

    console.log(`\nLayout analysis saved to: ${layoutFile}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
