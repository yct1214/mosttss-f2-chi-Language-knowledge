// 主程式：封面、開場故事、環形世界地圖、島嶼畫面、設定
(function (G) {
  const { h } = G;
  const E = window.EXTRA;
  const st = () => G.store;

  function applyFont() {
    document.documentElement.dataset.font = st().state.settings.font;
  }

  // ---------- 封面 ----------
  G.go.cover = function () {
    const s = st().state;
    const started = s.seenIntro;
    const el = h('div.screen.cover',
      h('div.cover-title',
        h('h1.kai', '九島勇者傳'),
        h('p.cover-sub', '中二級　名句・成語・錯別字自學遊戲'),
        s.castle.won ? h('p.cover-badge', '🏅 勇者之證') : null),
      h('div.cover-buttons',
        h('button.btn.big.primary', { onclick: () => (started ? G.go.map() : G.go.intro()) }, started ? '繼續冒險' : '開始冒險'),
        started ? h('button.btn', { onclick: () => G.go.intro() }, '重看開場故事') : null,
        h('button.btn.ghost', { onclick: () => G.go.settings('cover') }, '設定')));
    G.show(el, { bg: G.IMG.cover, bgMode: 'clear' });
  };

  // ---------- 開場故事 ----------
  G.go.intro = function () {
    let k = 0;
    const text = h('p.story-text', { 'aria-live': 'polite' });
    const dots = h('div.story-dots');
    const next = h('button.btn.big.primary', { onclick: step });
    const el = h('div.screen.story',
      h('main.story-panel', h('h2.kai', '開場故事'), text, dots,
        h('div.btn-row', h('button.btn.ghost', { onclick: done }, '略過'), next)));
    function draw() {
      text.textContent = E.story.intro[k];
      dots.textContent = E.story.intro.map((x, i) => (i === k ? '●' : '○')).join(' ');
      next.textContent = k < E.story.intro.length - 1 ? '下一頁 ›' : '出發！';
      text.classList.remove('fade'); void text.offsetWidth; text.classList.add('fade');
    }
    function step() { if (k < E.story.intro.length - 1) { k++; draw(); } else done(); }
    function done() { st().state.seenIntro = true; st().save(); G.go.map(); }
    G.show(el, { bg: G.IMG.cover, bgMode: 'dim' });
    draw();
    next.focus();
  };

  // ---------- 世界地圖 ----------
  G.go.map = async function () {
    const S = st();
    const n = S.treasureCount();
    if (n === 8 && !S.state.castle.opened) {
      await G.playBridge();
      S.state.castle.opened = true;
      S.save();
    }
    const teacherOpen = G.teacher.allOpen() && !(S.state.castle.opened || n === 8);
    const opened = S.state.castle.opened || n === 8 || teacherOpen;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'bridges');
    svg.setAttribute('aria-hidden', 'true');
    const mapEl = h('div.map', { role: 'group', 'aria-label': '世界地圖：八個試煉島圍繞中央的魔王城' }, svg);

    const islandBtns = E.islands.map((isl) => {
      const d = S.island(isl.id);
      const total = (d.typo || 0) + (d.idiom || 0) + (d.quote || 0);
      return h('button.map-island' + (d.trial ? '.cleared' : ''), {
        onclick: () => G.go.island(isl.id),
        'aria-label': `${isl.name}（${G.unit(isl.id).title}），星 ${total} / 9${d.trial ? '，已取得' + isl.treasure : ''}`,
      },
      h('img', { src: G.IMG.island(isl.id), alt: '' }),
      h('span.map-label', isl.name, h('small', `★${total}/9`)),
      d.trial ? h('img.map-treasure', { src: G.IMG.treasure(isl.id), alt: '' }) : null);
    });
    const castleBtn = h('button.map-castle' + (opened ? '.open' : ''), {
      onclick: () => G.go.castle(),
      'aria-label': opened ? '第九島：魔王城（已開放）' : `第九島：魔王城（尚欠 ${8 - n} 件法寶）`,
    },
    h('img', { src: G.IMG.castle, alt: '' }),
    opened ? null : h('div.fog'),
    h('span.map-label.castle-label', '魔王城', h('small', teacherOpen ? '老師模式：已解鎖' : opened ? (S.state.castle.won ? '🏅 已擊敗魔王' : '通道已打開') : `尚欠 ${8 - n} 件法寶`)));
    mapEl.append(...islandBtns, castleBtn);

    function layout() {
      const W = mapEl.clientWidth, H = mapEl.clientHeight;
      if (!W || !H) return;
      const portrait = H > W * 1.1;
      const cx = W / 2, cy = H / 2;
      const isz = Math.min(portrait ? W * 0.32 : H * 0.24, portrait ? H * 0.17 : W * 0.17, 210);
      const csz = Math.min(isz * 1.35, portrait ? W * 0.42 : H * 0.36);
      const rx = portrait ? W / 2 - isz * 0.55 : Math.min(W / 2 - isz * 0.6, H * 0.62);
      const ry = portrait ? H / 2 - isz * 0.55 : H / 2 - isz * 0.55;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = '';
      islandBtns.forEach((b, k) => {
        const a = (-90 + k * 45) * Math.PI / 180;
        const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
        Object.assign(b.style, { width: isz + 'px', left: x - isz / 2 + 'px', top: y - isz / 2 + 'px' });
        const lit = S.island(k + 1).trial;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x); line.setAttribute('y1', y);
        line.setAttribute('x2', cx); line.setAttribute('y2', cy);
        line.setAttribute('class', lit ? 'beam-on' : 'beam-off');
        svg.appendChild(line);
      });
      Object.assign(castleBtn.style, { width: csz + 'px', left: cx - csz / 2 + 'px', top: cy - csz / 2 + 'px' });
    }

    const el = h('div.screen.map-screen',
      G.topbar({
        title: '九島群島',
        onBack: () => G.go.cover(),
        right: h('span.treasure-count', { 'aria-label': `法寶 ${n} / 8` }, '法寶 ', h('b', `${n} / 8`)),
      }),
      mapEl,
      h('nav.bottom-nav',
        h('button.btn.small', { onclick: () => G.go.album() }, '🎴 卡冊'),
        h('button.btn.small', { onclick: () => G.go.settings('map') }, '⚙ 設定')));
    G.show(el, { bg: G.IMG.sea, bgMode: 'tile', wide: true });
    layout();
    requestAnimationFrame(layout);
    window.addEventListener('resize', layout);
    G.onLeave(() => window.removeEventListener('resize', layout));
  };

  // ---------- 島嶼畫面 ----------
  G.go.island = function (id) {
    const S = st();
    const isl = G.island(id);
    const u = G.unit(id);
    const d = S.island(id);
    const teacherOpen = G.teacher.allOpen() && !S.placesDone(id);
    const ready = S.placesDone(id) || teacherOpen;
    const line = d.trial ? `你已取得「${isl.treasure}」。想再練習的話，隨時歡迎。` : ready ? isl.lines.ready : (d.typo || d.idiom || d.quote) ? isl.lines.tip : isl.lines.enter;
    const placeBtn = (p) => h('button.place-btn', { onclick: () => G.games[p](id) },
      h('span.place-icon', { 'aria-hidden': 'true' }, G.PLACES[p].icon),
      h('span.place-text', h('b', G.PLACES[p].name), h('small', G.PLACES[p].desc)),
      G.stars(d[p] || 0));
    const trialBtn = h('button.place-btn.trial' + (ready ? '' : '.locked'), {
      onclick: () => (ready ? G.games.trial(id) : G.toast('先完成三個地點，才可接受島主試煉。')),
      'aria-disabled': ready ? null : 'true',
    },
    h('img.place-treasure', { src: G.IMG.treasure(id), alt: '', style: d.trial ? null : { filter: 'grayscale(1) brightness(.7)' } }),
    h('span.place-text', h('b', '島主試煉'), h('small', d.trial ? `已取得法寶：${isl.treasure}` : teacherOpen ? '老師模式：已解鎖' : ready ? `通過可獲得法寶「${isl.treasure}」` : '完成三個地點後開放')),
    h('span.lock', ready ? (d.trial ? '✓' : '›') : '🔒'));
    const el = h('div.screen.island',
      G.topbar({ title: isl.name, onBack: () => G.go.map() }),
      h('main.panel.island-panel',
        h('div.island-head',
          h('img.island-master', { src: G.IMG.master(id), alt: isl.master }),
          h('div.island-info',
            h('div.unit-title', u.title),
            h('div.fb-small', '島主：' + isl.master + '　景觀：' + isl.scenery),
            G.speech(id, line))),
        h('div.place-list', placeBtn('typo'), placeBtn('idiom'), placeBtn('quote'), trialBtn)));
    G.show(el, { bg: G.IMG.place(id, 'trial') });
  };

  // ---------- 設定 ----------
  G.go.settings = function (from = 'map') {
    const S = st();
    const s = S.state.settings;
    const back = () => (from === 'cover' ? G.go.cover() : G.go.map());
    const radio = (name, value, label, desc, cur, onPick) => h('label.radio' + (cur === value ? '.on' : ''),
      h('input', { type: 'radio', name, value, checked: cur === value, onchange: () => onPick(value) }),
      h('span', h('b', label), desc ? h('small', desc) : null));

    const exportBox = h('textarea.code', { readonly: true, rows: 3, 'aria-label': '進度碼' });
    const importBox = h('textarea.code', { rows: 3, placeholder: '在這裏貼上進度碼', 'aria-label': '貼上進度碼' });
    let resetStep = 0;
    const resetBtn = h('button.btn.danger', { onclick: doReset }, '重新開始');
    async function doReset() {
      if (resetStep === 0) {
        resetStep = 1;
        resetBtn.textContent = '再按一次確認重新開始';
        G.toast('全部進度將會刪除。如確定，請再按一次。', 3000);
        setTimeout(() => { resetStep = 0; resetBtn.textContent = '重新開始'; }, 5000);
        return;
      }
      if (await G.confirm('重新開始', '全部進度（星數、卡、印章、法寶）都會刪除，不能復原。確定嗎？', '刪除全部進度', '取消')) {
        S.reset();
        applyFont();
        G.toast('已重新開始。');
        G.go.cover();
      }
    }

    const el = h('div.screen.settings',
      G.topbar({ title: '設定', onBack: back }),
      h('main.panel',
        h('section', h('h2', '模式'),
          radio('mode', 'basic', '基礎模式', '不計時；每回合 3 盞提示燈籠；名句第二回合為語譯配對；魔王決戰 5 顆心。', s.mode, (v) => { s.mode = v; S.save(); G.go.settings(from); }),
          radio('mode', 'challenge', '挑戰模式', '每題限時 20 秒；每回合 1 盞提示燈籠；名句第二回合為出處配對；魔王決戰 3 顆心。', s.mode, (v) => { s.mode = v; S.save(); G.go.settings(from); })),
        h('section', h('h2', '字體大小'),
          h('div.radio-row',
            [['std', '標準'], ['lg', '大'], ['xl', '特大']].map(([v, t]) => radio('font', v, t, null, s.font, (val) => { s.font = val; S.save(); applyFont(); G.go.settings(from); })))),
        h('section', h('h2', '進度碼'),
          h('p.fb-small', '進度只存在這部裝置的瀏覽器。轉用其他裝置前，先在這裏匯出進度碼，再到新裝置匯入。清除瀏覽器資料或使用無痕模式會失去進度，記得先匯出。'),
          h('div.btn-row',
            h('button.btn', { onclick: () => { exportBox.value = S.exportCode(); exportBox.select(); } }, '匯出進度'),
            h('button.btn', {
              onclick: async () => {
                if (!exportBox.value) exportBox.value = S.exportCode();
                try { await navigator.clipboard.writeText(exportBox.value); G.toast('已複製進度碼。'); } catch (e) { exportBox.select(); G.toast('請長按或按 Ctrl+C 複製。'); }
              },
            }, '複製進度碼')),
          exportBox,
          importBox,
          h('div.btn-row', h('button.btn', {
            onclick: async () => {
              if (!importBox.value.trim()) return G.toast('請先貼上進度碼。');
              if (!(await G.confirm('匯入進度', '匯入後，這部裝置現有的進度會被取代。確定嗎？', '匯入', '取消'))) return;
              try { S.importCode(importBox.value); applyFont(); G.toast('已匯入進度。'); G.go.map(); } catch (e) { G.modal({ title: '未能匯入', body: h('p', e.message) }); }
            },
          }, '匯入進度'))),
        h('section', h('h2', '重新開始'), h('p.fb-small', '刪除這部裝置上的全部進度。需要按兩次確認。'), resetBtn),
        h('section', h('h2', '老師審訂模式'),
          h('p.fb-small', '供老師查看全部題目、答案和草擬內容，試玩任何一題，或直接示範任何關卡。需要輸入老師密碼。'),
          h('div.btn-row.left',
            h('button.btn', { onclick: () => G.go.teacherLogin() }, G.teacher.unlocked() ? '返回審訂模式' : '進入審訂模式'),
            G.teacher.unlocked() ? h('button.btn.ghost', { onclick: () => { G.teacher.lock(); G.toast('已離開老師審訂模式。'); G.go.settings(from); } }, '離開審訂模式') : null)),
        h('section', h('h2', '關於'),
          h('p.fb-small', '內容根據馬鞍山崇真中學中二級中國語文基礎知識校本教材。短文、情境題、干擾字、名句錯字版本和人物對白為草擬稿，供老師審訂。'),
          h('p.fb-small', '遊戲圖像由 Google Gemini 生成（2026 年 11 月 6 日），詳見 assets/CREDITS.md。'),
          h('p.fb-small', '本遊戲不設登入，不收集任何學生資料。'))));
    G.show(el, { bg: G.IMG.sea, bgMode: 'tile' });
  };

  // ---------- 啟動 ----------
  applyFont();
  G.go.cover();
})(window.G);
