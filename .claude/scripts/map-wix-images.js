const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const repoRoot = path.dirname(path.dirname(path.dirname(__filename)));
    const outputDir = path.join(repoRoot, '.tmp', 'wix-page');
    const htmlFile = path.join(outputDir, 'page.html');

    if (!fs.existsSync(htmlFile)) {
      console.error(`Error: ${htmlFile} not found. Run fetch-wix-content.js first.`);
      process.exit(1);
    }

    // Read the saved HTML
    const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
    const images = [];

    // Find all img tags with their sizes
    const imgRegex = /<img[^>]*>/gi;
    const imgMatches = htmlContent.matchAll(imgRegex);

    const imgArray = Array.from(imgMatches).map(match => {
      const tag = match[0];
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const srcMatch = tag.match(/src=["']([^"']*)["']/i);
      const widthMatch = tag.match(/width=["']?([0-9]+)["']?/i);
      const heightMatch = tag.match(/height=["']?([0-9]+)["']?/i);
      const dataImageMatch = tag.match(/data-image-info=["']([^"']*)["']/i);

      let width = widthMatch ? parseInt(widthMatch[1]) : 0;
      let height = heightMatch ? parseInt(heightMatch[1]) : 0;

      // Extract dimensions from data-image-info JSON if available
      if (dataImageMatch) {
        try {
          const jsonStr = dataImageMatch[1].replace(/&quot;/g, '"');
          const imageData = JSON.parse(jsonStr);
          if (imageData.targetWidth) width = imageData.targetWidth;
          if (imageData.targetHeight) height = imageData.targetHeight;
        } catch (e) {
          // Ignore parsing errors
        }
      }

      return {
        tag: tag,
        alt: altMatch ? altMatch[1] : '',
        src: srcMatch ? srcMatch[1] : '',
        width: width,
        height: height
      };
    });

    // Filter out very small images (likely icons/decorations)
    const contentImages = imgArray.filter(img => img.width >= 100 && img.height >= 100);

    // For each image, find the preceding heading
    contentImages.forEach((img, idx) => {
      // Find the position of this image in the HTML
      const imgPos = htmlContent.indexOf(img.tag);

      // Look backwards for the nearest heading
      const beforeImg = htmlContent.substring(0, imgPos);

      // Find all headings (h1-h3) with their text content, handling nested HTML
      // Pattern: <h[1-3]...>...text...</h[1-3]> where ... can contain HTML tags
      const headingRegex = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
      let lastHeading = null;
      let lastHeadingLevel = null;
      let match;

      while ((match = headingRegex.exec(beforeImg)) !== null) {
        // Extract text content and remove any HTML tags
        const rawText = match[2];
        const cleanText = rawText.replace(/<[^>]+>/g, '').trim();

        // Only use non-empty headings (skip header navigation, etc)
        if (cleanText && cleanText.length > 3) {
          lastHeading = cleanText;
          lastHeadingLevel = parseInt(match[1]);
        }
      }

      images.push({
        index: idx,
        alt: img.alt || '',
        src: img.src || '',
        width: img.width,
        height: img.height,
        precedingSection: lastHeading || '(beginning of page)',
        sectionLevel: lastHeadingLevel,
        instruction: lastHeading
          ? `Place this image in the markdown AFTER the "${lastHeading}" section heading.`
          : 'Place this image at the beginning of the page, before any sections.'
      });
    });

    // Save image mapping
    const mappingFile = path.join(outputDir, 'image-mapping.json');
    fs.writeFileSync(mappingFile, JSON.stringify(images, null, 2));

    console.log('IMAGE PLACEMENT MAPPING:');
    console.log('========================\n');
    images.forEach((img, idx) => {
      console.log(`Image ${idx + 1}:`);
      console.log(`  Alt text: "${img.alt}"`);
      console.log(`  Size: ${img.width}x${img.height}`);
      console.log(`  ${img.instruction}`);
      console.log('');
    });

    console.log(`\nDetailed mapping saved to: ${mappingFile}`);
    console.log('\nKEY PRINCIPLE:');
    console.log('Each image should be placed in markdown immediately AFTER');
    console.log('the section heading it follows in the HTML structure.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
