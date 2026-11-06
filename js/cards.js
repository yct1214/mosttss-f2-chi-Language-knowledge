// 卡冊：成語卡、名句卡、正字印章、法寶、再溫習清單、勇者之證
(function (G) {
  const { h } = G;
  const st = () => G.store;
  const E = window.EXTRA;

  let filter = { island: 0, kind: 'all' };

  function cardEl(u, kind, i) {
    const key = `${kind}${u.id}-${i}`;
    const state = st().cardState(key);
    const data = kind === 'i' ? u.idioms[i] : u.quotes[i];
    const title = kind === 'i' ? data.word : '名句・' + G.island(u.id).name;
    const label = state ? (kind === 'i' ? data.word : data.text) : '未收集的卡';
    return h('button.card.' + (kind === 'i' ? 'idiom' : 'quote') + (state ? '' : '.unknown') + (state === 'crack' ? '.crack' : ''), {
      onclick: () => (state ? openCard(u, kind, i) : G.toast(`到${G.island(u.id).name}的${kind === 'i' ? '成語工坊' : '名句書閣'}收集這張卡。`)),
      'aria-label': label + (state === 'crack' ? '（待修補）' : ''),
      style: { backgroundImage: `url("${state ? G.IMG.card(kind === 'i' ? 'idiom' : 'quote') : G.IMG.card('back')}")` },
    },
    state ? h('span.card-title.kai', title) : h('span.card-q', '？'),
    state && kind === 'i' ? h('span.card-body', h('span.tone.tone-' + data.tone, '【' + data.tone + '】'), data.meaning) : null,
    state && kind === 'q' ? h('span.card-body.kai', data.text) : null,
    state === 'crack' ? h('span.card-crack', { 'aria-hidden': 'true' }) : null);
  }

  function openCard(u, kind, i) {
    const key = `${kind}${u.id}-${i}`;
    const crack = st().cardState(key) === 'crack';
    const body = h('div',
      crack ? h('p.crack-note', '⚡ 這張卡有裂紋：之前答錯了相關題目。再答對一次就會修復。') : null,
      kind === 'i' ? G.idiomAfter(u.idioms[i]) : G.quoteAfter(u.quotes[i]),
      kind === 'q' ? h('p', h('b', '釋義：'), u.quotes[i].meaning) : null,
      h('p.fb-small', '來自' + G.island(u.id).name + '（' + u.title + '）'));
    G.modal({ title: kind === 'i' ? '成語卡' : '名句卡', body, dismissible: true, buttons: [{ label: '關閉', value: true }] });
  }

  function cardsTab() {
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      let total = 0, got = 0;
      const grid = h('div.card-grid');
      for (const u of G.units) {
        if (filter.island && filter.island !== u.id) continue;
        if (filter.kind !== 'q') u.idioms.forEach((x, i) => { total++; if (st().cardState(`i${u.id}-${i}`)) got++; grid.appendChild(cardEl(u, 'i', i)); });
        if (filter.kind !== 'i') u.quotes.forEach((x, i) => { total++; if (st().cardState(`q${u.id}-${i}`)) got++; grid.appendChild(cardEl(u, 'q', i)); });
      }
      const islandSel = h('select', { 'aria-label': '按島嶼篩選', onchange: (e) => { filter.island = +e.target.value; draw(); } },
        h('option', { value: 0 }, '全部島嶼'), E.islands.map((isl) => h('option', { value: isl.id, selected: filter.island === isl.id }, isl.name)));
      const kindSel = h('select', { 'aria-label': '按類別篩選', onchange: (e) => { filter.kind = e.target.value; draw(); } },
        [['all', '全部類別'], ['i', '成語卡'], ['q', '名句卡']].map(([v, t]) => h('option', { value: v, selected: filter.kind === v }, t)));
      box.append(h('div.filters', islandSel, kindSel, h('span.count', `已收集 ${got} / ${total}`)), grid);
    };
    draw();
    return box;
  }

  function stampsTab() {
    let all = 0;
    const sections = G.units.map((u) => {
      let n = 0;
      const cells = u.typos.map((t, i) => {
        const c = st().stampCount(`${u.id}-${i}`);
        if (c >= 2) n++;
        return h('div.stamp' + (c >= 2 ? '.on' : ''), { title: c >= 2 ? '已蓋印章' : `答對 ${c} / 2 次` }, h('span', t.correct), c < 2 ? h('small', `${c}/2`) : null);
      });
      all += n;
      return h('section.stamp-sec', h('h3', `${G.island(u.id).name}　${n} / 30`), h('div.stamp-grid', cells));
    });
    return h('div', h('p.fb-small', `同一題答對兩次就會蓋上「正字印章」。這裏只顯示正確寫法。已蓋 ${all} / 240 個。`), sections);
  }

  function treasuresTab() {
    return h('div.treasure-grid', E.islands.map((isl) => {
      const got = st().island(isl.id).trial;
      return h('div.treasure-cell' + (got ? '' : '.unknown'),
        h('img', { src: G.IMG.treasure(isl.id), alt: got ? isl.treasure : '未取得的法寶' }),
        h('div.kai.treasure-name', got ? isl.treasure : '？？？'),
        h('div.fb-small', got ? '決戰技能：' + isl.skillName : `通過${isl.name}的島主試煉取得`));
    }));
  }

  function reviewTab() {
    const keys = Object.keys(st().state.review);
    if (!keys.length) return h('p', '「再溫習」清單是空的。答錯的題目會放在這裏，之後答對就會移走。');
    const groups = { t: [], i: [], q: [] };
    for (const k of keys) {
      const m = k.match(/^([tiq])(\d+)-(\d+)$/);
      if (!m) continue;
      const u = G.unit(+m[2]);
      const i = +m[3];
      if (!u) continue;
      const text = m[1] === 't' ? u.typos[i].correct : m[1] === 'i' ? u.idioms[i].word : u.quotes[i].text;
      groups[m[1]].push({ text, island: G.island(u.id).name });
    }
    const sec = (title, list) => (list.length ? h('section', h('h3', `${title}（${list.length}）`), h('div.word-list', list.map((x) => h('span.word-chip', { title: x.island }, x.text)))) : null);
    return h('div', h('p.fb-small', '這些是你答錯過的題目（只列正確寫法）。魔王城會優先考這些題目。'),
      sec('錯別字', groups.t), sec('成語', groups.i), sec('名句', groups.q));
  }

  function badgeTab() {
    const c = st().state.castle;
    if (!c.won) return h('div.badge.unknown', h('div.badge-icon', '🏅'), h('div.badge-name.kai', '勇者之證'), h('p', '擊敗亂字魔王後獲得。'));
    return h('div.badge', h('div.badge-icon', '🏅'), h('div.badge-name.kai', '勇者之證'), h('p', '你已擊敗亂字魔王！'),
      c.best ? h('p', `最佳決戰成績：剩下 ${c.best.hearts} 顆心，用時 ${Math.floor(c.best.time / 60)} 分 ${c.best.time % 60} 秒（${c.best.date || ''}）`) : null);
  }

  const TABS = [['cards', '卡冊', cardsTab], ['stamps', '正字印章', stampsTab], ['treasures', '法寶', treasuresTab], ['review', '再溫習', reviewTab], ['badge', '勇者之證', badgeTab]];

  G.go.album = function (tab = 'cards') {
    const content = h('div.album-content');
    const tabBtns = TABS.map(([id, name]) => h('button.tab', { role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', onclick: () => G.go.album(id) }, name));
    const el = h('div.screen.album',
      G.topbar({ title: '卡冊', onBack: () => G.go.map() }),
      h('nav.tabs', { role: 'tablist' }, tabBtns),
      h('main.panel', content));
    content.appendChild(TABS.find((t) => t[0] === tab)[2]());
    G.show(el, { bg: G.IMG.album, wide: true });
  };
})(window.G);
