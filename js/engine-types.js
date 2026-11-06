// 答題引擎的互動題型：辨字快答（judge）、點出並改正（findfix）、排次序（order）
(function (G) {
  const { h } = G;
  const types = G.qtypes;

  // 顯示正確寫法，改正了的字以顏色標出
  function correctWord(text, pos, cls = 'word') {
    return h('div.' + cls.trim().split(/\s+/).join('.'), { 'aria-label': text }, [...text].map((c, i) => h('span.ch' + (pos.includes(i) ? '.fixed' : ''), c)));
  }
  G.correctWord = correctWord;

  // ---------- 辨字快答：判斷 → 點出錯字 → 選出正字 ----------
  // q: { shown, isWrong, pos, options, fix, correct }
  types.judge = function (ctx) {
    const q = ctx.q;
    let step = 1;
    const prompt = h('div.q-prompt', '這個詞語的寫法正確嗎？');
    const word = h('div.word');
    const area = h('div.step-area');
    ctx.body.append(...G.promptNode({ speaker: q.speaker, speech: q.speech }), prompt, word, area);
    let charBtns = [];
    let optBtns = [];

    function drawWord(clickable) {
      word.innerHTML = '';
      charBtns = [...q.shown].map((c, i) =>
        clickable ? h('button.ch.tap', { onclick: () => clickChar(i), 'aria-label': `第 ${i + 1} 個字「${c}」` }, c) : h('span.ch', c));
      G.append(word, charBtns);
    }
    function step1() {
      step = 1;
      drawWord(false);
      area.innerHTML = '';
      area.append(h('div.opts.two',
        h('button.opt', { onclick: () => judge(false) }, '✓ 寫法正確'),
        h('button.opt', { onclick: () => judge(true) }, '✗ 有錯字'),
      ));
    }
    function judge(saysWrong) {
      if (ctx.finished || step !== 1) return;
      if (saysWrong !== q.isWrong) return ctx.wrong(q.isWrong ? '再仔細看看每一個字。' : '再看清楚，每個字其實都寫對了嗎？');
      if (!q.isWrong) return ctx.ok();
      step2();
    }
    function step2() {
      step = 2;
      prompt.textContent = '點出寫錯的字。';
      drawWord(true);
      area.innerHTML = '';
    }
    function clickChar(i) {
      if (ctx.finished || step !== 2) return;
      if (q.pos.includes(i)) {
        q.pos.forEach((p) => charBtns[p].classList.add('picked'));
        step3();
      } else {
        charBtns[i].classList.add('wrong');
        charBtns[i].disabled = true;
        ctx.wrong('這個字沒有寫錯。留意哪個字的部首或字形與詞義不配合。');
      }
    }
    function step3() {
      step = 3;
      prompt.textContent = '選出正確的字。';
      charBtns.forEach((b) => { b.disabled = true; });
      optBtns = q.options.map((c) => {
        const b = h('button.opt.char', c);
        b.onclick = () => choose(c, b);
        return b;
      });
      area.innerHTML = '';
      area.append(h('div.opts.four', optBtns));
    }
    function choose(c, b) {
      if (ctx.finished || step !== 3) return;
      if (c === q.fix) {
        b.classList.add('right');
        showCorrect();
        ctx.ok();
      } else {
        b.classList.add('wrong');
        b.disabled = true;
        ctx.wrong('想想這個詞語的意思，哪個字的部首最配合？');
      }
    }
    function showCorrect() {
      word.replaceWith(correctWord(q.correct, q.isWrong ? q.pos : []));
    }
    step1();

    const api = {
      eliminate() {
        if (step !== 3) return false;
        const c = optBtns.filter((b) => b.textContent !== q.fix && !b.disabled);
        if (c.length <= 1) return false;
        const b = G.pick(c);
        b.disabled = true;
        b.classList.add('gone');
        return true;
      },
      reveal() {
        if (step !== 2) return false;
        q.pos.forEach((p) => charBtns[p].classList.add('hl'));
        return true;
      },
      lantern() { return step === 2 ? api.reveal() : api.eliminate(); },
      showAnswer() {
        prompt.textContent = '正確寫法：';
        area.innerHTML = '';
        showCorrect();
      },
      lock() {
        charBtns.forEach((b) => { if (b.disabled !== undefined) b.disabled = true; });
        area.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      },
    };
    return api;
  };

  // ---------- 點出並改正（指正魔王、捉錯字短文） ----------
  // q: { text, targets: [{ start, len, options, answer, key }], multi }
  // answer 是改正後的寫法；options 是改正的選項（字或成語）
  types.findfix = function (ctx) {
    const q = ctx.q;
    const chars = [...q.text];
    const segs = [];
    const failed = [];
    let current = null;
    let optBtns = [];
    const para = h('div.ff-text' + (q.multi ? '.passage' : ''));
    const area = h('div.step-area');
    const prompt = h('div.q-prompt', q.prompt || '點出寫錯的地方。');
    if (q.multi) prompt.textContent = q.prompt || `短文裏藏了 ${q.targets.length} 個錯字。點出錯字，再選出正確的字。`;
    const counter = h('div.ff-count');
    ctx.body.append(...G.promptNode({ speaker: q.speaker, speech: q.speech, clue: q.clue }), prompt, q.multi ? counter : null, para, area);

    q.targets.forEach((t) => { t.fixed = false; t.misses = 0; });
    for (let i = 0; i < chars.length;) {
      const t = q.targets.find((x) => x.start === i);
      if (t) {
        const text = chars.slice(i, i + t.len).join('');
        const b = h('button.ch.tap' + (t.len > 1 ? '.group' : ''), { onclick: () => clickTarget(t) }, text);
        t.el = b;
        segs.push(b);
        i += t.len;
      } else {
        const c = chars[i];
        if (G.isHan(c)) {
          const b = h('button.ch.tap', { onclick: () => clickPlain(b) }, c);
          segs.push(b);
        } else segs.push(h('span.punct', c));
        i++;
      }
    }
    // 字和緊隨的標點放在同一個不換行的組合內，避免標點出現在行首
    let group = null;
    let pendingOpen = [];
    for (const s of segs) {
      const isPunct = s.classList.contains('punct');
      if (isPunct && /^[「『《（〈]$/.test(s.textContent)) { pendingOpen.push(s); continue; }
      if (isPunct && group) { group.appendChild(s); continue; }
      group = h('span.nb', pendingOpen, s);
      pendingOpen = [];
      para.appendChild(group);
    }
    pendingOpen.forEach((s) => para.appendChild(s));
    updateCount();

    function updateCount() {
      const n = q.targets.filter((t) => t.fixed).length;
      counter.textContent = `已改正 ${n} / ${q.targets.length}`;
    }
    function clickPlain(b) {
      if (ctx.finished) return;
      b.classList.add('wrong');
      setTimeout(() => b.classList.remove('wrong'), 900);
      if (q.multi) ctx.mistake('這個字沒有寫錯。');
      else ctx.wrong('這裏沒有寫錯，再找找看。');
    }
    function clickTarget(t) {
      if (ctx.finished) return;
      if (t.fixed) {
        G.toast('這裏已經改正了。');
        return;
      }
      if (current) current.el.classList.remove('picked');
      current = t;
      t.el.classList.add('picked');
      prompt.textContent = q.multi ? '選出正確的字：' : (t.len > 1 ? '選出正確的寫法：' : '選出正確的字：');
      optBtns = t.options.map((o) => {
        const b = h('button.opt' + ([...o].length === 1 ? '.char' : ''), o);
        b.onclick = () => choose(t, o, b);
        return b;
      });
      area.innerHTML = '';
      area.append(h('div.opts.four', optBtns), h('button.btn.ghost.small', { onclick: cancel }, '取消'));
    }
    function cancel() {
      if (current) current.el.classList.remove('picked');
      current = null;
      area.innerHTML = '';
      prompt.textContent = q.multi ? '繼續找出其他錯字。' : (q.prompt || '點出寫錯的地方。');
    }
    function markFixed(t, ok) {
      t.fixed = true;
      t.el.textContent = t.answer;
      t.el.classList.remove('picked', 'hl');
      t.el.classList.add(ok ? 'fixed' : 'revealed');
      t.el.disabled = true;
      current = null;
      area.innerHTML = '';
      updateCount();
    }
    function choose(t, o, b) {
      if (ctx.finished) return;
      if (o === t.answer) {
        markFixed(t, true);
        if (q.multi) {
          if (q.targets.every((x) => x.fixed)) ctx.ok();
          else ctx.info(h('div.fb-head', `✓ 改正了！正確寫法是「${t.correct || t.answer}」。`), h('div.fb-small', '繼續找出其他錯字。'));
          prompt.textContent = '繼續找出其他錯字。';
        } else ctx.ok();
      } else {
        b.classList.add('wrong');
        b.disabled = true;
        if (q.multi) {
          t.misses++;
          if (t.misses >= 2) {
            failed.push(t.key);
            markFixed(t, false);
            ctx.mistake(`正確的字是「${t.answer}」，寫作「${t.correct || t.answer}」。`);
            if (q.targets.every((x) => x.fixed)) ctx.ok();
          } else ctx.mistake('想想這個詞語的意思，哪個字的部首最配合？');
        } else ctx.wrong(t.len > 1 ? '想想整句話的意思，哪個成語最合用？' : '想想這句話的意思，哪個字才配合？');
      }
    }

    const api = {
      eliminate() {
        if (!current) return false;
        const c = optBtns.filter((b) => b.textContent !== current.answer && !b.disabled);
        if (c.length <= 1) return false;
        const b = G.pick(c);
        b.disabled = true;
        b.classList.add('gone');
        return true;
      },
      reveal() {
        const left = q.targets.filter((t) => !t.fixed && !t.el.classList.contains('hl'));
        if (!left.length) return false;
        (q.multi ? [left[0]] : left).forEach((t) => t.el.classList.add('hl'));
        return true;
      },
      lantern() { return current ? api.eliminate() : api.reveal(); },
      showAnswer() {
        q.targets.forEach((t) => { if (!t.fixed) markFixed(t, false); });
      },
      lock() { segs.forEach((s) => { if (s.tagName === 'BUTTON') s.disabled = true; }); area.innerHTML = ''; },
      failed: () => failed.slice(),
      summary() {
        if (!q.multi) return null;
        const ok = q.targets.length - failed.length;
        return h('div.fb-small', `找出並改正了 ${ok} / ${q.targets.length} 個錯字。正確寫法：`,
          h('div.word-list', q.targets.map((t) => h('span.word-chip', t.correct || t.answer))));
      },
    };
    return api;
  };

  // ---------- 排次序（拼成語、排名句） ----------
  // q: { pieces: [...]（已打亂，可含干擾項）, answer: [...], layout: 'chars' | 'lines' }
  types.order = function (ctx) {
    const q = ctx.q;
    const n = q.answer.length;
    const slots = new Array(n).fill(null); // 每格放 pieces 的索引
    const used = new Set();
    const slotRow = h('div.slots.' + (q.layout || 'chars'));
    const pool = h('div.pool.' + (q.layout || 'chars'));
    ctx.body.append(...G.promptNode(q), slotRow, pool);
    let locked = false;

    function draw() {
      slotRow.innerHTML = '';
      slots.forEach((pi, k) => {
        const filled = pi !== null;
        slotRow.appendChild(h('button.slot' + (filled ? '.filled' : ''), {
          onclick: () => removeAt(k), disabled: locked || !filled,
          'aria-label': filled ? `第 ${k + 1} 格：${q.pieces[pi]}，按此移走` : `第 ${k + 1} 格：空`,
        }, filled ? q.pieces[pi] : ''));
      });
      pool.innerHTML = '';
      q.pieces.forEach((p, i) => {
        pool.appendChild(h('button.piece' + (used.has(i) ? '.used' : ''), { onclick: () => place(i), disabled: locked || used.has(i) }, p));
      });
    }
    function place(i) {
      if (locked || used.has(i)) return;
      const k = slots.indexOf(null);
      if (k < 0) return;
      slots[k] = i;
      used.add(i);
      draw();
      if (slots.indexOf(null) < 0) check();
    }
    function removeAt(k) {
      if (locked || slots[k] === null) return;
      used.delete(slots[k]);
      slots[k] = null;
      draw();
    }
    function prefixLen() {
      let k = 0;
      while (k < n && slots[k] !== null && q.pieces[slots[k]] === q.answer[k]) k++;
      return k;
    }
    function clearFrom(k) {
      for (let j = k; j < n; j++) {
        if (slots[j] !== null) used.delete(slots[j]);
        slots[j] = null;
      }
    }
    function check() {
      const seq = slots.map((i) => q.pieces[i]);
      if (seq.join('') === q.answer.join('')) {
        locked = true;
        draw();
        slotRow.classList.add('done');
        ctx.ok();
        return;
      }
      const k = prefixLen();
      q.hint1 = k === 0 ? `提示：第一個是「${q.answer[0]}」。` : `前面 ${k} 個排對了，再看看後面。`;
      ctx.wrong('次序不對。');
      if (!ctx.finished) { clearFrom(k); draw(); }
    }
    draw();

    const api = {
      lantern() {
        const k = prefixLen();
        if (k >= n) return false;
        clearFrom(k);
        const i = q.pieces.findIndex((p, idx) => p === q.answer[k] && !used.has(idx));
        if (i < 0) return false;
        slots[k] = i;
        used.add(i);
        draw();
        if (slots.indexOf(null) < 0) check();
        return true;
      },
      eliminate() {
        // 移走一個干擾項（只適用於有干擾項的題目）
        const extra = q.pieces.map((p, i) => i).filter((i) => !used.has(i) && !q.answer.includes(q.pieces[i]));
        if (!extra.length) return false;
        used.add(extra[0]);
        draw();
        return true;
      },
      showAnswer() {
        locked = true;
        slotRow.innerHTML = '';
        q.answer.forEach((p) => slotRow.appendChild(h('span.slot.filled.revealed', p)));
        pool.innerHTML = '';
      },
      lock() { locked = true; },
    };
    return api;
  };
})(window.G);
