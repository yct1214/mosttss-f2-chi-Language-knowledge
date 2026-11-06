// 成語工坊：拼成語（全部）、例句填空（教材練習）、情境選擇（3 題），另有褒貶分類
(function (G) {
  const { Q, h, shuffle, sample } = G;

  G.games.idiom = async function (unitId) {
    const u = G.unit(unitId);
    const ctx = G.placeScreen({ unitId, place: 'idiom', title: G.island(unitId).name + '・成語工坊' });
    const env = G.practiceEnv(unitId);
    const mk = (fn, word) => { fn.word = word; return fn; };

    await G.roundIntro(ctx, '第一回合：拼成語', `成語的四個字被打亂了，還混入兩個同音或形近的字。依次點選，拼回正確的成語。拼好就能取得成語卡。`);
    ctx.round('第一回合：拼成語');
    const r1 = await G.runQuestions(ctx, shuffle(u.idioms.map((id, i) => mk(() => Q.idiomSpell(u, i), id.word))), env, {
      onResult: (q, res) => {
        if (res.correct && G.store.collectCard(q.item.card)) G.toast('🎴 取得成語卡！');
      },
    });

    await G.roundIntro(ctx, '第二回合：例句填空', '從四個成語中，選出最適合填在句子橫線上的一個。');
    ctx.round('第二回合：例句填空');
    const r2 = await G.runQuestions(ctx, shuffle(u.exercises.map((ex, e) => mk(() => Q.idiomFill(u, e), ex.answer))), env);

    await G.roundIntro(ctx, '第三回合：情境選擇', '讀一段生活情境，選出最貼切的成語。答完後，看看其他選項為甚麼不合用。');
    ctx.round('第三回合：情境選擇');
    const picks = sample(u.idioms.map((x, i) => i), 3);
    const r3 = await G.runQuestions(ctx, picks.map((i) => mk(() => Q.idiomScene(u, i), u.idioms[i].word)), env);

    const all = [r1, r2, r3];
    const wrong = all.flatMap((r) => r.wrong);
    G.placeSummary(ctx, {
      unitId, place: 'idiom',
      total: { mistakes: all.reduce((s, r) => s + r.mistakes, 0), hints: all.reduce((s, r) => s + r.hints, 0) },
      wrongWords: [...new Set(wrong.map((m) => m.word))],
      redo: wrong.length ? () => G.redoWrong(ctx, unitId, 'idiom', wrong, '成語') : null,
      extraButtons: [h('button.btn', { onclick: () => toneSort(ctx, u) }, '額外玩法：褒貶分類')],
    });
  };

  // 褒貶分類：限時把成語分到「褒義、貶義、中性」三個籃子
  function toneSort(ctx, u) {
    const items = shuffle(u.idioms);
    const limit = 60;
    let k = 0, right = 0, left = limit, timer = null;
    const results = [];
    ctx.round('額外玩法：褒貶分類');
    ctx.host.innerHTML = '';
    const timeEl = h('div.sort-time');
    const wordEl = h('div.sort-word.kai');
    const fb = h('div.q-feedback', { 'aria-live': 'polite' });
    const baskets = ['褒義', '貶義', '中性'].map((tone) => h('button.basket.tone-' + tone, { onclick: () => choose(tone) }, '🧺 ' + tone));
    const progress = h('div.q-progress');
    ctx.host.append(h('section.q', h('div.q-label', h('span', '限時 ' + limit + ' 秒'), progress), timeEl,
      h('div.q-prompt', '這個成語是褒義、貶義，還是中性？'), wordEl, h('div.baskets', baskets), fb));
    const stop = () => clearInterval(timer);
    G.onLeave(stop);
    function show() {
      progress.textContent = `第 ${k + 1} / ${items.length} 個`;
      wordEl.textContent = items[k].word;
      // 老師審訂模式：以括號顯示答案
      if (G.teacher && G.teacher.showAnswers()) wordEl.appendChild(h('span.sort-answer', '（答案：' + items[k].tone + '）'));
    }
    function choose(tone) {
      if (k >= items.length || left <= 0) return;
      const id = items[k];
      const ok = id.tone === tone;
      if (ok) right++;
      results.push({ id, ok, tone });
      fb.className = 'q-feedback ' + (ok ? 'good' : 'bad');
      fb.textContent = ok ? `✓ 「${id.word}」是${id.tone}成語。` : `✗ 「${id.word}」是${id.tone}成語。`;
      k++;
      if (k >= items.length) end(); else show();
    }
    function end() {
      stop();
      baskets.forEach((b) => { b.disabled = true; });
      ctx.host.innerHTML = '';
      ctx.host.append(h('div.summary', h('h2', '褒貶分類完成'),
        h('p', `分對了 ${right} / ${items.length} 個，用了 ${limit - left} 秒。`),
        h('div.notes', items.map((id) => {
          const r = results.find((x) => x.id === id);
          return h('div.note' + (r && r.ok ? '.right' : ''), h('b', (r && r.ok ? '✓ ' : r ? '✗ ' : '— ') + id.word + '：'), '【' + id.tone + '】' + id.meaning);
        })),
        h('div.btn-row',
          h('button.btn', { onclick: () => toneSort(ctx, u) }, '再玩一次'),
          h('button.btn.primary', { onclick: () => G.go.island(u.id) }, '返回' + G.island(u.id).name))));
    }
    timer = setInterval(() => {
      left--;
      timeEl.textContent = `⏱ 剩下 ${left} 秒`;
      if (left <= 0) end();
    }, 1000);
    timeEl.textContent = `⏱ 剩下 ${left} 秒`;
    show();
  }
})(window.G);
