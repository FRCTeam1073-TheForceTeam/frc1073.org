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

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('body', { timeout: 10000 });

    // Try to interact with carousel to load slides
    console.log('Waiting for carousel to initialize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get all carousel slide images by looking for wixstatic images
    const allImages = [];
    const seenSrcs = new Set();

    // Collect initial images
    let currentImgs = await page.evaluate(() => {
      const imgs = [];
      document.querySelectorAll('img[src*="wixstatic"]').forEach((img) => {
        if (img.offsetHeight > 50) {
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

    currentImgs.forEach(img => {
      if (!seenSrcs.has(img.src)) {
        allImages.push(img);
        seenSrcs.add(img.src);
      }
    });

    console.log(`Slide 1: Found ${currentImgs.length} images`);

    // Try to click through carousel slides
    for (let slideNum = 2; slideNum <= 25; slideNum++) {
      // Find and click next button
      let nextButtonClicked = false;

      // Try various selectors for next button
      const nextClicked = await page.evaluate(() => {
        // Look for buttons with next/arrow indicators
        let buttons = Array.from(document.querySelectorAll('button'));

        // Try to find buttons that look like next/arrow buttons
        for (let btn of buttons) {
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const title = btn.getAttribute('title') || '';
          const content = btn.textContent.toLowerCase();

          if (ariaLabel.includes('next') || title.includes('next') ||
              content.includes('>') || content.includes('next')) {
            if (btn.offsetHeight > 0 && !btn.disabled) {
              btn.click();
              return true;
            }
          }
        }

        // If no explicit next button, try right arrow or chevron
        buttons = Array.from(document.querySelectorAll('[class*="arrow"], [class*="chevron"], [role="button"]'));
        for (let btn of buttons) {
          if (btn.offsetHeight > 0 && !btn.disabled) {
            const rect = btn.getBoundingClientRect();
            // Look for button on the right side of screen
            if (rect.right > window.innerWidth * 0.7) {
              btn.click();
              return true;
            }
          }
        }

        return false;
      });

      if (!nextClicked) {
        console.log(`Slide ${slideNum}: Could not find next button, stopping at slide ${slideNum - 1}`);
        break;
      }

      nextButtonClicked = nextClicked;

      // Wait for slide transition
      await new Promise(resolve => setTimeout(resolve, 800));

      // Collect images from this slide
      currentImgs = await page.evaluate(() => {
        const imgs = [];
        document.querySelectorAll('img[src*="wixstatic"]').forEach((img) => {
          if (img.offsetHeight > 50) {
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

      // Add new images
      let newCount = 0;
      currentImgs.forEach(img => {
        if (!seenSrcs.has(img.src)) {
          allImages.push(img);
          seenSrcs.add(img.src);
          newCount++;
        }
      });

      console.log(`Slide ${slideNum}: Found ${currentImgs.length} images (${newCount} new)`);

      if (newCount === 0 && slideNum > 10) {
        console.log('No new images found, likely reached end of carousel');
        break;
      }
    }

    // Filter out site chrome and very small images
    const carouselImages = allImages.filter(img => {
      // Exclude logo
      if (img.alt.includes('FRC Team 1073 Claw') || img.src.includes('f9b998_b9d2d0b35b664a888d264c3183700710')) {
        return false;
      }
      // Keep images larger than 400x200
      return img.width > 400 && img.height > 200;
    });

    console.log(`\nTotal unique carousel images (filtered): ${carouselImages.length}`);

    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(carouselImages, null, 2));
    console.log(`Saved image info to: ${imagesFile}`);

    // Save HTML
    const html = await page.content();
    const htmlFile = path.join(outputDir, 'page.html');
    fs.writeFileSync(htmlFile, html);
    console.log(`Saved HTML to: ${htmlFile}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
