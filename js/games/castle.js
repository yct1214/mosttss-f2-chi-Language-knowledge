// 第九島：魔王城。三道城門（各 10 題）＋魔王決戰（24 點生命值，法寶技能）
(function (G) {
  const { Q, h, shuffle, pick } = G;
  const U = () => G.units;
  const E = window.EXTRA;
  const st = () => G.store;

  // ---------- 抽題：優先「再溫習」和「待修補」，每道門至少涵蓋 5 個單元 ----------
  function listOf(u, cat) { return cat === 't' ? u.typos : cat === 'i' ? u.idioms : u.quotes; }
  function needsReview(key) { return st().inReview(key) || st().cardState(key) === 'crack'; }
  function allItems(cat) {
    return U().flatMap((u) => listOf(u, cat).map((x, i) => ({ u, i, key: `${cat}${u.id}-${i}` })));
  }
  function pickItems(cat, n) {
    const all = allItems(cat);
    const chosen = [];
    const per = {};
    const add = (it) => { chosen.push(it); per[it.u.id] = (per[it.u.id] || 0) + 1; };
    for (const it of shuffle(all.filter((x) => needsReview(x.key)))) {
      if (chosen.length >= n) break;
      if ((per[it.u.id] || 0) >= 2) continue;
      add(it);
    }
    const rest = shuffle(all.filter((x) => !chosen.includes(x)));
    while (chosen.length < n && rest.length) {
      rest.sort((a, b) => (per[a.u.id] || 0) - (per[b.u.id] || 0));
      add(rest.shift());
    }
    return shuffle(chosen);
  }
  function pickInUnit(u, cat) {
    const items = listOf(u, cat).map((x, i) => i);
    const rev = items.filter((i) => needsReview(`${cat}${u.id}-${i}`));
    return pick(rev.length ? rev : items);
  }
  const exOf = (u, i) => u.exercises.findIndex((ex) => ex.answer === u.idioms[i].word);

  // 各類題目（king：指正魔王題）
  function typoQ(u, i, king) {
    if (king) return () => Q.typoFix(u, i, true);
    return Math.random() < 0.5 ? () => Q.typoJudge(u, i, Math.random() < 0.75) : () => Q.typoFix(u, i, false);
  }
  function idiomQ(u, i, king) {
    if (king) return () => Q.idiomMisuse(u, exOf(u, i));
    const k = pick(['spell', 'fill', 'scene']);
    if (k === 'spell') return () => Q.idiomSpell(u, i);
    if (k === 'scene') return () => Q.idiomScene(u, i);
    return () => Q.idiomFill(u, exOf(u, i));
  }
  function quoteQ(u, i, king) {
    if (king) return () => Q.quoteFix(u, i);
    const k = pick(['arrange', 'trans', 'scene']);
    if (k === 'arrange') return () => Q.quoteArrange(u, i);
    if (k === 'scene') return () => Q.quoteScene(u, i);
    return () => (G.isChallenge() ? Q.quoteSource(u, i) : Q.quoteTrans(u, i));
  }
  const byCat = { t: typoQ, i: idiomQ, q: quoteQ };

  function gateQuestions(n) {
    const cat = ['t', 'i', 'q'][n - 1];
    return pickItems(cat, 10).map((it) => {
      if (cat === 't') return typoQ(it.u, it.i, false);
      if (cat === 'i') return Math.random() < 0.25 ? idiomQ(it.u, it.i, true) : idiomQ(it.u, it.i, false);
      return Math.random() < 0.25 ? quoteQ(it.u, it.i, true) : quoteQ(it.u, it.i, false);
    });
  }
  // 決戰：每單元 3 題（錯別字、成語、名句各一，其中一題是指正魔王）
  function bossQuestions() {
    const list = [];
    for (const u of U()) {
      const kingCat = pick(['t', 'i', 'q']);
      for (const cat of ['t', 'i', 'q']) list.push(byCat[cat](u, pickInUnit(u, cat), cat === kingCat));
    }
    return shuffle(list);
  }
  function extraQuestion() {
    const u = pick(U());
    const cat = pick(['t', 'i', 'q']);
    return byCat[cat](u, pickInUnit(u, cat), Math.random() < 0.4);
  }

  // ---------- 光橋動畫 ----------
  G.playBridge = function () {
    return new Promise((resolve) => {
      const parts = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * 45 - 90) * Math.PI / 180;
        // 光橋由各島伸向中央
        parts.push(h('div.beam', { style: { transform: `rotate(${k * 45 - 90}deg)`, animationDelay: `${0.3 + k * 0.4}s` } }));
        parts.push(h('img.bridge-island', { src: G.IMG.island(k + 1), alt: '', style: { left: 50 + 40 * Math.cos(a) + '%', top: 50 + 40 * Math.sin(a) + '%' } }));
      }
      const wrap = h('div.bridge-anim', { role: 'dialog', 'aria-label': '魔王城的通道打開了' },
        h('div.bridge-stage', ...parts, h('div.bridge-fog'), h('img.bridge-castle', { src: G.IMG.castle, alt: '魔王城' })),
        h('p.bridge-text', E.story.bridge),
        h('button.btn.primary', { onclick: done }, '進入魔王城 ›'));
      function done() { wrap.remove(); resolve(); }
      document.body.appendChild(wrap);
    });
  };

  // ---------- 魔王城大門 ----------
  G.go.castle = async function () {
    const n = st().treasureCount();
    const teacherOpen = G.teacher && G.teacher.allOpen();
    if (n < 8 && !teacherOpen) {
      await G.modal({ title: '魔王城', body: h('p', `魔王城被封印的海霧包圍。尚欠 ${8 - n} 件法寶，才能打開通道。`) });
      // 老師示範時可從城門返回；未集齊法寶就回到地圖
      if (!document.querySelector('.map-screen')) G.go.map();
      return;
    }
    if (!st().state.castle.opened && n === 8) {
      await G.playBridge();
      st().state.castle.opened = true;
      st().save();
    }
    const c = st().state.castle;
    const gateNames = ['第一門：錯字門', '第二門：成語門', '第三門：名句門'];
    const gateDesc = ['錯別字 10 題', '成語 10 題', '名句 10 題'];
    const items = gateNames.map((name, k) => {
      const open = k === 0 || c.gates[k - 1] || teacherOpen;
      return h('button.castle-gate' + (c.gates[k] ? '.done' : '') + (open ? '' : '.locked'), {
        onclick: () => (open ? runGate(k + 1) : G.toast('先通過前一道門。')), 'aria-disabled': open ? null : 'true',
      }, h('span.gate-icon', c.gates[k] ? '✓' : open ? '🚪' : '🔒'), h('span.gate-name', name), h('span.gate-desc', c.gates[k] ? '已通過' : gateDesc[k]));
    });
    const bossOpen = c.gates.every(Boolean) || teacherOpen;
    items.push(h('button.castle-gate.boss' + (c.won ? '.done' : '') + (bossOpen ? '' : '.locked'), {
      onclick: () => (bossOpen ? runBoss() : G.toast('先通過三道城門。')),
    }, h('span.gate-icon', bossOpen ? '👑' : '🔒'), h('span.gate-name', '大殿：魔王決戰'), h('span.gate-desc', c.won ? '已擊敗魔王，可再挑戰' : '24 題，三類混合')));
    const el = h('div.screen.castle',
      G.topbar({ title: '第九島・魔王城', onBack: () => G.go.map() }),
      h('main.panel',
        G.speech('demon', c.won ? '哼，你又來了？這次我不會再輸！' : E.demon.gates[0].replace('先過我的錯字門！門上的字，我全都寫錯了！', '先闖過我的三道城門吧！')),
        h('p', '三道城門的題目來自全部八個單元。過了的門會記錄下來；決戰失敗也不用再過城門。'),
        teacherOpen ? h('p.notice', '老師模式：全部城門和魔王決戰已解鎖。') : null,
        h('div.gate-list', items),
        c.best ? h('p.fb-small', `最佳決戰成績：剩下 ${c.best.hearts} 顆心，用時 ${fmtTime(c.best.time)}。`) : null,
      ));
    G.show(el, { bg: G.IMG.castleBg });
  };

  function fmtTime(s) { return `${Math.floor(s / 60)} 分 ${s % 60} 秒`; }

  // 供老師審訂模式直接示範（不需先集齊法寶或通過城門）
  G.games.gate = (n) => runGate(n);
  G.games.boss = () => runBoss();

  // ---------- 城門 ----------
  async function runGate(n) {
    const hearts = G.hearts(3);
    const ctx = G.placeScreen({ unitId: 1, place: 'gate', title: ['', '錯字門', '成語門', '名句門'][n], bg: G.IMG.gate(n), onExit: () => G.go.castle(), right: hearts.el });
    await new Promise((resolve) => {
      ctx.round(['', '第一門：錯字門', '第二門：成語門', '第三門：名句門'][n]);
      const btn = h('button.btn.big.primary', { onclick: resolve }, '闖門 ›');
      ctx.host.append(h('div.round-intro', G.speech('demon', E.demon.gates[n - 1]), h('p', '共 10 題，你有 3 顆心。'), btn));
      btn.focus({ preventScroll: true });
    });
    const makers = gateQuestions(n);
    const env = { practice: false, timer: G.isChallenge() ? 20 : 0, praise: () => '✨' };
    for (let k = 0; k < makers.length; k++) {
      ctx.round(`${['', '錯字門', '成語門', '名句門'][n]}　第 ${k + 1} / 10 題`);
      const q = makers[k]();
      const res = await G.ask(q, ctx.host, { ...env, timer: q.type === 'order' ? 0 : env.timer, nextLabel: '繼續 ›' }).promise;
      G.applyResult(q, res);
      if (!res.correct) {
        hearts.lose();
        if (hearts.left <= 0) {
          ctx.round('闖門失敗');
          ctx.host.innerHTML = '';
          ctx.host.append(h('div.summary', h('h2', '闖門失敗'), G.speech('demon', E.demon.gateFail),
            h('p', '答錯的題目已放入「再溫習」清單，可以回到各島練習。'),
            h('div.btn-row', h('button.btn', { onclick: () => runGate(n) }, '再闖一次'), h('button.btn.primary', { onclick: () => G.go.castle() }, '返回魔王城'))));
          return;
        }
      }
    }
    st().state.castle.gates[n - 1] = true;
    st().save();
    ctx.round('城門打開了！');
    ctx.host.innerHTML = '';
    ctx.host.append(h('div.summary', h('h2', '城門打開了！'), G.speech('demon', E.demon.gatePass[n - 1]),
      h('div.btn-row', h('button.btn.primary', { onclick: () => G.go.castle() }, n < 3 ? '前往下一道門 ›' : '進入大殿 ›'))));
  }

  // ---------- 魔王決戰 ----------
  async function runBoss() {
    const maxHearts = G.isChallenge() ? 3 : 5;
    const hearts = G.hearts(maxHearts);
    const ctx = G.placeScreen({ unitId: 1, place: 'boss', title: '魔王決戰', bg: G.IMG.castleBg, onExit: () => G.go.castle(), right: hearts.el });
    const MAXHP = 24;
    let hp = MAXHP;
    const hpFill = h('div.hp-fill');
    const hpText = h('span.hp-text');
    const line = h('div.speech-text');
    const demonBox = h('div.boss-head',
      h('img.boss-img', { src: G.IMG.demon, alt: '亂字魔王' }),
      h('div.boss-info', h('div.speech-name', '亂字魔王'), h('div.hp-bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': MAXHP }, hpFill), hpText, line));
    const drawHp = () => {
      hpFill.style.width = (Math.max(0, hp) / MAXHP) * 100 + '%';
      hpText.textContent = `生命值 ${Math.max(0, hp)} / ${MAXHP}`;
      demonBox.querySelector('.hp-bar').setAttribute('aria-valuenow', Math.max(0, hp));
    };
    drawHp();

    // 開場
    await new Promise((resolve) => {
      ctx.round('大殿');
      const btn = h('button.btn.big.primary', { onclick: resolve }, '開始決戰 ›');
      ctx.host.append(h('div.round-intro', G.speech('demon', E.demon.battleStart),
        h('p', `魔王有 ${MAXHP} 點生命值，你有 ${maxHearts} 顆心。每答對一題，魔王扣 1 點；答錯一題，你失一顆心。八件法寶各可使用一次。`),
        btn));
      btn.focus({ preventScroll: true });
    });

    // 法寶技能列
    const used = new Set();
    let ctrl = null, shield = false, dbl = false;
    const skillBtns = E.islands.map((isl) => h('button.skill', {
      onclick: () => useSkill(isl), title: isl.treasure + '：' + isl.skillName, 'aria-label': isl.treasure + '：' + isl.skillName,
    }, h('img', { src: G.IMG.treasure(isl.id), alt: '' }), h('span', isl.treasure)));
    const skillBar = h('div.skills', skillBtns);
    const status = h('div.skill-status', { 'aria-live': 'polite' });
    function useSkill(isl) {
      if (used.has(isl.id)) return G.toast(isl.treasure + '已經用過了。');
      if (!ctrl || ctrl.finished) return G.toast('請在作答時使用法寶。');
      let ok = false;
      switch (isl.skill) {
        case 'hint': ok = ctrl.showHint(); break;
        case 'shield': ok = !shield; shield = true; break;
        case 'eliminate': ok = ctrl.eliminate(); break;
        case 'double': ok = !dbl; dbl = true; break;
        case 'heal': ok = hearts.left < hearts.max; if (ok) hearts.set(hearts.left + 1); break;
        case 'reveal': ok = ctrl.reveal(); break;
        case 'time': ok = ctrl.addTime(10); break;
        case 'retry': ok = ctrl.grantRetry(); break;
      }
      if (!ok) return G.toast(isl.treasure + '：這一題用不着。');
      used.add(isl.id);
      const b = skillBtns[isl.id - 1];
      b.disabled = true;
      b.classList.add('used');
      G.toast('使用了' + isl.treasure + '：' + isl.skillName);
      status.textContent = [shield ? '🛡 本題答錯不失心' : '', dbl ? '⚔ 本題答對扣 2 點' : ''].filter(Boolean).join('　');
    }

    const qhost = h('div.qhost');
    ctx.host.innerHTML = '';
    ctx.host.append(demonBox, skillBar, status, qhost);
    line.textContent = E.demon.battleStart;

    const queue = bossQuestions();
    const t0 = Date.now();
    let count = 0;
    while (hp > 0 && hearts.left > 0) {
      count++;
      const make = queue.length ? queue.shift() : extraQuestion();
      const q = make();
      shield = false;
      dbl = false;
      status.textContent = '';
      ctx.round(`魔王決戰　第 ${count} 題`);
      ctrl = G.ask(q, qhost, {
        practice: false,
        timer: G.isChallenge() && q.type !== 'order' ? 20 : 0,
        praise: () => '',
        nextLabel: '繼續 ›',
        onFinish: (correct) => {
          if (correct) {
            hp -= dbl ? 2 : 1;
            drawHp();
            demonBox.classList.remove('hurt'); void demonBox.offsetWidth; demonBox.classList.add('hurt');
            line.textContent = hp > 0 ? pick(E.demon.hurt) : E.demon.defeat;
          } else {
            if (!shield) hearts.lose();
            else G.toast('守信令牌保護了你，沒有失心。');
            line.textContent = pick(E.demon.taunt);
          }
        },
      });
      const res = await ctrl.promise;
      G.applyResult(q, res);
    }
    ctrl = null;
    const time = Math.round((Date.now() - t0) / 1000);
    if (hp <= 0) win(hearts.left, time);
    else lose(ctx);
  }

  function lose(ctx) {
    ctx.round('決戰落敗');
    ctx.host.innerHTML = '';
    ctx.host.append(h('div.summary', h('h2', '決戰落敗'), G.speech('demon', E.demon.win),
      h('p', '三道城門已經記錄下來，可以直接重新決戰。答錯的題目已放入「再溫習」清單。'),
      h('div.btn-row', h('button.btn', { onclick: () => runBoss() }, '重新決戰'), h('button.btn.primary', { onclick: () => G.go.castle() }, '返回魔王城'))));
  }

  function win(heartsLeft, time) {
    const c = st().state.castle;
    const first = !c.won;
    c.won = true;
    const better = !c.best || heartsLeft > c.best.hearts || (heartsLeft === c.best.hearts && time < c.best.time);
    if (better) c.best = { hearts: heartsLeft, time, date: new Date().toISOString().slice(0, 10) };
    st().save();
    const el = h('div.screen.ending',
      h('main.ending-panel',
        h('h1.kai', first ? '勝利！' : '再次勝利！'),
        ...E.story.ending.map((t) => h('p', t)),
        h('div.badge', h('div.badge-icon', '🏅'), h('div.badge-name.kai', '勇者之證'), h('div.fb-small', `本次：剩下 ${heartsLeft} 顆心，用時 ${fmtTime(time)}`),
          h('div.fb-small', `最佳：剩下 ${c.best.hearts} 顆心，用時 ${fmtTime(c.best.time)}` + (better && !first ? '（新紀錄！）' : ''))),
        h('div.btn-row',
          h('button.btn', { onclick: () => G.go.album('badge') }, '查看卡冊'),
          h('button.btn', { onclick: () => runBoss() }, '再挑戰魔王'),
          h('button.btn.primary', { onclick: () => G.go.map() }, '回到地圖'))));
    G.show(el, { bg: G.IMG.ending, bgMode: 'clear' });
  }
})(window.G);
