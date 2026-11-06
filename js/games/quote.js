// 名句書閣：排名句（全部 6 句）、語譯配對（挑戰模式改為出處配對）、名句用得着（3 題）
(function (G) {
  const { Q, shuffle, sample } = G;

  G.games.quote = async function (unitId) {
    const u = G.unit(unitId);
    const ctx = G.placeScreen({ unitId, place: 'quote', title: G.island(unitId).name + '・名句書閣' });
    const env = G.practiceEnv(unitId);
    const mk = (fn, word) => { fn.word = word; return fn; };
    const idx = u.quotes.map((x, i) => i);

    await G.roundIntro(ctx, '第一回合：排名句', '名句被切成幾塊，次序打亂了。依次點選，把名句排回正確次序。排好就能取得名句卡。');
    ctx.round('第一回合：排名句');
    const r1 = await G.runQuestions(ctx, shuffle(idx).map((i) => mk(() => Q.quoteArrange(u, i), u.quotes[i].text)), env, {
      onResult: (q, res) => {
        if (res.correct && G.store.collectCard(q.item.card)) G.toast('🎴 取得名句卡！');
      },
    });

    const challenge = G.isChallenge();
    await G.roundIntro(ctx, challenge ? '第二回合：出處配對' : '第二回合：語譯配對',
      challenge ? '看看名句，選出它的作者和篇名。' : '看看語譯，從四句名句中選出對應的一句。');
    ctx.round(challenge ? '第二回合：出處配對' : '第二回合：語譯配對');
    const r2 = await G.runQuestions(ctx, shuffle(idx).map((i) => mk(() => (challenge ? Q.quoteSource(u, i) : Q.quoteTrans(u, i)), u.quotes[i].text)), env);

    await G.roundIntro(ctx, '第三回合：名句用得着', '看看生活處境，選出最合用的名句。答完後，看看每句名句適用的情況。');
    ctx.round('第三回合：名句用得着');
    const r3 = await G.runQuestions(ctx, sample(idx, 3).map((i) => mk(() => Q.quoteScene(u, i), u.quotes[i].text)), env);

    const all = [r1, r2, r3];
    const wrong = all.flatMap((r) => r.wrong);
    G.placeSummary(ctx, {
      unitId, place: 'quote',
      total: { mistakes: all.reduce((s, r) => s + r.mistakes, 0), hints: all.reduce((s, r) => s + r.hints, 0) },
      wrongWords: [...new Set(wrong.map((m) => m.word))],
      redo: wrong.length ? () => G.redoWrong(ctx, unitId, 'quote', wrong, '名句') : null,
    });
  };
})(window.G);
