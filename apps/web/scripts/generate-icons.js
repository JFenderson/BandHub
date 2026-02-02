/**
 * PWA Icon Generator Script
 *
 * This script generates PNG icons in various sizes for PWA support.
 *
 * Prerequisites:
 *   npm install sharp
 *
 * Usage:
 *   node scripts/generate-icons.js
 *
 * The script will:
 * 1. Read the base SVG icon from public/icons/icon.svg
 * 2. Generate PNG icons in all required sizes
 * 3. Also generate an apple-touch-icon and favicon
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp is not installed. Installing now...');
  const { execSync } = require('child_process');
  execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('Generating PWA icons...\n');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read the SVG file
  const svgBuffer = fs.readFileSync(inputSvg);

  // Generate icons for each size
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate apple-touch-icon (180x180)
  const appleTouchIconPath = path.join(__dirname, '../public/apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(appleTouchIconPath);
  console.log('Generated: apple-touch-icon.png');

  // Generate favicon (32x32)
  const faviconPath = path.join(__dirname, '../public/favicon.png');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconPath);
  console.log('Generated: favicon.png');

  // Generate favicon.ico (using 32x32 PNG as base)
  // Note: For a proper .ico file, you may want to use a dedicated tool
  const faviconIcoPath = path.join(__dirname, '../public/favicon.ico');
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(faviconIcoPath.replace('.ico', '-32.png'));
  console.log('Generated: favicon-32.png (rename to favicon.ico or use ico converter)');

  console.log('\nAll icons generated successfully!');
  console.log('\nNote: For a proper favicon.ico, consider using an online converter or the "png-to-ico" package.');
}

generateIcons().catch(console.error);
