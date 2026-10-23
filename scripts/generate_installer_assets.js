const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

function rawRgbToBmp(buffer, width, height) {
  const rowPadding = (4 - ((width * 3) % 4)) % 4
  const rowSize = width * 3 + rowPadding
  const imageSize = rowSize * height
  const fileSize = 54 + imageSize
  const bmp = Buffer.alloc(fileSize)

  bmp.write('BM', 0)
  bmp.writeUInt32LE(fileSize, 2)
  bmp.writeUInt32LE(54, 10)
  bmp.writeUInt32LE(40, 14)
  bmp.writeInt32LE(width, 18)
  bmp.writeInt32LE(height, 22)
  bmp.writeUInt16LE(1, 26)
  bmp.writeUInt16LE(24, 28)
  bmp.writeUInt32LE(0, 30)
  bmp.writeUInt32LE(imageSize, 34)

  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y
    const rowOffset = 54 + y * rowSize
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 3
      const dstIdx = rowOffset + x * 3
      bmp[dstIdx] = buffer[srcIdx + 2]     // Blue
      bmp[dstIdx + 1] = buffer[srcIdx + 1] // Green
      bmp[dstIdx + 2] = buffer[srcIdx]     // Red
    }
  }
  return bmp
}

async function generateInstallerAssets() {
  const rootDir = path.resolve(__dirname, '..')
  const resourcesDir = path.join(rootDir, 'resources')
  const buildDir = path.join(rootDir, 'build')

  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

  console.log('[Installer Assets] Designing premium installer visual branding...')

  const iconPath = path.join(resourcesDir, 'icon.png')
  const iconBuffer = await sharp(iconPath)
    .resize(76, 76, { fit: 'contain' })
    .png()
    .toBuffer()

  // 1. Build 164x314 Sidebar SVG layout
  const sidebarSvg = `
  <svg width="164" height="314" viewBox="0 0 164 314" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b0f17"/>
        <stop offset="50%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#0a0e16"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#e5c07b"/>
        <stop offset="50%" stop-color="#ffd700"/>
        <stop offset="100%" stop-color="#d4af37"/>
      </linearGradient>
      <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(212,175,55,0.06)" stroke-width="0.8"/>
        <circle cx="10" cy="10" r="1" fill="rgba(212,175,55,0.08)"/>
      </pattern>
    </defs>

    <!-- Background -->
    <rect width="164" height="314" fill="url(#bgGrad)"/>
    <rect width="164" height="314" fill="url(#gridPattern)"/>

    <!-- Subtle vertical accent border on right edge -->
    <line x1="163" y1="0" x2="163" y2="314" stroke="rgba(212,175,55,0.25)" stroke-width="1.5"/>

    <!-- Brand Typography Header -->
    <text x="82" y="118" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="900" font-size="14.5" fill="url(#goldGrad)" letter-spacing="2">UNI DESK</text>
    <text x="82" y="132" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="8.5" fill="#94a3b8" letter-spacing="2">WORKSTATION</text>

    <!-- Gold Divider line -->
    <line x1="26" y1="142" x2="138" y2="142" stroke="url(#goldGrad)" stroke-width="1.2" stroke-linecap="round"/>

    <!-- Feature Description Bullets -->
    <text x="82" y="166" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="9" fill="#e2e8f0">Automated Video Suite</text>
    <text x="82" y="184" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="9" fill="#cbd5e1">Batch Title &amp; Markers</text>
    <text x="82" y="202" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="9" fill="#94a3b8">Cloud Sync &amp; Transfer</text>
    <text x="82" y="220" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600" font-size="9" fill="#94a3b8">Raw Photo Renamer</text>

    <!-- Islamic / Tech Geometry Emblem Accent -->
    <circle cx="82" cy="254" r="14" fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1"/>
    <circle cx="82" cy="254" r="7" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="0.8"/>
    <polygon points="82,244 89,254 82,264 75,254" fill="none" stroke="url(#goldGrad)" stroke-width="1"/>

    <!-- Footer Publisher -->
    <text x="82" y="294" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="8" fill="#64748b" letter-spacing="1.5">BS FRAMEWORK</text>
  </svg>
  `

  const sidebarImg = await sharp(Buffer.from(sidebarSvg))
    .composite([{ input: iconBuffer, top: 22, left: 44 }])
    .png()
    .toBuffer()

  // Save 164x314 PNG & BMP for NSIS / Inno Setup
  fs.writeFileSync(path.join(resourcesDir, 'installer_banner.png'), sidebarImg)
  const sidebarRaw = await sharp(sidebarImg).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const sidebarBmp = rawRgbToBmp(sidebarRaw.data, 164, 314)
  fs.writeFileSync(path.join(resourcesDir, 'installer_banner.bmp'), sidebarBmp)
  console.log('  ✔ Created: resources/installer_banner.png & .bmp (164x314)')

  // 2. Build 493x312 WiX MSI Dialog Bitmap: Left 164px Sidebar + Right 329px Clean Off-White Background
  const wixDialogBase = await sharp({
    create: {
      width: 493,
      height: 312,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: await sharp(sidebarImg).resize(164, 312, { fit: 'fill' }).png().toBuffer(), top: 0, left: 0 }
    ])
    .raw()
    .toBuffer({ resolveWithObject: true })

  const wixDialogBmp = rawRgbToBmp(wixDialogBase.data, 493, 312)
  fs.writeFileSync(path.join(buildDir, 'wix_dialog.bmp'), wixDialogBmp)
  console.log('  ✔ Created: build/wix_dialog.bmp (493x312 - Left Sidebar + Right Clean Background)')

  // 3. Build 493x58 WiX Header Banner Bitmap
  const headerIcon = await sharp(iconPath).resize(44, 44, { fit: 'contain' }).png().toBuffer()
  const wixHeaderSvg = `
  <svg width="493" height="58" viewBox="0 0 493 58" xmlns="http://www.w3.org/2000/svg">
    <rect width="493" height="58" fill="#ffffff"/>
    <line x1="0" y1="57" x2="493" y2="57" stroke="#e2e8f0" stroke-width="1"/>
  </svg>
  `
  const wixHeaderImg = await sharp(Buffer.from(wixHeaderSvg))
    .composite([{ input: headerIcon, top: 7, left: 435 }])
    .raw()
    .toBuffer({ resolveWithObject: true })

  const wixBannerBmp = rawRgbToBmp(wixHeaderImg.data, 493, 58)
  fs.writeFileSync(path.join(buildDir, 'wix_banner.bmp'), wixBannerBmp)
  console.log('  ✔ Created: build/wix_banner.bmp (493x58)')

  // 4. Build 150x57 small header for Inno Setup
  const smallHeaderBase = await sharp({
    create: {
      width: 150,
      height: 57,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([{ input: await sharp(iconPath).resize(45, 45, { fit: 'contain' }).png().toBuffer(), top: 6, left: 95 }])
    .png()
    .toBuffer()

  fs.writeFileSync(path.join(resourcesDir, 'installer_small.png'), smallHeaderBase)
  const smallRaw = await sharp(smallHeaderBase).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  fs.writeFileSync(path.join(resourcesDir, 'installer_small.bmp'), rawRgbToBmp(smallRaw.data, 150, 57))
  console.log('  ✔ Created: resources/installer_small.png & .bmp (150x57)')
}

if (require.main === module) {
  generateInstallerAssets().catch(err => {
    console.error('Error generating installer assets:', err)
    process.exit(1)
  })
}

module.exports = { generateInstallerAssets }
