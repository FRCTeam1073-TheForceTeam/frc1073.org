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

    // Get the total number of slides
    const totalSlides = await page.evaluate(() => {
      const counter = document.querySelector('[data-testid="gallery-counter"]');
      if (!counter) return 0;
      const text = counter.textContent; // e.g., "1/21"
      const match = text.match(/\/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });

    console.log(`Total gallery slides: ${totalSlides}`);

    const allImages = {};

    // Navigate through each slide
    for (let slideNum = 1; slideNum <= totalSlides; slideNum++) {
      // Get current slide image info
      const slideImages = await page.evaluate(() => {
        const images = [];
        // Get all gallery item images (look for visible images)
        const galleryItems = document.querySelectorAll('[data-testid="gallery-item-ghost"]');

        galleryItems.forEach(item => {
          // Get the first visible image in this item
          const img = item.querySelector('img[src*="wixstatic"]');
          if (img && img.offsetHeight > 100 && img.src) {
            images.push({
              src: img.src,
              alt: img.alt || '',
              width: img.width || 0,
              height: img.height || 0
            });
          }
        });

        return images;
      });

      slideImages.forEach(img => {
        if (img.src && !img.src.includes('data:')) {
          allImages[img.src] = {
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height
          };
        }
      });

      const imgCount = slideImages.length;
      console.log(`Slide ${slideNum}/${totalSlides}: Found ${imgCount} image(s), Total unique: ${Object.keys(allImages).length}`);

      // Click next button (keyboard navigation)
      if (slideNum < totalSlides) {
        await page.keyboard.press('ArrowRight');
        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for animation
      }
    }

    // Convert to array and filter
    const images = Object.values(allImages);
    const filtered = images.filter(img => {
      // Exclude logos and site chrome
      if (img.alt.includes('FRC Team 1073 Claw') || img.src.includes('f9b998_b9d2d0b35b664a888d264c3183700710')) {
        return false;
      }
      // Keep images larger than 400x200
      return img.width > 400 && img.height > 200;
    });

    console.log(`\nFiltered images (>400x200, excluding chrome): ${filtered.length}`);

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(filtered, null, 2));
    console.log(`Saved to: ${imagesFile}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
