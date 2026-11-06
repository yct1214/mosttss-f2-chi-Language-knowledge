// 老師審訂模式：不用逐關遊玩，直接查看全部題目、答案和草擬內容，並可試玩任何一題、示範任何關卡。
// 黃色標示的是草擬內容（data/extra.js），其餘是教材原文（三份 md 檔）。
(function (G) {
  const { h, Q } = G;
  const E = window.EXTRA;
  const KEY = 'jd-teacher';
  const state = { island: 1, tab: 'typo' };

  // 與 tools/teacher-code.js 相同的雜湊方法
  function hashCode(s) {
    let x = 0x811c9dc5;
    for (const b of new TextEncoder().encode('jiudao:' + s.trim())) {
      x ^= b;
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(16).padStart(8, '0');
  }

  const OPEN = 'jd-teacher-open';      // 全地圖解鎖
  const ANSWERS = 'jd-teacher-answers'; // 遊玩時顯示答案
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { if (v) sessionStorage.setItem(k, '1'); else sessionStorage.removeItem(k); } catch (e) { /* 忽略 */ } },
  };

  G.teacher = {
    // 只在本次瀏覽期間有效，關閉分頁後要重新輸入
    unlocked: () => ss.get(KEY) === '1',
    lock() { ss.set(KEY, false); ss.set(OPEN, false); ss.set(ANSWERS, false); },
    unlock() { ss.set(KEY, true); },
    // 全地圖解鎖：島主試煉、魔王城、三道城門、魔王決戰全部開放，但不會改動已儲存的進度
    allOpen: () => G.teacher.unlocked() && ss.get(OPEN) === '1',
    setAllOpen(on) { ss.set(OPEN, on); },
    // 遊玩時在題目旁邊以括號顯示正確答案
    showAnswers: () => G.teacher.unlocked() && ss.get(ANSWERS) === '1',
    setShowAnswers(on) { ss.set(ANSWERS, on); },
  };

  G.go.teacherLogin = async function () {
    if (G.teacher.unlocked()) return G.go.review();
    const input = h('input.code-input', { type: 'password', autocomplete: 'off', 'aria-label': '老師密碼' });
    const err = h('p.fb-small.err', { 'aria-live': 'polite' });
    for (;;) {
      const p = G.modal({
        title: '老師審訂模式',
        body: h('div', h('p', '請輸入老師密碼。'), input, err),
        buttons: [{ label: '取消', value: false, cls: 'ghost' }, { label: '進入', value: true }],
      });
      setTimeout(() => {
        input.focus();
        input.onkeydown = (e) => { if (e.key === 'Enter') document.querySelector('.modal-buttons .btn:last-child').click(); };
      }, 0);
      if (!(await p)) return;
      if (hashCode(input.value) === E.teacherCodeHash) {
        G.teacher.unlock();
        return G.go.review();
      }
      err.textContent = '密碼不正確，請再試一次。';
      input.value = '';
    }
  };

  // ---------- 共用小工具 ----------
  const draft = (...kids) => h('span.draft', ...kids);
  const draftTag = () => h('span.tag-draft', '草擬');
  const auto = () => h('span.tag-auto', '自動');
  const src = (text) => h('div.src', '修改位置：' + text);
  const hanCount = (s) => [...s].filter((c) => /[\u4e00-\u9fff]/.test(c)).length;

  // 在彈出視窗中試玩一題（練習模式，不記錄進度）
  function preview(title, make) {
    const host = h('div.preview-host');
    G.modal({ title: '試玩：' + title, body: host, cls: 'wide', dismissible: true, buttons: [{ label: '關閉', value: true }] });
    const run = G.ask(make(), host, { practice: true, lantern: { left: 3 }, praise: () => '（試玩，不會記錄進度）', nextLabel: '完成試玩' });
    run.promise.then(() => {
      const b = document.querySelector('.modal.wide .modal-buttons .btn');
      if (b) b.click();
    });
  }
  const tryBtn = (label, title, make) => h('button.btn.small', { onclick: () => preview(title, make) }, '▶ ' + label);

  // 把文字中指定的範圍加上標示
  function marked(text, ranges, cls) {
    const chars = [...text];
    const out = [];
    let i = 0;
    for (const r of ranges.slice().sort((a, b) => a.start - b.start)) {
      if (r.start > i) out.push(chars.slice(i, r.start).join(''));
      out.push(h('mark.' + cls, chars.slice(r.start, r.start + r.len).join('')));
      i = r.start + r.len;
    }
    if (i < chars.length) out.push(chars.slice(i).join(''));
    return out;
  }

  // ---------- 錯別字 ----------
  function typoTab(u) {
    const used = {};
    E.passages[u.id].forEach((p, k) => p.typos.forEach((w) => { used[w] = `短文 ${k + 1}〈${p.title}〉`; }));
    const rows = u.typos.map((t, i) => {
      const d = [...E.typoDistractors[u.id][i]];
      return h('tr',
        h('td', t.no),
        h('td.kai.wrong-text', t.wrong),
        h('td', G.correctWord(t.correct, t.pos, 'word mini'), t.correctAlts.length > 1 ? h('small', '也可：' + t.correctAlts.slice(1).join('、')) : null),
        h('td', h('span.opt-right', t.fix), ' ', h('span.opt-wrong', t.wrongChar), ' ', draft(d.join(' '))),
        h('td.small', used[t.correct] || '—'),
        h('td.actions', tryBtn('辨字', t.correct, () => Q.typoJudge(u, i, true)), tryBtn('魔王句子', t.correct, () => Q.typoFix(u, i, true))));
    });
    return h('div',
      h('p.fb-small', '選項：綠色是正字，紅色是教材錯字，黃色是草擬的兩個干擾字。辨字快答時，錯誤寫法和正確寫法各佔一半。同一題答對兩次就蓋上正字印章。'),
      h('div.table-wrap', h('table.review-table',
        h('thead', h('tr', ['編號', '錯誤寫法', '正確寫法', '選項', '用於短文', '試玩'].map((x) => h('th', x)))),
        h('tbody', rows))),
      src(`教材：中二級錯別字.md；干擾字：data/extra.js → EXTRA.typoDistractors[${u.id}]（次序與編號相同）`));
  }

  // ---------- 捉錯字短文 ----------
  function passageTab(u) {
    return h('div', E.passages[u.id].map((p, k) => {
      const q = Q.passage(u, k);
      const rightRanges = p.typos.map((w) => ({ start: [...p.text].join('').indexOf(w), len: [...w].length }));
      return h('section.review-card',
        h('h3', `短文 ${k + 1}〈${p.title}〉`, draftTag(), h('span.fb-small', `　${hanCount(p.text)} 字`)),
        h('div.review-label', '老師撰寫的原文（標示的詞語會藏入錯字）：'),
        h('p.passage-text.kai', marked(p.text, rightRanges, 'hl-right')),
        h('div.review-label', '學生看到的版本：'),
        h('p.passage-text.kai', marked(q.text, q.targets.map((t) => ({ start: t.start, len: 1 })), 'hl-wrong')),
        h('div.word-list.left', q.targets.map((t) => h('span.word-chip', [...q.text][t.start] + ' → ' + t.answer + '（' + t.correct + '）'))),
        h('div.btn-row.left', tryBtn('試玩這篇', p.title, () => Q.passage(u, k))),
        src(`data/extra.js → EXTRA.passages[${u.id}][${k}]`));
    }), h('p.fb-small', '每次進入錯字森林隨機抽一篇，不會連續兩次相同。學生點錯了不扣分，但會計入失誤。'));
  }

  G.review = { typoTab, passageTab, draft, draftTag, auto, src, tryBtn, preview, marked, state };
})(window.G);

