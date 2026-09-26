const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Track all loaded images
  const imageTracker = new Set();

  // Listen to all image loads
  await page.on('response', response => {
    const url = response.url();
    if (url.includes('wixstatic') && url.includes('media') &&
        (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg'))) {
      // Extract base URL before transformation params
      const baseUrl = url.split('/v1/')[0];
      if (baseUrl && baseUrl.includes('~mv2')) {
        imageTracker.add(baseUrl);
      }
    }
  });

  try {
    const url = process.argv[2];
    const repoRoot = path.dirname(path.dirname(path.dirname(__filename)));
    const outputDir = process.argv[3] || path.join(repoRoot, '.tmp', 'wix-page');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Loading: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const totalSlides = await page.evaluate(() => {
      const counter = document.querySelector('[data-testid="gallery-counter"]');
      if (counter) {
        const match = counter.textContent.match(/\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      return 0;
    });

    console.log(`\nCarousel has ${totalSlides} slides`);
    console.log('Navigating through carousel...\n');

    // Navigate through carousel
    for (let i = 0; i < totalSlides - 1; i++) {
      await page.evaluate(() => {
        const gallery = document.querySelector('[data-testid="slide-show-gallery"]');
        if (gallery) {
          const buttons = Array.from(gallery.querySelectorAll('button'));
          if (buttons.length >= 2) {
            buttons[buttons.length - 1].click(); // Click next
          }
        }
      });

      // Wait longer for images to load
      await new Promise(r => setTimeout(r, 1200));

      const slideNum = i + 2;
      if (slideNum % 5 === 0 || slideNum === totalSlides) {
        console.log(`Slide ${slideNum}/${totalSlides}: ${imageTracker.size} unique images loaded so far`);
      }
    }

    console.log(`\nTotal unique images found via network: ${imageTracker.size}`);

    // Convert to array and fetch metadata
    const images = Array.from(imageTracker).map(baseUrl => {
      const filename = baseUrl.split('/').pop();
      return {
        src: baseUrl,
        filename: filename,
        alt: filename
      };
    });

    console.log('\nImages found:');
    images.forEach((img, idx) => {
      console.log(`${idx + 1}. ${img.filename}`);
    });

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));
    console.log(`\nSaved ${images.length} images to: ${imagesFile}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
