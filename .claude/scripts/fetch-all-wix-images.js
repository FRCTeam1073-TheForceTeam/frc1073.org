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

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('body', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Scroll the page to trigger lazy loading of gallery images
    console.log('Scrolling page to load all gallery images...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Scroll back to top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get the gallery container and extract all slide data
    const totalSlides = await page.evaluate(() => {
      const counter = document.querySelector('[data-testid="gallery-counter"]');
      if (!counter) return 0;
      const text = counter.textContent;
      const match = text.match(/\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });

    console.log(`Total gallery slides: ${totalSlides}`);

    const allImages = [];
    const seenSrcs = new Set();

    // Navigate through each slide and capture image data
    for (let slideNum = 1; slideNum <= totalSlides; slideNum++) {
      const slideData = await page.evaluate(() => {
        const title = document.querySelector('[data-testid="gallery-item-title"]');
        const titleText = title ? title.textContent : '';

        // Find the main image in the currently visible gallery item
        const galleryItem = document.querySelector('[data-testid="slide-show-gallery"]');
        const img = galleryItem ? galleryItem.querySelector('img[src*="wixstatic"]') : null;

        if (img) {
          return {
            title: titleText,
            src: img.src,
            alt: img.alt || titleText,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          };
        }
        return null;
      });

      if (slideData && slideData.src && !seenSrcs.has(slideData.src)) {
        allImages.push(slideData);
        seenSrcs.add(slideData.src);
        console.log(`Slide ${slideNum}: ${slideData.title} - ${slideData.src.split('/').pop().substring(0, 40)}...`);
      } else if (slideData && slideData.src) {
        console.log(`Slide ${slideNum}: ${slideData.title} - (duplicate)`);
      } else {
        console.log(`Slide ${slideNum}: No image found`);
      }

      // Navigate to next slide
      if (slideNum < totalSlides) {
        await page.keyboard.press('ArrowRight');
        await new Promise(resolve => setTimeout(resolve, 700)); // Wait for transition
      }
    }

    // Filter out site chrome
    const filtered = allImages.filter(img => {
      if (img.alt.includes('FRC Team 1073 Claw') || img.src.includes('f9b998_b9d2d0b35b664a888d264c3183700710')) {
        return false;
      }
      return true;
    });

    console.log(`\n=== RESULTS ===`);
    console.log(`Total unique images found: ${filtered.length}`);
    console.log(`Slides analyzed: ${totalSlides}`);

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(filtered, null, 2));
    console.log(`Saved to: ${imagesFile}`);

    // Also save a summary
    console.log('\nImage list:');
    filtered.forEach((img, idx) => {
      console.log(`${idx + 1}. ${img.title || img.alt}`);
      console.log(`   URL: ${img.src.split('/').pop().substring(0, 50)}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
