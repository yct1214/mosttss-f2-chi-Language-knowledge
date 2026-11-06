// 設定老師審訂模式的密碼：node tools/teacher-code.js 新密碼
// 會把密碼的雜湊值寫入 data/extra.js 的 EXTRA.teacherCodeHash。
// 雜湊方法要與 js/review.js 的 hashCode() 相同。
const fs = require('fs');
const path = require('path');

function hashCode(s) {
  let x = 0x811c9dc5;
  for (const b of Buffer.from('jiudao:' + s.trim(), 'utf8')) {
    x ^= b;
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x.toString(16).padStart(8, '0');
}

const code = process.argv[2];
if (!code) {
  console.log('用法：node tools/teacher-code.js 新密碼');
  process.exit(1);
}
const file = path.join(__dirname, '..', 'data', 'extra.js');
const src = fs.readFileSync(file, 'utf8');
const out = src.replace(/EXTRA\.teacherCodeHash = '[0-9a-f]*';/, `EXTRA.teacherCodeHash = '${hashCode(code)}';`);
if (out === src && !src.includes(hashCode(code))) {
  console.log('找不到 EXTRA.teacherCodeHash，未能更新。');
  process.exit(1);
}
fs.writeFileSync(file, out, 'utf8');
console.log('已更新老師審訂模式密碼。');
