// 題目產生器：由教材資料（UNITS）和草擬內容（EXTRA）組成各種題目
(function (G) {
  const { h, shuffle, sample, pick } = G;
  const U = window.UNITS;
  const E = window.EXTRA;

  G.unit = (id) => U[id - 1];
  G.island = (id) => E.islands[id - 1];
  G.units = U;

  // 把釋義中出現的成語本身遮去，以免提示直接洩露答案
  // 同時去掉句末句號，方便放入「」內
  const mask = (text, word) => text.split(word).join('□'.repeat([...word].length)).replace(/[。！？]$/, '');

  // ---------- 答題後的解說 ----------
  function idiomAfter(id) {
    return h('div.after',
      h('div.after-title.kai', id.word, h('span.tone.tone-' + id.tone, '【' + id.tone + '】')),
      h('p', h('b', '釋義：'), id.meaning),
      id.synonyms.length ? h('p', h('b', '近義：'), id.synonyms.join('、')) : null,
      id.antonyms.length ? h('p', h('b', '反義：'), id.antonyms.join('、')) : null,
      h('p', h('b', '例句：'), id.example),
    );
  }
  function quoteAfter(qt) {
    return h('div.after',
      h('div.after-title.kai.quote', qt.text),
      h('p', h('b', '語譯：'), qt.translation),
      h('p', h('b', '出處：'), qt.source),
    );
  }
  function typoAfter(t) {
    return h('div.after',
      h('div.fb-small', '正確寫法：'),
      G.correctWord(t.correct, t.pos, 'word big'),
      t.correctAlts.length > 1 ? h('p.fb-small', '也可寫作「' + t.correctAlts.slice(1).join('」「') + '」。') : null,
    );
  }
  function notesAfter(main, notes) {
    return () => h('div.after-wrap', main ? main() : null,
      h('div.notes', h('div.notes-title', '各選項的意思：'), notes.map((n) => h('div.note' + (n.right ? '.right' : ''), h('b', (n.right ? '✓ ' : '') + n.name.replace(/[。！？]$/, '') + '：'), n.text))));
  }
  G.idiomAfter = idiomAfter;
  G.quoteAfter = quoteAfter;

  // 抽出同一單元其他項目作選項
  function othersFrom(arr, exceptIdx, n) {
    return sample(arr.map((x, i) => i).filter((i) => i !== exceptIdx), n);
  }

  const Q = {};
  G.Q = Q;

  // ---------- 錯別字 ----------
  Q.typoKey = (u, i) => `t${u.id}-${i}`;
  function typoOptions(u, i, len = 1) {
    const t = u.typos[i];
    const d = [...E.typoDistractors[u.id][i]];
    return shuffle([t.fix, t.wrongChar, d[0], d[1]]).map((c) => c.repeat(len));
  }

  // 辨字快答：判斷 → 點出錯字 → 選正字
  Q.typoJudge = (u, i, showWrong) => {
    const t = u.typos[i];
    return {
      type: 'judge', label: '辨字快答',
      shown: showWrong ? t.wrong : t.correct, isWrong: showWrong,
      pos: t.pos, options: typoOptions(u, i), fix: t.fix, correct: t.correct,
      item: { key: Q.typoKey(u, i) }, stamp: `${u.id}-${i}`,
      after: () => typoAfter(t),
    };
  };

  // 點出詞語中的錯字並改正（魔王城用）
  const demonTypoLines = [
    (w) => `我最喜歡「${w}」這個詞，寫得多漂亮！`,
    (w) => `勇者，「${w}」這個寫法一點錯也沒有，對吧？`,
    (w) => `我在城牆上寫了「${w}」，筆畫多工整！`,
  ];
  Q.typoFix = (u, i, demon) => {
    const t = u.typos[i];
    const len = t.pos.length;
    let text, start;
    // 如果這個詞語出現在本島任何一篇短文，就用短文中的句子
    const p = (E.passages[u.id] || []).find((x) => x.typos.includes(t.correct));
    const sentence = p && len === 1
      ? p.text.split(/(?<=[。！？])/).find((s) => s.includes(t.correct)) : null;
    if (sentence) {
      text = sentence.replace(t.correct, t.wrong).replace(/^[「」]+|[「」]+$/g, '');
      start = [...text].join('').indexOf(t.wrong) + t.pos[0];
    } else {
      text = pick(demonTypoLines)(t.wrong);
      start = text.indexOf(t.wrong) + t.pos[0];
    }
    return {
      type: 'findfix', label: demon ? '指正魔王' : '錯字門',
      speaker: demon ? 'demon' : null,
      speech: demon ? E.demon.correctMe : null,
      prompt: '這句話藏着一個錯字。點出錯字，再改正。',
      text,
      targets: [{ start, len, options: typoOptions(u, i, len), answer: t.fix.repeat(len), correct: t.correct, key: Q.typoKey(u, i) }],
      item: { key: Q.typoKey(u, i) }, stamp: `${u.id}-${i}`,
      hint: '提示：「' + [...t.correct].map((c, k) => (t.pos.includes(k) ? '□' : c)).join('') + '」中空着的字寫錯了。',
      after: () => typoAfter(t),
    };
  };

  // 捉錯字短文：每島有多篇，隨機抽一篇，不會連續兩次抽到同一篇
  Q.passage = (u, index) => {
    const list = E.passages[u.id];
    const last = G.store.state.passages;
    let k = index;
    if (k == null) {
      const choices = list.map((x, i) => i).filter((i) => list.length === 1 || i !== last[u.id]);
      k = pick(choices);
      last[u.id] = k; // 指定篇目時（老師審訂試玩）不影響學生的抽題次序
      G.store.save();
    }
    const p = list[k];
    let text = p.text;
    const items = p.typos.map((w) => {
      const i = u.typos.findIndex((t) => t.correct === w);
      return { t: u.typos[i], i };
    });
    for (const { t } of items) text = text.replace(t.correct, t.wrong);
    const targets = items.map(({ t, i }) => ({
      start: text.indexOf(t.wrong) + t.pos[0], len: 1,
      options: typoOptions(u, i), answer: t.fix, correct: t.correct, key: Q.typoKey(u, i),
    })).sort((a, b) => a.start - b.start);
    return {
      type: 'findfix', multi: true, label: '捉錯字短文：' + p.title,
      text, targets, items: items.map(({ i }) => ({ key: Q.typoKey(u, i), stamp: `${u.id}-${i}` })),
    };
  };

  // ---------- 成語 ----------
  Q.idiomKey = (u, i) => `i${u.id}-${i}`;
  const idiomItem = (u, i) => ({ key: Q.idiomKey(u, i), card: Q.idiomKey(u, i) });

  Q.idiomSpell = (u, i) => {
    const id = u.idioms[i];
    const chars = [...id.word];
    return {
      type: 'order', label: '拼成語', layout: 'chars',
      prompt: '依次點選，拼回正確的成語。（點選已放好的字可以移走）',
      clue: '意思：' + mask(id.meaning, id.word),
      pieces: shuffle(chars.concat([...E.idiomDistractors[id.word]])), answer: chars,
      item: idiomItem(u, i), hint: '提示：這是一個【' + id.tone + '】成語，第一個字是「' + chars[0] + '」。',
      after: () => idiomAfter(id),
    };
  };

  function idiomChoices(u, i) {
    const idx = shuffle([i].concat(othersFrom(u.idioms, i, 3)));
    return { idx, options: idx.map((k) => u.idioms[k].word), answer: idx.indexOf(i) };
  }

  // 例句填空（教材練習）
  Q.idiomFill = (u, e) => {
    const ex = u.exercises[e];
    const i = u.idioms.findIndex((x) => x.word === ex.answer);
    const id = u.idioms[i];
    const c = idiomChoices(u, i);
    return {
      type: 'mcq', label: '例句填空', prompt: '選出最合適的成語，填在橫線上。', sentence: ex.sentence,
      options: c.options, answer: c.answer,
      item: idiomItem(u, i),
      hint1: '提示：答案的意思是「' + mask(id.meaning, id.word) + '」。',
      hint: '提示：答案的意思是「' + mask(id.meaning, id.word) + '」。',
      after: () => h('div.after-wrap', h('p.filled-sentence', ex.sentence.replace('＿＿＿＿', '「' + ex.answer + '」')), idiomAfter(id)),
    };
  };

  // 情境選擇
  Q.idiomScene = (u, i) => {
    const id = u.idioms[i];
    const c = idiomChoices(u, i);
    return {
      type: 'mcq', label: '情境選擇', prompt: '哪個成語最貼切？', sentence: E.idiomScenes[id.word],
      options: c.options, answer: c.answer,
      item: idiomItem(u, i),
      hint1: '提示：答案是一個【' + id.tone + '】成語。',
      hint: '提示：答案的意思是「' + mask(id.meaning, id.word) + '」。',
      after: notesAfter(null, c.idx.map((k) => ({ name: u.idioms[k].word, text: u.idioms[k].meaning, right: k === i }))),
    };
  };

  // 指正魔王：成語誤用（教材練習句子換入另一個成語）
  Q.idiomMisuse = (u, e) => {
    const ex = u.exercises[e];
    const i = u.idioms.findIndex((x) => x.word === ex.answer);
    const id = u.idioms[i];
    const wrongIdx = pick(othersFrom(u.idioms, i, 6));
    const wrong = u.idioms[wrongIdx].word;
    const text = ex.sentence.replace('＿＿＿＿', wrong);
    const extra = othersFrom(u.idioms, i, 6).filter((k) => k !== wrongIdx).slice(0, 2).map((k) => u.idioms[k].word);
    return {
      type: 'findfix', label: '指正魔王：成語誤用', speaker: 'demon', speech: E.demon.correctMe,
      prompt: '魔王的話用錯了一個成語。點出用錯的成語，再改正。',
      text,
      targets: [{ start: text.indexOf(wrong), len: [...wrong].length, options: shuffle([id.word, wrong].concat(extra)), answer: id.word, key: Q.idiomKey(u, i) }],
      item: idiomItem(u, i),
      hint: '提示：這裏應該用一個意思是「' + mask(id.meaning, id.word) + '」的成語。',
      after: () => h('div.after-wrap', h('p.filled-sentence', ex.sentence.replace('＿＿＿＿', '「' + ex.answer + '」')), idiomAfter(id)),
    };
  };

  // ---------- 名句 ----------
  Q.quoteKey = (u, i) => `q${u.id}-${i}`;
  const quoteItem = (u, i) => ({ key: Q.quoteKey(u, i), card: Q.quoteKey(u, i) });

  // 按標點把名句切成分句；較短的名句按兩字一塊再切
  function chunks(text) {
    const parts = text.match(/[^，。；？！、：]+[，。；？！、：]*/g) || [text];
    if (parts.length >= 3) return parts;
    const out = [];
    for (const p of parts) {
      const cs = [...p];
      const punct = [];
      while (cs.length && !G.isHan(cs[cs.length - 1])) punct.unshift(cs.pop());
      for (let k = 0; k < cs.length; k += 2) out.push(cs.slice(k, k + 2).join(''));
      out[out.length - 1] += punct.join('');
    }
    return out;
  }
  Q.chunks = chunks;

  Q.quoteArrange = (u, i) => {
    const qt = u.quotes[i];
    const parts = chunks(qt.text);
    const isShort = (qt.text.match(/[，。；？！]/g) || []).length < 3;
    let pieces = shuffle(parts);
    if (pieces.join('') === parts.join('')) pieces = shuffle(parts);
    return {
      type: 'order', label: '排名句', layout: isShort ? 'blocks' : 'lines',
      prompt: '依次點選，把名句排回正確次序。',
      clue: '語譯：' + qt.translation,
      pieces, answer: parts,
      item: quoteItem(u, i), hint: '提示：出處是' + qt.source + '。',
      after: () => quoteAfter(qt),
    };
  };

  function quoteChoices(u, i) {
    const idx = shuffle([i].concat(othersFrom(u.quotes, i, 3)));
    return { idx, options: idx.map((k) => u.quotes[k].text), answer: idx.indexOf(i) };
  }

  // 語譯配對（基礎模式）
  Q.quoteTrans = (u, i) => {
    const qt = u.quotes[i];
    const c = quoteChoices(u, i);
    return {
      type: 'mcq', label: '語譯配對', long: true, prompt: '這是哪一句名句的語譯？', sentence: qt.translation,
      options: c.options, answer: c.answer, item: quoteItem(u, i),
      hint1: '提示：這句名句出自' + qt.source + '。', hint: '提示：這句名句出自' + qt.source + '。',
      after: () => quoteAfter(qt),
    };
  };

  // 出處配對（挑戰模式）
  Q.quoteSource = (u, i) => {
    const qt = u.quotes[i];
    const all = [...new Set(U.flatMap((x) => x.quotes.map((y) => y.source)))].filter((s) => s !== qt.source);
    const options = shuffle([qt.source].concat(sample(all, 3)));
    return {
      type: 'mcq', label: '出處配對', prompt: '這句名句出自哪裏？', sentence: qt.text,
      options, answer: options.indexOf(qt.source), item: quoteItem(u, i),
      hint1: '提示：留意作者所屬的朝代。', hint: '提示：語譯是「' + qt.translation.replace(/。$/, '') + '」。',
      after: () => quoteAfter(qt),
    };
  };

  // 名句用得着
  Q.quoteScene = (u, i) => {
    const qt = u.quotes[i];
    const c = quoteChoices(u, i);
    return {
      type: 'mcq', label: '名句用得着', long: true, prompt: '這個處境，用哪一句名句最合適？', sentence: E.quoteScenes[u.id][i],
      options: c.options, answer: c.answer, item: quoteItem(u, i),
      hint1: '提示：答案的意思是「' + qt.meaning.replace(/。$/, '') + '」。', hint: '提示：答案的語譯是「' + qt.translation.replace(/。$/, '') + '」。',
      after: notesAfter(null, c.idx.map((k) => ({ name: u.quotes[k].text, text: u.quotes[k].meaning, right: k === i }))),
    };
  };

  // 指正魔王：名句錯字
  Q.quoteFix = (u, i) => {
    const qt = u.quotes[i];
    const [wrongText, d] = E.quoteErrors[u.id][i];
    const a = [...qt.text], b = [...wrongText];
    const k = a.findIndex((c, j) => c !== b[j]);
    return {
      type: 'findfix', label: '指正魔王：名句錯字', speaker: 'demon', speech: '古人就是這樣說的，一字不差！',
      prompt: '魔王把名句說錯了一個字。點出錯字，再改正。',
      text: wrongText,
      targets: [{ start: k, len: 1, options: shuffle([a[k], b[k]].concat([...d])), answer: a[k], correct: qt.text, key: Q.quoteKey(u, i) }],
      item: quoteItem(u, i),
      hint: '提示：語譯是「' + qt.translation.replace(/。$/, '') + '」。',
      after: () => quoteAfter(qt),
    };
  };
})(window.G);
