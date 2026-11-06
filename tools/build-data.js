// 把三份教材 md 轉換成遊戲資料 data/units.js
// 用法：node tools/build-data.js
// 教材正本：中二級名句.md、中二級成語.md、中二級錯別字.md。修改教材後重新執行一次即可，遊戲程式不用改動。
// 輸出 .js（而不是 .json），是為了讓 index.html 直接雙擊開啟時也能載入資料。
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');

// 按「## 單元」切開
function splitUnits(md) {
  return md.split(/^## 單元/m).slice(1).map((s) => '## 單元' + s);
}

// 讀取「| 項目 | 內容 |」兩欄表格
function readTable(block) {
  const o = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*$/);
    if (!m) continue;
    if (m[1] === '項目' || /^-+$/.test(m[1])) continue;
    o[m[1]] = m[2];
  }
  return o;
}

// 按「### 」標題切開
function splitHeadings(block) {
  const re = /^### (.+)$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(block))) heads.push({ title: m[1].trim(), start: m.index, bodyStart: re.lastIndex });
  return heads.map((h, i) => ({ title: h.title, body: block.slice(h.bodyStart, i + 1 < heads.length ? heads[i + 1].start : block.length) }));
}

const list = (s) => (!s || s.trim() === '／' ? [] : s.split('、').map((x) => x.trim()).filter(Boolean));

// ---------- 名句 ----------
const quoteUnits = splitUnits(read('中二級名句.md')).map((sec) => {
  const title = sec.match(/^## (.+)$/m)[1].trim();
  const quotes = splitHeadings(sec).map((h) => {
    const t = readTable(h.body);
    return {
      text: h.title.replace(/^\d+\.\s*/, ''),
      translation: t['語譯'] || '',
      meaning: t['釋義'] || '',
      source: t['出處'] || '',
    };
  });
  return { title, quotes };
});

// ---------- 成語 ----------
const idiomUnits = splitUnits(read('中二級成語.md')).map((sec) => {
  const idioms = [];
  let exercises = [];
  for (const h of splitHeadings(sec)) {
    if (h.title.includes('練習')) {
      const [qPart, aPart = ''] = h.body.split('<details>');
      const qs = [...qPart.matchAll(/^\d+\.\s*(.+)$/gm)].map((m) => m[1].trim());
      const as = [...aPart.matchAll(/^\d+\.\s*(.+)$/gm)].map((m) => m[1].trim());
      exercises = qs.map((s, i) => ({ sentence: s.replace(/＿+/g, '＿＿＿＿'), answer: as[i] }));
      continue;
    }
    const t = readTable(h.body);
    const meaningRaw = t['釋義'] || '';
    const tone = (meaningRaw.match(/【(褒義|貶義|中性)】/) || [])[1] || '中性';
    idioms.push({
      word: h.title.replace(/^\d+\.\s*/, ''),
      synonyms: list(t['近義']),
      antonyms: list(t['反義']),
      meaning: meaningRaw.replace(/【.+?】/g, '').trim(),
      tone,
      example: t['例句'] || '',
    });
  }
  return { idioms, exercises };
});

// ---------- 錯別字 ----------
const typoUnits = splitUnits(read('中二級錯別字.md')).map((sec) => {
  const typos = [];
  for (const line of sec.split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!m) continue;
    const fixAlts = m[3].split('／');
    const correctAlts = m[4].split('／');
    const wrong = m[2];
    const correct = correctAlts[0];
    // 找出錯字所在位置（可能多於一個，例如「謬謬然」）
    const pos = [];
    for (let i = 0; i < wrong.length; i++) if (wrong[i] !== correct[i]) pos.push(i);
    if (wrong.length !== correct.length || pos.length === 0) throw new Error('錯別字資料無法比對：' + line);
    typos.push({ no: +m[1], wrong, fix: fixAlts[0], fixAlts, correct, correctAlts, pos, wrongChar: wrong[pos[0]] });
  }
  return { typos };
});

if (quoteUnits.length !== 8 || idiomUnits.length !== 8 || typoUnits.length !== 8) {
  throw new Error(`單元數目不是 8：名句 ${quoteUnits.length}、成語 ${idiomUnits.length}、錯別字 ${typoUnits.length}`);
}

const units = quoteUnits.map((q, i) => ({
  id: i + 1,
  title: q.title,
  theme: q.title.split('——')[1] || q.title,
  quotes: q.quotes,
  idioms: idiomUnits[i].idioms,
  exercises: idiomUnits[i].exercises,
  typos: typoUnits[i].typos,
}));

// 簡單檢查
for (const u of units) {
  if (u.exercises.length !== u.idioms.length) console.warn(`警告：${u.title} 練習題數（${u.exercises.length}）與成語數（${u.idioms.length}）不同`);
  for (const e of u.exercises) {
    if (!u.idioms.some((x) => x.word === e.answer)) console.warn(`警告：${u.title} 練習答案「${e.answer}」不在成語表內`);
  }
  console.log(`${u.title}：名句 ${u.quotes.length}、成語 ${u.idioms.length}、練習 ${u.exercises.length}、錯別字 ${u.typos.length}`);
}

const out = '// 由 tools/build-data.js 自動產生，請勿直接修改。修改教材 md 後重新執行：node tools/build-data.js\nwindow.UNITS = ' + JSON.stringify(units, null, 1) + ';\n';
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'units.js'), out, 'utf8');
console.log('已輸出 data/units.js');
