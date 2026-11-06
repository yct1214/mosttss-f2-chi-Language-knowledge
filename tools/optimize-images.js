// 把 assets/images 的原圖裁去透明邊、縮小並轉為 WebP，輸出到 assets/img（遊戲實際使用的版本）。
// 原圖不會被修改。需要先安裝 sharp：npm install sharp
// 用法：node tools/optimize-images.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'images');
const dst = path.join(root, 'assets', 'img');

const jobs = [];
const add = (dir, file, opt) => jobs.push({ in: path.join(src, dir, file), out: path.join(dst, dir, file.replace(/\.(png|jpe?g|webp)$/i, '.webp')), ...opt });

for (const f of fs.readdirSync(path.join(src, 'characters'))) add('characters', f, { w: 640, h: 860, trim: true, q: 82 });
for (const f of fs.readdirSync(path.join(src, 'islands'))) add('islands', f, f.includes('castle') ? { w: 640, h: 640, trim: true, q: 80 } : { w: 480, h: 480, trim: true, q: 80 });
for (const f of fs.readdirSync(path.join(src, 'treasures'))) add('treasures', f, { w: 280, h: 280, trim: true, q: 85 });
for (const f of fs.readdirSync(path.join(src, 'cards'))) add('cards', f, { w: 600, h: 840, q: 80 });
for (const f of fs.readdirSync(path.join(src, 'backgrounds'))) add('backgrounds', f, { w: 1600, h: 1600, q: 72 });
add('', 'cover.jpeg', { w: 1600, h: 1600, q: 75 });
add('', 'ending.jpeg', { w: 1600, h: 1600, q: 75 });

(async () => {
  for (const j of jobs) {
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    let img = sharp(j.in);
    if (j.trim) {
      // 先裁去透明邊，再留少許邊距
      const buf = await img.trim({ threshold: 10 }).png().toBuffer();
      img = sharp(buf).extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } });
      img = sharp(await img.png().toBuffer());
    }
    await img.resize({ width: j.w, height: j.h, fit: 'inside', withoutEnlargement: true }).webp({ quality: j.q, alphaQuality: 90 }).toFile(j.out);
    const meta = await sharp(j.out).metadata();
    console.log(`${path.relative(dst, j.out)}  ${meta.width}x${meta.height}  ${Math.round(fs.statSync(j.out).size / 1024)} KB`);
  }
})();
