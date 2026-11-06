// 內容檢查：data/extra.js 與 data/units.js 是否配合（干擾字、短文、情境題、名句錯字版本）
// 瀏覽器（老師審訂模式）和 Node（tools/check-data.js）共用同一套規則。
(function (root) {
  function checkData(U, E) {
    const problems = [];
    const info = [];
    const bad = (msg) => problems.push(msg);

    for (const u of U) {
      const td = E.typoDistractors[u.id];
      if (!td || td.length !== u.typos.length) bad(`${u.title}：錯別字干擾字數目不對`);
      u.typos.forEach((t, i) => {
        const d = (td && td[i]) || '';
        if ([...d].length !== 2) bad(`${u.title} 錯別字 ${t.no}：干擾字不是兩個`);
        for (const c of d) {
          if (t.fixAlts.includes(c) || c === t.wrongChar) bad(`${u.title} 錯別字 ${t.no}（${t.correct}）：干擾字「${c}」與正字或錯字相同`);
        }
        if (d[0] === d[1]) bad(`${u.title} 錯別字 ${t.no}：兩個干擾字相同`);
      });

      const plist = E.passages[u.id];
      if (!Array.isArray(plist) || !plist.length) bad(`${u.title}：沒有短文`);
      else {
        const usedWords = {};
        plist.forEach((p, k) => {
          const name = `${u.title} 短文 ${k + 1}〈${p.title}〉`;
          const len = [...p.text].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;
          if (len < 140 || len > 210) bad(`${name}：字數 ${len}，不在 150–200 左右`);
          if (p.typos.length !== 6) bad(`${name}：藏了 ${p.typos.length} 個錯字，應為 6 個`);
          if (new Set(p.typos).size !== p.typos.length) bad(`${name}：錯字詞語重複`);
          for (const w of p.typos) {
            const t = u.typos.find((x) => x.correct === w);
            if (!t) bad(`${name}：「${w}」不是本單元的錯別字詞語`);
            else if (t.pos.length !== 1) bad(`${name}：「${w}」有多於一個錯字，不適合放入短文`);
            if (!p.text.includes(w)) bad(`${name}：找不到「${w}」`);
            if (usedWords[w] != null) bad(`${name}：「${w}」已在短文 ${usedWords[w] + 1} 使用`);
            usedWords[w] = k;
          }
          // 短文中不可出現教材的錯誤寫法
          for (const t of u.typos) if (p.text.includes(t.wrong)) bad(`${name}：含有錯誤寫法「${t.wrong}」`);
          // 放入錯字後，每個錯字都要找得到
          let text = p.text;
          for (const w of p.typos) {
            const t = u.typos.find((x) => x.correct === w);
            if (t) text = text.replace(t.correct, t.wrong);
          }
          for (const w of p.typos) {
            const t = u.typos.find((x) => x.correct === w);
            if (t && !text.includes(t.wrong)) bad(`${name}：放入錯字後找不到「${t.wrong}」`);
          }
        });
        info.push(`${u.title}：${plist.length} 篇短文，涵蓋 ${Object.keys(usedWords).length} / ${u.typos.length} 個錯別字`);
      }

      for (const id of u.idioms) {
        const d = E.idiomDistractors[id.word];
        if (!d || [...d].length !== 2) bad(`成語「${id.word}」：干擾字不對`);
        else for (const c of d) if (id.word.includes(c)) bad(`成語「${id.word}」：干擾字「${c}」是成語中的字`);
        if (!E.idiomScenes[id.word]) bad(`成語「${id.word}」：沒有情境題`);
        else if (E.idiomScenes[id.word].includes(id.word)) bad(`成語「${id.word}」：情境題直接寫出了答案`);
      }

      const qs = E.quoteScenes[u.id] || [];
      if (qs.length !== u.quotes.length) bad(`${u.title}：名句情境題數目不對`);
      const qe = E.quoteErrors[u.id] || [];
      if (qe.length !== u.quotes.length) bad(`${u.title}：名句錯字版本數目不對`);
      u.quotes.forEach((q, i) => {
        const [w, d] = qe[i] || ['', ''];
        const a = [...q.text], b = [...w];
        if (a.length !== b.length) { bad(`${u.title} 名句 ${i + 1}：錯字版本長度不同`); return; }
        const diff = a.map((c, k) => (c !== b[k] ? k : -1)).filter((k) => k >= 0);
        if (diff.length !== 1) { bad(`${u.title} 名句 ${i + 1}：錯字版本改動了 ${diff.length} 個字`); return; }
        const right = a[diff[0]], wrong = b[diff[0]];
        for (const c of d) if (c === right || c === wrong) bad(`${u.title} 名句 ${i + 1}：干擾字「${c}」與正字或錯字相同`);
      });
    }
    for (const k of Object.keys(E.idiomDistractors)) if (!U.some((u) => u.idioms.some((x) => x.word === k))) bad(`干擾字表中的「${k}」不是教材成語`);
    return { problems, info };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = checkData;
  else root.checkData = checkData;
})(typeof window !== 'undefined' ? window : globalThis);
