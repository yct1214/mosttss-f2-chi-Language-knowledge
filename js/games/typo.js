// 錯字森林：第一回合辨字快答（10 題），第二回合捉錯字短文（1 篇）
(function (G) {
  const { Q, shuffle } = G;

  function maker(u, i, showWrong) {
    const fn = () => Q.typoJudge(u, i, showWrong);
    fn.word = u.typos[i].correct;
    return fn;
  }

  G.games.typo = async function (unitId) {
    const u = G.unit(unitId);
    const ctx = G.placeScreen({ unitId, place: 'typo', title: G.island(unitId).name + '・錯字森林' });
    const env = G.practiceEnv(unitId);
    const st = G.store;

    // 優先抽「未蓋印章」的題目
    const idx = u.typos.map((t, i) => i);
    const fresh = shuffle(idx.filter((i) => !st.hasStamp(`${u.id}-${i}`)));
    const done = shuffle(idx.filter((i) => st.hasStamp(`${u.id}-${i}`)));
    const chosen = fresh.concat(done).slice(0, 10);
    // 錯誤寫法和正確寫法各佔一半
    const wrongSet = new Set(shuffle(chosen).slice(0, 5));
    const makers = chosen.map((i) => maker(u, i, wrongSet.has(i)));

    await G.roundIntro(ctx, '第一回合：辨字快答', '先判斷詞語寫得對不對；有錯字的話，點出錯字，再選出正確的字。同一題答對兩次，就會蓋上「正字印章」。');
    ctx.round('第一回合：辨字快答');
    const r1 = await G.runQuestions(ctx, makers, env);

    await G.roundIntro(ctx, '第二回合：捉錯字短文', '短文裏藏了 6 個錯字。點出錯字，再選出正確的字。點錯了不扣分，但會計入失誤。');
    ctx.round('第二回合：捉錯字短文');
    let failedKeys = [];
    const r2 = await G.runQuestions(ctx, [() => Q.passage(u)], env, {
      onResult: (q, res) => { failedKeys = res.failed; },
    });

    const failedWords = failedKeys.map((k) => u.typos[+k.split('-')[1]].correct);
    const failedMakers = failedKeys.map((k) => maker(u, +k.split('-')[1], true));
    const wrong = r1.wrong.concat(failedMakers);
    G.placeSummary(ctx, {
      unitId, place: 'typo',
      total: { mistakes: r1.mistakes + r2.mistakes, hints: r1.hints + r2.hints },
      wrongWords: r1.wrong.map((m) => m.word).concat(failedWords),
      redo: wrong.length ? () => G.redoWrong(ctx, unitId, 'typo', wrong, '辨字快答') : null,
    });
  };
})(window.G);
