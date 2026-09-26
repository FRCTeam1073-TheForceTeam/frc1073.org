const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    const url = process.argv[2] || 'https://hbrb1073.wixsite.com/frc1073/about-the-team';
    const repoRoot = path.dirname(path.dirname(path.dirname(__filename)));
    const outputDir = process.argv[3] || path.join(repoRoot, '.tmp', 'wix-page');

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Check if there's a carousel and navigate through all slides
    const isCarousel = await page.evaluate(() => {
      return !!document.querySelector('[class*="SlideShow"], [class*="carousel"], [class*="slider"]');
    });

    console.log(`Carousel detected: ${isCarousel}`);

    if (isCarousel) {
      // Collect all images from carousel by clicking through slides
      const allImages = new Set();

      // Try to find next button and click through slides
      for (let i = 0; i < 25; i++) { // Try up to 25 clicks to ensure we get all slides
        // Get current visible images
        const currentImages = await page.evaluate(() => {
          const imgs = [];
          document.querySelectorAll('img').forEach((img) => {
            if (img.offsetHeight > 50 && img.src && img.src.includes('wixstatic')) {
              imgs.push({
                src: img.src,
                alt: img.alt || '',
                width: img.width,
                height: img.height
              });
            }
          });
          return imgs;
        });

        currentImages.forEach(img => {
          allImages.add(JSON.stringify(img));
        });

        console.log(`Slide ${i + 1}: Found ${currentImages.length} images, total unique: ${allImages.size}`);

        // Try to click next button (Wix uses various selectors for carousel navigation)
        const nextClicked = await page.evaluate(() => {
          // Try different next button selectors
          const selectors = [
            'button[aria-label*="next"], button[aria-label*="Next"]',
            '[class*="next"][class*="button"]',
            '[data-testid*="next"]',
            'button:not(:disabled):last-of-type' // fallback
          ];

          for (const selector of selectors) {
            const btn = document.querySelector(selector);
            if (btn && btn.offsetHeight > 0) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (!nextClicked) {
          console.log('No next button found, carousel navigation complete');
          break;
        }

        // Wait for slide transition
        await page.waitForTimeout(500);
      }

      // Convert set back to array and parse
      const uniqueImages = Array.from(allImages).map(img => JSON.parse(img));

      const imagesFile = path.join(outputDir, 'images.json');
      fs.writeFileSync(imagesFile, JSON.stringify(uniqueImages, null, 2));
      console.log(`\nTotal unique carousel images: ${uniqueImages.length}`);
      console.log(`Saved image info to: ${imagesFile}`);
    }

    // Save rendered HTML for inspection
    const html = await page.content();
    const htmlFile = path.join(outputDir, 'page.html');
    fs.writeFileSync(htmlFile, html);
    console.log(`Saved HTML to: ${htmlFile}`);

    // Extract all text content from the page
    const content = await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
      const text = document.body.innerText;
      return text;
    });

    // Save text content
    const textFile = path.join(outputDir, 'content.txt');
    fs.writeFileSync(textFile, content);
    console.log(`Saved content to: ${textFile}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
