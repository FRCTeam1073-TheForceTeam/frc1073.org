const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    const url = process.argv[2];
    const repoRoot = path.dirname(path.dirname(path.dirname(__filename)));
    const outputDir = process.argv[3] || path.join(repoRoot, '.tmp', 'wix-page');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('[data-testid="slide-show-gallery"]', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const allImages = [];
    const seenSrcs = new Set();

    // Get total slides
    const totalSlides = await page.evaluate(() => {
      const counter = document.querySelector('[data-testid="gallery-counter"]');
      if (counter) {
        const match = counter.textContent.match(/\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      return 0;
    });

    console.log(`Total slides: ${totalSlides}\n`);

    // Navigate through each slide
    for (let slideNum = 1; slideNum <= totalSlides; slideNum++) {
      // Get current slide image
      const slideInfo = await page.evaluate(() => {
        const title = document.querySelector('[data-testid="gallery-item-title"]');
        const titleText = title ? title.textContent : '';

        const img = document.querySelector('[data-testid="slide-show-gallery"] img[src*="wixstatic"]');

        if (img) {
          return {
            title: titleText,
            src: img.src,
            alt: img.alt || titleText
          };
        }
        return null;
      });

      if (slideInfo && slideInfo.src) {
        if (!seenSrcs.has(slideInfo.src)) {
          allImages.push(slideInfo);
          seenSrcs.add(slideInfo.src);
          console.log(`Slide ${slideNum}: NEW - ${slideInfo.title}`);
        } else {
          console.log(`Slide ${slideNum}: DUPLICATE - ${slideInfo.title}`);
        }
      } else {
        console.log(`Slide ${slideNum}: ERROR - No image found`);
      }

      // Click next button (rightmost button in gallery)
      if (slideNum < totalSlides) {
        const clicked = await page.evaluate(() => {
          const gallery = document.querySelector('[data-testid="slide-show-gallery"]');
          const buttons = Array.from(gallery.querySelectorAll('button'));
          if (buttons.length >= 2) {
            // Click the rightmost button (next)
            buttons[buttons.length - 1].click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          console.log(`Failed to click next button at slide ${slideNum}`);
          break;
        }
      }
    }

    // Filter out site chrome
    const filtered = allImages.filter(img => {
      if (img.alt.includes('FRC Team 1073 Claw')) {
        return false;
      }
      return true;
    });

    console.log(`\n=== RESULTS ===`);
    console.log(`Total unique images: ${filtered.length}`);

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(filtered, null, 2));
    console.log(`Saved to: ${imagesFile}`);

    // Print list
    console.log('\nImages found:');
    filtered.forEach((img, idx) => {
      console.log(`${idx + 1}. ${img.title}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
