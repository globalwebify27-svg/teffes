const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const CUSTOMER_RES = path.resolve(__dirname, '../../customer_app/android/app/src/main/res');
const RIDER_RES = path.resolve(__dirname, '../../rider_app/android/app/src/main/res');

const LOGO_MAROON = path.resolve(__dirname, '../public/teffes-logo-maroon.png');
const LOGO_WHITE = path.resolve(__dirname, '../public/teffes-logo-white.png');

const DENSITIES = [
  { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
  { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
  { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
  { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
  { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
];

async function createCustomerMasterIcons() {
  console.log('Generating Customer App Master Icons with perfected safe margins...');

  // 1. Full Master Icon (512x512)
  const bgSvg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <circle cx="256" cy="256" r="256" fill="#FAF8F5"/>
      <circle cx="256" cy="256" r="250" fill="#FFFFFF" stroke="#EDE6DE" stroke-width="6"/>
    </svg>
  `);

  const logo260 = await sharp(LOGO_MAROON)
    .resize(260, null, { fit: 'inside' })
    .toBuffer();

  const customerMasterSquare = await sharp(bgSvg)
    .composite([{ input: logo260, gravity: 'center' }])
    .png()
    .toBuffer();

  // 2. Master Round Icon (512x512)
  const roundMaskSvg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <circle cx="256" cy="256" r="256" fill="#FFFFFF"/>
    </svg>
  `);
  const customerMasterRound = await sharp(customerMasterSquare)
    .composite([{ input: roundMaskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 3. Adaptive Foreground (432x432) - Logo sized to 210px (safe diameter 288px)
  const logo210 = await sharp(LOGO_MAROON)
    .resize(210, null, { fit: 'inside' })
    .toBuffer();

  const customerMasterFg = await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logo210, gravity: 'center' }])
    .png()
    .toBuffer();

  // 4. Splash Icon (400x400) - Android 12+ circular viewport safe zone (max 190px width)
  const splashLogo = await sharp(LOGO_MAROON)
    .resize(185, null, { fit: 'inside' })
    .toBuffer();

  const customerSplashIcon = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  return { customerMasterSquare, customerMasterRound, customerMasterFg, customerSplashIcon };
}

async function createRiderMasterIcons() {
  console.log('Generating Rider App Master Icons with perfected safe margins...');

  // 1. Full Master Icon (512x512) - Deep Maroon background with white logo & amber RIDER pill
  const bgSvg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <circle cx="256" cy="256" r="256" fill="#5E0B14"/>
      <circle cx="256" cy="256" r="250" fill="#6E0E0E" stroke="#8A1818" stroke-width="6"/>
      <rect x="196" y="305" width="120" height="38" rx="19" fill="#D97706"/>
      <text x="256" y="331" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="18" fill="#FFFFFF" text-anchor="middle" letter-spacing="2.5">RIDER</text>
    </svg>
  `);

  const logo250 = await sharp(LOGO_WHITE)
    .resize(250, null, { fit: 'inside' })
    .toBuffer();

  const riderMasterSquare = await sharp(bgSvg)
    .composite([{ input: logo250, top: 175, left: 131 }])
    .png()
    .toBuffer();

  const roundMaskSvg = Buffer.from(`
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <circle cx="256" cy="256" r="256" fill="#FFFFFF"/>
    </svg>
  `);
  const riderMasterRound = await sharp(riderMasterSquare)
    .composite([{ input: roundMaskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 2. Adaptive Foreground (432x432)
  const fgSvg = Buffer.from(`
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <rect x="166" y="250" width="100" height="32" rx="16" fill="#D97706"/>
      <text x="216" y="272" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="15" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">RIDER</text>
    </svg>
  `);

  const fgLogo190 = await sharp(LOGO_WHITE)
    .resize(190, null, { fit: 'inside' })
    .toBuffer();

  const riderMasterFg = await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: fgSvg, top: 0, left: 0 },
      { input: fgLogo190, top: 145, left: 121 }
    ])
    .png()
    .toBuffer();

  // 3. Splash Icon (400x400) - Android 12+ circular viewport safe zone (width: 180px)
  const riderSplashSvg = Buffer.from(`
    <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <rect x="152" y="235" width="96" height="30" rx="15" fill="#D97706"/>
      <text x="200" y="256" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="14" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">RIDER</text>
    </svg>
  `);
  const splashLogoWhite = await sharp(LOGO_WHITE)
    .resize(180, null, { fit: 'inside' })
    .toBuffer();

  const riderSplashIcon = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: riderSplashSvg, top: 0, left: 0 },
      { input: splashLogoWhite, top: 135, left: 110 }
    ])
    .png()
    .toBuffer();

  return { riderMasterSquare, riderMasterRound, riderMasterFg, riderSplashIcon };
}

async function writeIcons(resPath, masters, isRider = false) {
  // 1. Output to each density folder
  for (const d of DENSITIES) {
    const dir = path.join(resPath, d.name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png
    await sharp(masters.square)
      .resize(d.iconSize, d.iconSize)
      .toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png
    await sharp(masters.round)
      .resize(d.iconSize, d.iconSize)
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png
    await sharp(masters.fg)
      .resize(d.fgSize, d.fgSize)
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`Saved ${d.name} (${d.iconSize}px, fg ${d.fgSize}px) in ${resPath.includes('customer') ? 'customer_app' : 'rider_app'}`);
  }

  // 2. Adaptive icon XMLs: mipmap-anydpi-v26
  const anydpiDir = path.join(resPath, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });

  const bgColorHex = isRider ? '#5E0B14' : '#FAF8F5';

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml);

  // 3. values/colors.xml for ic_launcher_background
  const valuesDir = path.join(resPath, 'values');
  if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });
  const colorsXmlPath = path.join(valuesDir, 'colors.xml');
  let colorsXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgColorHex}</color>\n</resources>\n`;
  fs.writeFileSync(colorsXmlPath, colorsXml);

  // 4. Splash icon in drawable
  const drawableDir = path.join(resPath, 'drawable');
  if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
  await sharp(masters.splash)
    .toFile(path.join(drawableDir, 'splash_icon.png'));

  // 5. Pre-Android 12 launch_background.xml
  const launchBgXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_icon" />
    </item>
</layer-list>
`;
  fs.writeFileSync(path.join(drawableDir, 'launch_background.xml'), launchBgXml);

  const drawableV21 = path.join(resPath, 'drawable-v21');
  if (fs.existsSync(drawableV21)) {
    fs.writeFileSync(path.join(drawableV21, 'launch_background.xml'), launchBgXml);
  }

  // 6. Android 12+ (API 31+) values-v31/styles.xml
  const valuesV31 = path.join(resPath, 'values-v31');
  if (!fs.existsSync(valuesV31)) fs.mkdirSync(valuesV31, { recursive: true });
  const stylesV31Xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowSplashScreenBackground">${bgColorHex}</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowSplashScreenIconBackgroundColor">${bgColorHex}</item>
    </style>
    <style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowBackground">?android:colorBackground</item>
    </style>
</resources>
`;
  fs.writeFileSync(path.join(valuesV31, 'styles.xml'), stylesV31Xml);
}

async function run() {
  const customerMasters = await createCustomerMasterIcons();
  await writeIcons(CUSTOMER_RES, {
    square: customerMasters.customerMasterSquare,
    round: customerMasters.customerMasterRound,
    fg: customerMasters.customerMasterFg,
    splash: customerMasters.customerSplashIcon,
  }, false);

  const riderMasters = await createRiderMasterIcons();
  await writeIcons(RIDER_RES, {
    square: riderMasters.riderMasterSquare,
    round: riderMasters.riderMasterRound,
    fg: riderMasters.riderMasterFg,
    splash: riderMasters.riderSplashIcon,
  }, true);

  console.log('✅ ALL APP ICONS AND NATIVE SPLASH SCREENS SUCCESSFULLY REGENERATED WITH PERFECT SAFE MARGINS!');
}

run().catch(console.error);
