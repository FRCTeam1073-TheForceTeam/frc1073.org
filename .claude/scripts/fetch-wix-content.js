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
    
    // Save rendered HTML for inspection
    const html = await page.content();
    const htmlFile = path.join(outputDir, 'page.html');
    fs.writeFileSync(htmlFile, html);
    console.log(`Saved HTML to: ${htmlFile}`);
    
    // Extract all text content from the page
    const content = await page.evaluate(() => {
      // Remove script and style elements
      document.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
      
      // Get all text nodes and clean them up
      const text = document.body.innerText;
      return text;
    });
    
    // Save text content
    const textFile = path.join(outputDir, 'content.txt');
    fs.writeFileSync(textFile, content);
    console.log(`Saved content to: ${textFile}`);
    
    // Extract image information
    const images = await page.evaluate(() => {
      const imgs = [];
      document.querySelectorAll('img').forEach((img, idx) => {
        if (img.offsetHeight > 0) { // Only visible images
          imgs.push({
            index: idx,
            src: img.src,
            alt: img.alt,
            width: img.width,
            height: img.height,
            classList: img.className
          });
        }
      });
      return imgs;
    });
    
    const imagesFile = path.join(outputDir, 'images.json');
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));
    console.log(`Found ${images.length} visible images`);
    console.log(`Saved image info to: ${imagesFile}`);
    
    // Output to console too
    console.log('\n=== EXTRACTED CONTENT ===\n');
    console.log(content);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
