// 答題引擎：負責顯示一道題目、處理作答、提示、計時和回饋。
// 練習（practice）：第一次答錯只給提示，再答一次；第二次答錯才顯示答案。
// 試煉／決戰（practice: false）：答錯一次即顯示答案。
(function (G) {
  const { h } = G;
  const types = {};
  G.qtypes = types;

  // G.ask(q, host, env) → { promise, eliminate(), reveal(), showHint(), addTime(), grantRetry() }
  // env: { practice, lantern: { left }, timer: 秒, praise: () => 文字, progress: '第 1 / 10 題' }
  G.ask = function (q, host, env = {}) {
    let tries = env.practice ? 2 : 1;
    let mistakes = 0;
    let hintUsed = false;
    let finished = false;
    let resolveFn;
    const promise = new Promise((r) => { resolveFn = r; });

    const label = h('div.q-label', h('span', q.label || ''), env.progress ? h('span.q-progress', env.progress) : null);
    const timerBar = h('div.q-timer', { 'aria-hidden': 'true' }, h('div.q-timer-fill'));
    const timerText = h('span.q-timer-text');
    const body = h('div.q-body');
    const tools = h('div.q-tools');
    const fb = h('div.q-feedback', { 'aria-live': 'polite' });
    const root = h('section.q', label, env.timer ? h('div.q-timer-row', timerBar, timerText) : null, body, tools, fb);
    host.innerHTML = '';
    host.appendChild(root);

    // ---------- 計時（挑戰模式） ----------
    let tLeft = 0, tMax = env.timer || 0, tInt = null;
    function renderTimer() {
      timerText.textContent = `⏱ ${Math.max(0, tLeft)} 秒`;
      timerBar.firstChild.style.width = `${Math.max(0, (tLeft / tMax) * 100)}%`;
      timerBar.classList.toggle('low', tLeft <= 5);
    }
    function startTimer() {
      if (!env.timer || finished) return;
      tLeft = env.timer;
      tMax = env.timer;
      renderTimer();
      clearInterval(tInt);
      tInt = setInterval(() => {
        tLeft--;
        renderTimer();
        if (tLeft <= 0) {
          clearInterval(tInt);
          ctx.wrong('時間到！');
        }
      }, 1000);
    }
    const stopTimer = () => clearInterval(tInt);
    G.onLeave(stopTimer);

    function say(cls, ...content) {
      fb.innerHTML = '';
      fb.className = 'q-feedback ' + cls;
      G.append(fb, content);
    }

    function finish(correct) {
      if (finished) return;
      finished = true;
      stopTimer();
      handler.lock && handler.lock();
      if (!correct && handler.showAnswer) handler.showAnswer();
      tools.innerHTML = '';
      if (env.onFinish) env.onFinish(correct);
      const praise = correct && env.praise ? env.praise() : '';
      const multiNote = q.multi && handler.summary ? handler.summary() : null;
      say(correct ? 'good' : 'bad',
        h('div.fb-head', correct ? '✓ 答對了！' : (q.multi ? '✓ 完成！' : '✗ 未答對，看看正確答案：'), praise ? h('span.fb-praise', praise) : null),
        multiNote,
        q.after ? q.after() : null,
        h('button.btn.next', { onclick: () => resolveFn({ correct, mistakes, hintUsed, failed: handler.failed ? handler.failed() : [] }) }, env.nextLabel || '下一步 ›'),
      );
      const next = fb.querySelector('.next');
      if (next) next.focus({ preventScroll: true });
      if (fb.scrollIntoView) fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const ctx = {
      q, body, env,
      get finished() { return finished; },
      // 這一步答對了；整題完成時呼叫 ok()
      ok() { finish(q.multi ? mistakes === 0 : true); },
      // 答錯一次：消耗一次機會
      wrong(msg) {
        if (finished) return;
        mistakes++;
        tries--;
        if (tries > 0) {
          say('warn', h('div.fb-head', '✗ ' + (msg || '再想一想。')), q.hint1 ? h('div.fb-hint', q.hint1) : null, h('div.fb-small', '再試一次。'));
          handler.retry && handler.retry();
          startTimer();
        } else {
          finish(false);
        }
      },
      // 只記錄失誤，不消耗機會（捉錯字短文用）
      mistake(msg) {
        mistakes++;
        say('warn', h('div.fb-head', '✗ ' + (msg || '再想一想。')));
      },
      info(...content) { say('info', ...content); },
      restartTimer: startTimer,
    };

    const handler = types[q.type](ctx);
    G.current = q; // 方便測試時查看目前題目

    // 老師審訂模式：在題目旁邊以括號顯示正確答案，並在正確選項旁加上標記
    if (G.teacher && G.teacher.showAnswers()) {
      label.after(h('div.teacher-answer', { 'aria-label': '老師模式：正確答案' }, '（答案：' + answerText(q) + '）'));
      root.classList.add('show-answers');
      markAnswers(q, root);
    }

    // ---------- 提示燈籠 ----------
    if (env.lantern) {
      const btn = h('button.btn.small.lantern', { onclick: useLantern });
      const refresh = () => {
        btn.textContent = `🏮 提示燈籠 × ${env.lantern.left}`;
        btn.disabled = env.lantern.left <= 0;
      };
      function useLantern() {
        if (finished || env.lantern.left <= 0) return;
        if (handler.lantern && handler.lantern()) {
          env.lantern.left--;
          hintUsed = true;
          refresh();
        } else {
          G.toast('這一步用不着燈籠。');
        }
      }
      refresh();
      tools.appendChild(btn);
    }

    startTimer();

    return {
      promise,
      get finished() { return finished; },
      eliminate: () => !finished && !!(handler.eliminate && handler.eliminate()),
      reveal: () => !finished && !!(handler.reveal && handler.reveal()),
      showHint() {
        if (finished || !q.hint) return false;
        say('info', h('div.fb-head', '📜 提示'), h('div.fb-hint', q.hint));
        return true;
      },
      addTime(sec) {
        if (finished || !env.timer) return false;
        tLeft += sec;
        tMax = Math.max(tMax, tLeft);
        renderTimer();
        return true;
      },
      grantRetry() {
        if (finished) return false;
        tries++;
        return true;
      },
      hasTimer: !!env.timer,
    };
  };

  // ---------- 老師模式：正確答案 ----------
  function answerText(q) {
    if (q.type === 'mcq') return q.options[q.answer];
    if (q.type === 'judge') {
      if (!q.isWrong) return `寫法正確，${q.correct}`;
      const wrongChars = [...new Set(q.pos.map((p) => [...q.shown][p]))].join('、');
      return `有錯字，「${wrongChars}」應改為「${q.fix}」，正確寫法是「${q.correct}」`;
    }
    if (q.type === 'findfix') {
      const chars = [...q.text];
      return q.targets.map((t) => `「${chars.slice(t.start, t.start + t.len).join('')}」→「${t.answer}」`).join('；');
    }
    if (q.type === 'order') return q.answer.join(q.layout === 'chars' ? '' : ' ／ ');
    return '';
  }
  G.answerText = answerText;

  // 在正確選項上加 data-answer（由 CSS 顯示「（答案）」），不改動按鈕文字
  function markAnswers(q, root) {
    const mark = () => {
      if (q.type === 'mcq') {
        const btns = root.querySelectorAll('.opts .opt');
        if (btns[q.answer]) btns[q.answer].dataset.answer = '1';
      }
      root.querySelectorAll('.opts.four .opt').forEach((b) => {
        const want = q.type === 'judge' ? q.fix : (q.type === 'findfix' ? (q.targets.find((t) => t.el && t.el.classList.contains('picked')) || {}).answer : null);
        if (want != null && b.textContent === want) b.dataset.answer = '1';
      });
      if (q.type === 'judge' && root.querySelector('.opts.two')) {
        const two = root.querySelectorAll('.opts.two .opt');
        if (two.length === 2) two[q.isWrong ? 1 : 0].dataset.answer = '1';
      }
      if (q.type === 'findfix') q.targets.forEach((t) => { if (t.el && !t.fixed) t.el.dataset.answer = '1'; });
      if (q.type === 'judge') root.querySelectorAll('.word button.ch').forEach((b, i) => { if (q.pos.includes(i)) b.dataset.answer = '1'; });
    };
    mark();
    // 多步題目（例如辨字快答、點出並改正）的選項是之後才出現的，所以持續標記
    new MutationObserver(mark).observe(root, { childList: true, subtree: true });
  }

  // ---------- 共用：題目文字 ----------
  function promptNode(q) {
    const parts = [];
    if (q.speaker === 'demon') parts.push(G.speech('demon', q.speech || '聽好了，我說的話一點錯也沒有！', { small: true }));
    if (q.prompt) parts.push(h('div.q-prompt', q.prompt));
    if (q.clue) parts.push(h('div.q-clue', q.clue));
    if (q.sentence) parts.push(h('div.q-sentence', q.sentence));
    return parts;
  }
  G.promptNode = promptNode;

  // ---------- 選擇題 ----------
  types.mcq = function (ctx) {
    const q = ctx.q;
    const btns = q.options.map((o, i) => h('button.opt', { onclick: () => choose(i) }, o));
    ctx.body.append(...promptNode(q), h('div.opts' + (q.long ? '.long' : ''), btns));
    function choose(i) {
      if (ctx.finished) return;
      if (i === q.answer) {
        btns[i].classList.add('right');
        ctx.ok();
      } else {
        btns[i].classList.add('wrong');
        btns[i].disabled = true;
        ctx.wrong(q.wrongMsg);
      }
    }
    const api = {
      eliminate() {
        const c = btns.filter((b, i) => i !== q.answer && !b.disabled);
        if (c.length <= 1) return false;
        const b = G.pick(c);
        b.disabled = true;
        b.classList.add('gone');
        return true;
      },
      lantern() { return api.eliminate(); },
      showAnswer() { btns[q.answer].classList.add('right'); },
      lock() { btns.forEach((b) => { b.disabled = true; }); },
    };
    return api;
  };
})(window.G);