// 第二部分：成語、名句、對白、示範、自動檢查，以及審訂畫面本身
(function (G) {
  const { h, Q } = G;
  const E = window.EXTRA;
  const R = G.review;
  const { draft, draftTag, auto, src, tryBtn, marked, state } = R;

  // ---------- 成語 ----------
  function idiomTab(u) {
    return h('div', u.idioms.map((id, i) => {
      const e = u.exercises.findIndex((ex) => ex.answer === id.word);
      const ex = u.exercises[e];
      return h('section.review-card',
        h('h3.kai', id.word, h('span.tone.tone-' + id.tone, '【' + id.tone + '】')),
        h('p', h('b', '釋義：'), id.meaning),
        h('p', h('b', '近義：'), id.synonyms.join('、') || '／', '　', h('b', '反義：'), id.antonyms.join('、') || '／'),
        h('p', h('b', '拼成語選字：'), [...id.word].join(' '), ' ＋ ', draft([...E.idiomDistractors[id.word]].join(' ')), draftTag()),
        ex ? h('p', h('b', '例句填空（教材練習）：'), ex.sentence) : null,
        h('p', h('b', '情境選擇：'), draft(E.idiomScenes[id.word]), draftTag()),
        h('p.fb-small', '情境題和例句填空的其餘三個選項，每次由本單元其他成語中隨機抽出；答完後顯示每個選項的釋義。'),
        ex ? h('p', h('b', '指正魔王（成語誤用）：'), auto(), '把練習句子的橫線換成本單元另一個成語，學生點出並改正。') : null,
        h('div.btn-row.left',
          tryBtn('拼成語', id.word, () => Q.idiomSpell(u, i)),
          ex ? tryBtn('例句填空', id.word, () => Q.idiomFill(u, e)) : null,
          tryBtn('情境選擇', id.word, () => Q.idiomScene(u, i)),
          ex ? tryBtn('指正魔王', id.word, () => Q.idiomMisuse(u, e)) : null),
        src(`教材：中二級成語.md；干擾字：EXTRA.idiomDistractors['${id.word}']；情境題：EXTRA.idiomScenes['${id.word}']`));
    }));
  }

  // ---------- 名句 ----------
  function quoteTab(u) {
    return h('div', u.quotes.map((qt, i) => {
      const [wrongText, d] = E.quoteErrors[u.id][i];
      const a = [...qt.text], b = [...wrongText];
      const k = a.findIndex((c, j) => c !== b[j]);
      return h('section.review-card',
        h('h3.kai', qt.text),
        h('p', h('b', '語譯：'), qt.translation),
        h('p', h('b', '釋義：'), qt.meaning),
        h('p', h('b', '出處：'), qt.source),
        h('p', h('b', '排名句切塊：'), auto(), Q.chunks(qt.text).join(' ／ ')),
        h('p', h('b', '名句用得着：'), draft(E.quoteScenes[u.id][i]), draftTag()),
        h('p', h('b', '指正魔王（錯字版本）：'), h('span.kai', marked(wrongText, k >= 0 ? [{ start: k, len: 1 }] : [], 'hl-wrong')), draftTag(),
          k >= 0 ? h('span.fb-small', `　「${b[k]}」→「${a[k]}」，干擾字：`) : null, draft([...d].join(' '))),
        h('div.btn-row.left',
          tryBtn('排名句', '名句 ' + (i + 1), () => Q.quoteArrange(u, i)),
          tryBtn('語譯配對', '名句 ' + (i + 1), () => Q.quoteTrans(u, i)),
          tryBtn('出處配對', '名句 ' + (i + 1), () => Q.quoteSource(u, i)),
          tryBtn('名句用得着', '名句 ' + (i + 1), () => Q.quoteScene(u, i)),
          tryBtn('指正魔王', '名句 ' + (i + 1), () => Q.quoteFix(u, i))),
        src(`教材：中二級名句.md；情境題：EXTRA.quoteScenes[${u.id}][${i}]；錯字版本：EXTRA.quoteErrors[${u.id}][${i}]`));
    }));
  }

  // ---------- 對白 ----------
  const LINE_NAMES = { enter: '第一次進島', tip: '進行中的提示', ready: '三個地點完成後', trialStart: '試煉開始', pass: '試煉通過', fail: '試煉未通過', praise: '答對時稱讚（隨機）' };
  const DEMON_NAMES = { gates: '三道城門開場', gatePass: '通過城門', gateFail: '闖門失敗', battleStart: '決戰開始', correctMe: '指正魔王題開場', hurt: '受挫（答對時，隨機）', taunt: '得意（答錯時，隨機）', defeat: '落敗', win: '勇者落敗時' };
  const rowsOf = (obj, names) => Object.entries(names).map(([k, name]) => {
    const v = obj[k];
    return h('tr', h('th', name), h('td', Array.isArray(v) ? h('ol', v.map((x) => h('li', draft(x)))) : draft(v)));
  });
  function linesTab(u) {
    const isl = G.island(u.id);
    return h('div',
      h('section.review-card',
        h('h3', `${isl.name}島主：${isl.master}`, draftTag()),
        h('p.fb-small', `景觀：${isl.scenery}；法寶：${isl.treasure}（決戰技能：${isl.skillName}）`),
        h('div.table-wrap', h('table.review-table.lines', h('tbody', rowsOf(isl.lines, LINE_NAMES)))),
        src(`data/extra.js → EXTRA.islands[${u.id - 1}].lines`)),
      h('section.review-card',
        h('h3', '共用文字：故事', draftTag()),
        h('div.table-wrap', h('table.review-table.lines', h('tbody',
          h('tr', h('th', '開場故事'), h('td', h('ol', E.story.intro.map((x) => h('li', draft(x)))))),
          h('tr', h('th', '光橋動畫字幕'), h('td', draft(E.story.bridge))),
          h('tr', h('th', '結局文字'), h('td', h('ol', E.story.ending.map((x) => h('li', draft(x))))))))),
        src('data/extra.js → EXTRA.story')),
      h('section.review-card',
        h('h3', '共用文字：亂字魔王', draftTag()),
        h('div.table-wrap', h('table.review-table.lines', h('tbody', rowsOf(E.demon, DEMON_NAMES)))),
        src('data/extra.js → EXTRA.demon')));
  }

  // ---------- 示範 ----------
  // 老師試玩開關（只在本次瀏覽期間有效）
  function teacherSwitch(label, desc, on, set) {
    return h('label.teacher-switch' + (on ? '.on' : ''),
      h('input', { type: 'checkbox', checked: on, onchange: (e) => { set(e.target.checked); G.go.review(state.island, 'demo'); } }),
      h('span', h('b', label), h('small', desc)));
  }

  function demoTab(u) {
    const isl = G.island(u.id);
    const go = (fn) => () => fn();
    return h('div',
      h('section.review-card',
        h('h3', '老師試玩設定'),
        teacherSwitch('全地圖解鎖', '島主試煉、魔王城、三道城門和魔王決戰全部開放，不用先完成前面的關卡或集齊法寶。不會改動已儲存的進度。', G.teacher.allOpen(), (v) => G.teacher.setAllOpen(v)),
        teacherSwitch('遊玩時顯示答案', '每道題目旁邊以括號顯示正確答案，正確選項旁也會標示「（答案）」，方便測試答對和答錯時的回饋。', G.teacher.showAnswers(), (v) => G.teacher.setShowAnswers(v)),
        h('p.fb-small', '兩個設定只在本次瀏覽期間有效；按「離開」審訂模式或關閉分頁後會自動關閉，學生使用時不會看到。'),
        h('div.btn-row.left', h('button.btn.primary', { onclick: () => G.go.map() }, '到地圖開始遊玩 ›'))),
      h('p.notice', '試玩和示範時的星數、卡、印章、法寶和魔王城紀錄會保存在這部裝置。完畢後，可到「設定 → 重新開始」清除。'),
      h('section.review-card',
        h('h3', isl.name + '（' + u.title + '）'),
        h('div.btn-row.left',
          h('button.btn', { onclick: go(() => G.go.island(u.id)) }, '島嶼畫面'),
          h('button.btn', { onclick: go(() => G.games.typo(u.id)) }, '🌲 錯字森林'),
          h('button.btn', { onclick: go(() => G.games.idiom(u.id)) }, '🔨 成語工坊'),
          h('button.btn', { onclick: go(() => G.games.quote(u.id)) }, '📚 名句書閣'),
          h('button.btn', { onclick: go(() => G.games.trial(u.id)) }, '島主試煉')),
        h('p.fb-small', '從這裏進入島主試煉，不需先完成三個地點。')),
      h('section.review-card',
        h('h3', '第九島：魔王城'),
        h('div.btn-row.left',
          h('button.btn', { onclick: go(() => G.games.gate(1)) }, '錯字門'),
          h('button.btn', { onclick: go(() => G.games.gate(2)) }, '成語門'),
          h('button.btn', { onclick: go(() => G.games.gate(3)) }, '名句門'),
          h('button.btn', { onclick: go(() => G.games.boss()) }, '👑 魔王決戰')),
        h('p.fb-small', '從這裏進入，不需先集齊法寶或通過前面的城門。')),
      h('section.review-card',
        h('h3', '動畫'),
        h('div.btn-row.left',
          h('button.btn', { onclick: go(() => G.go.intro()) }, '開場故事'),
          h('button.btn', { onclick: go(() => G.playBridge()) }, '光橋動畫'))));
  }

  // ---------- 自動檢查 ----------
  function checkTab() {
    const { problems, info } = window.checkData(G.units, E);
    return h('div',
      h('p.fb-small', '檢查草擬內容與教材是否配合，例如干擾字與正字相同、短文找不到要藏的詞語、名句錯字版本改動了多於一個字。修改 data/extra.js 後，重新整理頁面再檢查。這裏只檢查格式，用字是否恰當仍要老師判斷。'),
      problems.length
        ? h('div.check-bad', h('h3', `發現 ${problems.length} 個問題`), h('ul', problems.map((p) => h('li', p))))
        : h('div.check-good', h('h3', '✓ 全部檢查通過')),
      h('ul.fb-small', info.map((x) => h('li', x))));
  }

  // ---------- 審訂畫面 ----------
  const TABS = [
    ['typo', '錯別字', R.typoTab], ['passage', '捉錯字短文', R.passageTab], ['idiom', '成語', idiomTab],
    ['quote', '名句', quoteTab], ['lines', '對白', linesTab], ['demo', '試玩與示範', demoTab], ['check', '自動檢查', checkTab],
  ];

  G.go.review = function (island = state.island, tab = state.tab) {
    if (!G.teacher.unlocked()) return G.go.teacherLogin();
    state.island = island;
    state.tab = tab;
    const u = G.unit(island);
    const islandBtns = E.islands.map((isl) => h('button.tab' + (isl.id === island ? '.on' : ''), {
      'aria-pressed': isl.id === island ? 'true' : 'false', onclick: () => G.go.review(isl.id, tab),
    }, isl.name));
    const tabBtns = TABS.map(([id, name]) => h('button.tab', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', onclick: () => G.go.review(island, id) }, name));
    const [, tabName, render] = TABS.find((t) => t[0] === tab);
    const content = render(u);
    const el = h('div.screen.review',
      G.topbar({
        title: '老師審訂模式',
        onBack: () => G.go.settings('map'),
        right: h('button.btn.small.ghost', { onclick: () => { G.teacher.lock(); G.toast('已離開老師審訂模式。'); G.go.cover(); } }, '離開'),
      }),
      h('nav.review-nav',
        tab === 'check' ? null : h('div.tabs.islands', { 'aria-label': '選擇島嶼' }, islandBtns),
        h('div.tabs', { role: 'tablist' }, tabBtns)),
      h('main.panel.review-panel',
        h('div.review-head',
          h('h2', tab === 'check' ? tabName : `${G.island(island).name}・${u.title}・${tabName}`),
          h('div.legend', h('span.draft', '黃色＋草擬'), '＝草擬內容（data/extra.js），請審訂；', h('span.tag-auto', '自動'), '＝程式按規則產生；其餘為教材原文。'),
          h('button.btn.small', { onclick: () => window.print() }, '🖨 列印／另存 PDF')),
        content));
    G.show(el, { bg: G.IMG.album, wide: true });
  };

  // 審訂模式開啟時，在其他畫面顯示「返回審訂」按鈕，方便示範後回來
  const origShow = G.show;
  G.show = function (screenEl, opts) {
    origShow(screenEl, opts);
    const old = document.getElementById('teacher-float');
    if (old) old.remove();
    if (G.teacher.unlocked() && !screenEl.classList.contains('review')) {
      const flags = [G.teacher.allOpen() ? '全解鎖' : '', G.teacher.showAnswers() ? '顯示答案' : ''].filter(Boolean).join('・');
      document.body.appendChild(h('button#teacher-float.btn.small', { onclick: () => G.go.review() }, '📋 返回審訂' + (flags ? '（' + flags + '）' : '')));
    }
  };
})(window.G);
