/**
 * make-store-assets.cjs: renders the graphics the store listings need.
 *
 * The Chrome Web Store asks for a 128x128 small icon, a 128x800 or 640x400 small
 * badge, and at least one screenshot at 1280x800 or 640x400. Firefox asks for
 * the same icon plus optional extra screenshots.
 *
 * These are rendered from HTML in a real browser rather than drawn in an image
 * editor, so the result is crisp at the exact pixel size the store wants and
 * can be re-rendered after a text change.
 *
 * Run: node make-store-assets.cjs
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'store-assets-src');
const OUT = path.join(ROOT, 'store-assets');
const EXT = path.join(ROOT, 'store-build');

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('store-build/manifest.json saknas. Kör: node build-store.mjs');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const PROFILE = path.join(os.tmpdir(), 'aam-store-assets-profile');

(async () => {
  if (fs.existsSync(PROFILE)) fs.rmSync(PROFILE, { recursive: true, force: true });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chromium',
    headless: false,
    viewport: null,
    args: [
      '--disable-features=Translate',
      '--force-device-scale-factor=1',
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
    ],
  });

  const page = await ctx.newPage();

  async function render(htmlFile, w, h, name) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('file:///' + htmlFile.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    const out = path.join(OUT, name);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
    console.log(`  ${name.padEnd(34)} ${w}x${h}  ${fs.statSync(out).size} byte`);
  }

  console.log('Genererade butiksbilder:');
  for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith('.html')).sort()) {
    const name = f.replace(/\.html$/, '');
    // Each source declares its own sizes in a comment: sizes: 1280x800,640x400
    const head = fs.readFileSync(path.join(SRC, f), 'utf8').slice(0, 400);
    const m = /sizes:\s*([\dx,]+)/.exec(head);
    const sizes = m ? m[1].split(',').map((s) => s.trim().split('x').map(Number)) : [[1280, 800]];
    for (const [w, h] of sizes) {
      await render(path.join(SRC, f), w, h, `${name}-${w}x${h}.png`);
    }
  }

  // The store icon comes straight from the packaged icons, so the listing and
  // the extension can never show different logos.
  const iconSrc = path.join(EXT, 'icons', 'icon128.png');
  const iconOut = path.join(OUT, 'icon-128x128.png');
  fs.copyFileSync(iconSrc, iconOut);
  console.log(`  ${'icon-128x128.png'.padEnd(34)} 128x128  ${fs.statSync(iconOut).size} byte`);

  await ctx.close();
  console.log(`\nKlart. Bilderna ligger i ${path.relative(ROOT, OUT)}/`);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
