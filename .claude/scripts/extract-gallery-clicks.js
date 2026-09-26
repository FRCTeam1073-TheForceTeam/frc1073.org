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

    // Get all image data from the gallery
    const allSlideData = [];

    // Get initial data
    const totalSlides = await page.evaluate(() => {
      const counter = document.querySelector('[data-testid="gallery-counter"]');
      if (counter) {
        const match = counter.textContent.match(/\/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
      return 0;
    });

    console.log(`Gallery has ${totalSlides} slides`);

    // Collect all gallery item data from the DOM
    const slideData = await page.evaluate(() => {
      const gallery = document.querySelector('[data-testid="slide-show-gallery"]');
      if (!gallery) return [];

      // Get all gallery item containers
      const items = Array.from(gallery.querySelectorAll('[data-testid="gallery-item-ghost"]'));

      return items.map((item, idx) => {
        // Get title
        const titleEl = item.querySelector('[data-testid="gallery-item-title"]');
        const title = titleEl ? titleEl.textContent : `Slide ${idx + 1}`;

        // Get image
        const img = item.querySelector('img[src*="wixstatic"]');
        const src = img ? img.src : '';
        const alt = img ? img.alt : '';

        // Get any image-info data attribute
        const imageInfo = item.querySelector('wow-image')?.getAttribute('data-image-info');
        let imageUri = '';
        if (imageInfo) {
          try {
            const parsed = JSON.parse(imageInfo);
            imageUri = parsed.imageData?.uri || '';
          } catch (e) {}
        }

        return {
          index: idx + 1,
          title,
          src,
          alt,
          imageUri,
          hasImage: !!img
        };
      });
    });

    console.log(`\nFound ${slideData.length} slides in DOM:`);
    slideData.forEach(slide => {
      console.log(`${slide.index}. ${slide.title} - ${slide.src ? 'HAS IMAGE' : 'NO IMAGE'}`);
      if (slide.imageUri) console.log(`   URI: ${slide.imageUri}`);
    });

    // Extract unique image URLs
    const uniqueImages = [];
    const seenSrcs = new Set();

    slideData.forEach(slide => {
      if (slide.src && !seenSrcs.has(slide.src)) {
        seenSrcs.add(slide.src);
        uniqueImages.push({
          title: slide.title,
          src: slide.src,
          alt: slide.alt || slide.title,
          imageUri: slide.imageUri
        });
      }
    });

    console.log(`\nTotal unique images: ${uniqueImages.length}`);

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(uniqueImages, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
