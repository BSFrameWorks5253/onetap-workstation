const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function processLogos() {
  const lightSource = 'C:/Users/Burhanuddin/.gemini/antigravity-ide/brain/5a7263c4-e24f-4b60-94f8-e25e1b02589e/unidesk_light_logo_1791270311830.jpg';
  const darkSource = 'C:/Users/Burhanuddin/.gemini/antigravity-ide/brain/5a7263c4-e24f-4b60-94f8-e25e1b02589e/unidesk_clean_logo_1791268436378.jpg';

  const size = 512;
  const radius = 114; // Apple / Windows 11 fluent squircle radius for 512x512

  // SVG mask for smooth antialiased transparent squircle
  const maskSvg = Buffer.from(`
    <svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff" />
    </svg>
  `);

  console.log('Generating Light Theme Logo with 100% transparent corners...');
  const lightBuffer = await sharp(lightSource)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync('resources/app_logo_light.png', lightBuffer);
  fs.writeFileSync('website/assets/logo_light.png', lightBuffer);

  const light300 = await sharp(lightBuffer).resize(300, 300).png().toBuffer();
  fs.writeFileSync('website/assets/store_logo_light_300x300.png', light300);

  console.log('Generating Dark Theme Logo with 100% transparent corners (no white border bleed)...');
  const darkBuffer = await sharp(darkSource)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync('resources/app_logo.png', darkBuffer);
  fs.writeFileSync('resources/icon.png', darkBuffer);
  fs.writeFileSync('website/assets/logo.png', darkBuffer);

  const dark300 = await sharp(darkBuffer).resize(300, 300).png().toBuffer();
  fs.writeFileSync('website/assets/store_logo_300x300.png', dark300);
  fs.writeFileSync('website/assets/store_logo_dark_300x300.png', dark300);

  // Generate 256x256, 128x128, 64x64, 48x48, 32x32, 16x16 ICO files with transparency
  const icoPng = await sharp(darkBuffer).resize(256, 256).png().toBuffer();
  fs.writeFileSync('resources/icon_256.png', icoPng);

  console.log('Done! All logos processed with transparent corners.');
}

processLogos().catch(err => {
  console.error(err);
  process.exit(1);
});
