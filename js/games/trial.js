// 島主試煉：12 題（錯別字、成語、名句各 4 題），3 顆心
(function (G) {
  const { Q, h, shuffle, sample, pick } = G;

  // 心數顯示
  G.hearts = function (max) {
    const el = h('div.hearts', { 'aria-live': 'polite' });
    const api = {
      el, max, left: max,
      set(n) {
        api.left = Math.max(0, Math.min(api.max, n));
        el.innerHTML = '';
        el.setAttribute('aria-label', `剩下 ${api.left} 顆心`);
        for (let i = 0; i < api.max; i++) el.appendChild(h('span.heart' + (i < api.left ? '' : '.lost'), i < api.left ? '❤' : '♡'));
      },
      lose() { api.set(api.left - 1); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); },
    };
    api.set(max);
    return api;
  };

  function trialQuestions(u) {
    const typo = sample(u.typos.map((t, i) => i), 4).map((i) => () => Q.typoJudge(u, i, Math.random() < 0.6));
    const idiomKinds = shuffle(['spell', 'fill', 'scene', pick(['fill', 'scene', 'spell'])]);
    const ids = sample(u.idioms.map((x, i) => i), 4);
    const idiom = ids.map((i, k) => {
      const kind = idiomKinds[k];
      if (kind === 'spell') return () => Q.idiomSpell(u, i);
      if (kind === 'scene') return () => Q.idiomScene(u, i);
      const e = u.exercises.findIndex((ex) => ex.answer === u.idioms[i].word);
      return () => Q.idiomFill(u, e);
    });
    const quoteKinds = shuffle(['arrange', 'trans', 'scene', pick(['trans', 'scene', 'arrange'])]);
    const qs = sample(u.quotes.map((x, i) => i), 4);
    const quote = qs.map((i, k) => {
      const kind = quoteKinds[k];
      if (kind === 'arrange') return () => Q.quoteArrange(u, i);
      if (kind === 'scene') return () => Q.quoteScene(u, i);
      return () => (G.isChallenge() ? Q.quoteSource(u, i) : Q.quoteTrans(u, i));
    });
    return shuffle(typo.concat(idiom, quote));
  }

  G.games.trial = async function (unitId) {
    const u = G.unit(unitId);
    const isl = G.island(unitId);
    const hearts = G.hearts(3);
    const ctx = G.placeScreen({ unitId, place: 'trial', title: isl.name + '・島主試煉', right: hearts.el });
    const makers = trialQuestions(u);

    // 開場
    await new Promise((resolve) => {
      ctx.round('島主試煉');
      ctx.host.innerHTML = '';
      const btn = h('button.btn.big.primary', { onclick: resolve }, '接受試煉 ›');
      ctx.host.append(h('div.round-intro',
        h('img.trial-master', { src: G.IMG.master(unitId), alt: isl.master }),
        G.speech(unitId, isl.lines.trialStart),
        h('p', '共 12 題：錯別字、成語、名句各 4 題。你有 3 顆心，答錯一題失一顆心。' + (G.isChallenge() ? '挑戰模式每題限時 20 秒。' : '')),
        btn));
      btn.focus({ preventScroll: true });
    });

    const env = { practice: false, timer: G.isChallenge() ? 20 : 0, praise: () => pick(isl.lines.praise) };
    for (let k = 0; k < makers.length; k++) {
      ctx.round(`島主試煉　第 ${k + 1} / ${makers.length} 題`);
      const q = makers[k]();
      const run = G.ask(q, ctx.host, { ...env, timer: q.type === 'order' ? 0 : env.timer, nextLabel: '繼續 ›' });
      const res = await run.promise;
      G.applyResult(q, res);
      if (!res.correct) {
        hearts.lose();
        if (hearts.left <= 0) return fail(ctx, unitId);
      }
    }
    pass(ctx, unitId, hearts.left);
  };

  function fail(ctx, unitId) {
    const isl = G.island(unitId);
    ctx.round('島主試煉');
    ctx.host.innerHTML = '';
    ctx.host.append(h('div.summary',
      h('h2', '試煉未通過'),
      G.speech(unitId, isl.lines.fail),
      h('p', '答錯的題目已放入「再溫習」清單。可以先回到三個地點練習，再來挑戰。'),
      h('div.btn-row',
        h('button.btn', { onclick: () => G.games.trial(unitId) }, '再挑戰一次'),
        h('button.btn.primary', { onclick: () => G.go.island(unitId) }, '返回' + isl.name))));
  }

  function pass(ctx, unitId, left) {
    const isl = G.island(unitId);
    const st = G.store;
    const first = !st.island(unitId).trial;
    st.island(unitId).trial = true;
    st.save();
    const n = st.treasureCount();
    ctx.round('島主試煉');
    ctx.host.innerHTML = '';
    ctx.host.append(h('div.summary.treasure-get',
      h('h2', '試煉通過！'),
      G.speech(unitId, isl.lines.pass),
      h('div.treasure-show', h('img.treasure-big', { src: G.IMG.treasure(unitId), alt: isl.treasure }), h('div.treasure-name.kai', isl.treasure), h('div.fb-small', '決戰技能：' + isl.skillName)),
      h('p', `剩下 ${left} 顆心。` + (first ? `地圖上的光橋接上了一段。法寶 ${n} / 8。` : `你已經擁有這件法寶。法寶 ${n} / 8。`)),
      n === 8 && first ? h('p.big-note', '八件法寶已經集齊！回到地圖，看看魔王城發生了甚麼事……') : null,
      h('div.btn-row',
        h('button.btn', { onclick: () => G.go.island(unitId) }, '返回' + isl.name),
        h('button.btn.primary', { onclick: () => G.go.map() }, '回到地圖'))));
  }
})(window.G);
