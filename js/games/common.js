// 三個練習地點共用的流程：畫面、逐題作答、記錄結果、星數和總結
(function (G) {
  const { h } = G;
  G.games = G.games || {};

  G.PLACES = {
    typo: { name: '錯字森林', icon: '🌲', desc: '錯別字：辨字快答、捉錯字短文' },
    idiom: { name: '成語工坊', icon: '🔨', desc: '成語：拼成語、例句填空、情境選擇' },
    quote: { name: '名句書閣', icon: '📚', desc: '名句：排名句、語譯配對、名句用得着' },
  };

  const S = () => G.store;
  const challenge = () => S().state.settings.mode === 'challenge';
  G.isChallenge = challenge;

  // 建立地點畫面
  G.placeScreen = function ({ unitId, place, title, bg, onExit, right }) {
    let leaving = false;
    const roundEl = h('div.round-title');
    const host = h('div.qhost');
    const exit = async () => {
      if (leaving) return;
      if (await G.confirm('離開這裏？', '本次練習的進度不會保存。', '離開', '繼續練習')) {
        leaving = true;
        (onExit || (() => G.go.island(unitId)))();
      }
    };
    const el = h('div.screen.place',
      G.topbar({ title, onBack: exit, right }),
      h('main.panel.place-panel', roundEl, host),
    );
    G.show(el, { bg: bg || G.IMG.place(unitId, place) });
    return {
      host, el,
      round(text) { roundEl.textContent = text; },
      clearRound() { roundEl.textContent = ''; },
    };
  };

  // 練習用的環境設定
  G.practiceEnv = function (unitId) {
    const isl = G.island(unitId);
    return {
      practice: true,
      lantern: { left: challenge() ? 1 : 3 },
      timer: challenge() ? 20 : 0,
      praise: () => G.pick(isl.lines.praise),
    };
  };

  // 把答題結果寫入進度（再溫習清單、卡的裂紋、正字印章）
  G.applyResult = function (q, res) {
    const st = S();
    if (q.multi && q.items) {
      for (const it of q.items) {
        const ok = !res.failed.includes(it.key);
        st.record({ key: it.key }, ok);
        if (ok && it.stamp && st.addStampHit(it.stamp)) G.toast('蓋上一個正字印章！');
      }
      return;
    }
    st.record(q.item, res.correct);
    if (res.correct && q.stamp && st.addStampHit(q.stamp)) G.toast('🔴 蓋上一個正字印章！');
  };

  // 逐題作答。makers：題目或產生題目的函數。不計時的題型（排序、短文）自動取消計時。
  // 回傳 { mistakes, hints, wrong: [maker...] }
  G.runQuestions = async function (ctx, makers, env, opts = {}) {
    let mistakes = 0, hints = 0;
    const wrong = [];
    const lantern = env.lantern ? { left: env.lantern.left } : null; // 每回合重新計算燈籠
    for (let k = 0; k < makers.length; k++) {
      const q = typeof makers[k] === 'function' ? makers[k]() : makers[k];
      const noTimer = q.type === 'order' || q.multi;
      const run = G.ask(q, ctx.host, {
        ...env,
        lantern,
        timer: noTimer ? 0 : env.timer,
        progress: makers.length > 1 ? `第 ${k + 1} / ${makers.length} 題` : '',
        nextLabel: k === makers.length - 1 ? (opts.lastLabel || '完成 ›') : '下一題 ›',
      });
      const res = await run.promise;
      mistakes += res.mistakes;
      if (res.hintUsed) hints++;
      if (!res.correct) wrong.push(makers[k]);
      G.applyResult(q, res);
      if (opts.onResult) opts.onResult(q, res);
    }
    return { mistakes, hints, wrong };
  };

  G.starsFor = (mistakes, hints) => (mistakes === 0 && hints === 0 ? 3 : mistakes <= 2 ? 2 : 1);

  // 回合之間的過場
  G.roundIntro = function (ctx, title, text) {
    return new Promise((resolve) => {
      ctx.round(title);
      ctx.host.innerHTML = '';
      const btn = h('button.btn.big', { onclick: resolve }, '開始 ›');
      ctx.host.append(h('div.round-intro', h('h2', title), h('p', text), btn));
      btn.focus({ preventScroll: true });
    });
  };

  // 地點總結
  G.placeSummary = function (ctx, { unitId, place, total, wrongWords, redo, extraButtons }) {
    const stars = G.starsFor(total.mistakes, total.hints);
    const before = S().island(unitId)[place] || 0;
    S().setStars(unitId, place, stars);
    const isl = G.island(unitId);
    ctx.round('完成！');
    ctx.host.innerHTML = '';
    const best = Math.max(before, stars);
    const lines = [
      h('div.summary-stars', G.stars(stars)),
      h('p', `失誤 ${total.mistakes} 次，使用提示 ${total.hints} 次。` + (best > stars ? `（最佳成績：${'★'.repeat(best)}）` : '')),
      stars < 3 ? h('p.fb-small', '★★★：全對又不用提示；★★：失誤 2 次或以下；★：完成。') : null,
    ];
    if (wrongWords && wrongWords.length) {
      lines.push(h('div.review-box', h('div.notes-title', '本回合答錯的題目（正確寫法）：'), h('div.word-list', wrongWords.map((w) => h('span.word-chip', w)))));
    }
    const btns = [];
    if (redo) btns.push(h('button.btn', { onclick: redo }, '重做答錯的題目'));
    if (extraButtons) btns.push(...extraButtons);
    btns.push(h('button.btn.primary', { onclick: () => G.go.island(unitId) }, '返回' + isl.name));
    ctx.host.append(h('div.summary', h('h2', G.PLACES[place].name + ' 完成'), G.speech(unitId, stars === 3 ? G.pick(isl.lines.praise) + ' 全部答對了！' : G.pick(isl.lines.praise)), ...lines, h('div.btn-row', btns)));
  };

  // 重做答錯的題目（不影響星數）
  G.redoWrong = async function (ctx, unitId, place, makers, title, after) {
    const env = G.practiceEnv(unitId);
    ctx.round('重做：' + title);
    const r = await G.runQuestions(ctx, makers, env, {
      onResult: (q, res) => { if (res.correct && q.type === 'order' && q.item && q.item.card) G.store.collectCard(q.item.card); },
    });
    ctx.round('重做完成');
    ctx.host.innerHTML = '';
    ctx.host.append(h('div.summary', h('h2', '重做完成'), h('p', r.wrong.length ? `仍有 ${r.wrong.length} 題答錯，已放入「再溫習」清單。` : '全部答對了！'),
      h('div.btn-row',
        r.wrong.length ? h('button.btn', { onclick: () => G.redoWrong(ctx, unitId, place, r.wrong, title, after) }, '再做一次') : null,
        h('button.btn.primary', { onclick: () => G.go.island(unitId) }, '返回' + G.island(unitId).name))));
  };
})(window.G);
