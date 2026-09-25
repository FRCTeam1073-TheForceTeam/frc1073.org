const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
        return;
      }
      
      const filepath = path.join(__dirname, '..', 'assets', 'images', filename);
      const writeStream = fs.createWriteStream(filepath);
      response.pipe(writeStream);
      
      writeStream.on('finish', () => {
        writeStream.close();
        console.log(`Downloaded: ${filename}`);
        resolve();
      });
      
      writeStream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const imagesFile = path.join(__dirname, '..', '.tmp', 'wix-page', 'images.json');
  const images = JSON.parse(fs.readFileSync(imagesFile, 'utf-8'));
  
  // Create assets/images directory if it doesn't exist
  const assetsDir = path.join(__dirname, '..', 'assets', 'images');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  // Map of image index to descriptive filename
  const filenameMap = {
    0: 'team-logo.png',           // FRC Team 1073 Claw logo
    1: 'team-photo-1.jpg',        // image2.jpeg
    2: 'earth-background.jpg',    // Earth from Space
    3: 'team-photo-2.jpg'         // 122A6939.jpg (team photo)
  };
  
  for (const img of images) {
    if (img.index < 4 && img.src) {  // Only download actual images, not PDFs
      const filename = filenameMap[img.index];
      try {
        await downloadImage(img.src, filename);
      } catch (err) {
        console.error(`Error downloading image ${img.index}:`, err.message);
      }
    }
  }
}

main().catch(console.error);
