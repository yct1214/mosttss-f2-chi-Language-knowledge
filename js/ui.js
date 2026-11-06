// 共用介面工具：建立元素、畫面切換、對話框、提示訊息、圖片路徑
(function (G) {
  // ---------- 建立元素 ----------
  // h('div.cls#id', {attrs}, child1, child2...)
  function h(sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) {
      for (const part of m[2].match(/[.#][\w-]+/g)) {
        if (part[0] === '.') el.classList.add(part.slice(1));
        else el.id = part.slice(1);
      }
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      kids.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'class') el.className += ' ' + v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  }

  // ---------- 隨機 ----------
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sample = (arr, n) => shuffle(arr).slice(0, n);
  const isHan = (c) => /[\u3400-\u9fff\uf900-\ufaff]/.test(c);

  // ---------- 圖片 ----------
  const IMG = {
    cover: 'assets/img/cover.webp',
    ending: 'assets/img/ending.webp',
    sea: 'assets/img/backgrounds/bg-sea.webp',
    album: 'assets/img/backgrounds/bg-album.webp',
    castleBg: 'assets/img/backgrounds/bg-castle.webp',
    gate: (n) => `assets/img/backgrounds/bg-castle-gate${n}.webp`,
    place: (id, place) => `assets/img/backgrounds/bg-${id}-${place}.webp`, // place: typo / idiom / quote / trial
    island: (id) => `assets/img/islands/island-${id}.webp`,
    castle: 'assets/img/islands/island-castle.webp',
    master: (id) => `assets/img/characters/master-${id}.webp`,
    demon: 'assets/img/characters/demon-king.webp',
    treasure: (id) => `assets/img/treasures/treasure-${id}.webp`,
    card: (k) => `assets/img/cards/card-${k}.webp`, // idiom / quote / back
  };

  // ---------- 畫面切換 ----------
  const app = () => document.getElementById('app');
  let cleanup = [];
  function onLeave(fn) { cleanup.push(fn); }
  function show(screenEl, opts = {}) {
    cleanup.forEach((fn) => { try { fn(); } catch (e) { /* 忽略 */ } });
    cleanup = [];
    setBg(opts.bg || IMG.sea, opts.bgMode);
    const a = app();
    a.innerHTML = '';
    a.className = opts.wide ? 'wide' : '';
    a.appendChild(screenEl);
    window.scrollTo(0, 0);
    // 把焦點移到畫面標題，方便使用螢幕閱讀器
    const focus = screenEl.querySelector('h1, h2, [data-focus]');
    if (focus) { focus.setAttribute('tabindex', '-1'); focus.focus({ preventScroll: true }); }
  }
  function setBg(url, mode) {
    const bg = document.getElementById('bg');
    bg.style.backgroundImage = `url("${url}")`;
    bg.className = mode || '';
  }

  // ---------- 對話框 ----------
  // modal({ title, body, buttons: [{ label, value, cls }] }) → Promise(value)
  function modal({ title, body, buttons = [{ label: '好', value: true }], dismissible = false, cls = '' }) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const close = (v) => {
        wrap.remove();
        document.removeEventListener('keydown', onKey);
        if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
        resolve(v);
      };
      const onKey = (e) => { if (e.key === 'Escape' && dismissible) close(null); };
      const box = h('div.modal' + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '訊息' },
        title ? h('h2.modal-title', title) : null,
        h('div.modal-body', body),
        h('div.modal-buttons', buttons.map((b) => h('button.btn' + (b.cls ? '.' + b.cls : ''), { onclick: () => close(b.value) }, b.label))),
      );
      const wrap = h('div.modal-wrap', { onclick: (e) => { if (dismissible && e.target === wrap) close(null); } }, box);
      document.body.appendChild(wrap);
      document.addEventListener('keydown', onKey);
      const first = box.querySelector('.modal-buttons .btn');
      if (first) first.focus();
    });
  }
  const confirm = (title, text, yes = '確定', no = '取消') =>
    modal({ title, body: h('p', text), buttons: [{ label: no, value: false, cls: 'ghost' }, { label: yes, value: true }] });

  // ---------- 短暫提示 ----------
  let toastTimer;
  function toast(msg, ms = 2200) {
    let t = document.getElementById('toast');
    if (!t) {
      t = h('div#toast', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- 人物對白 ----------
  function speech(who, text, opts = {}) {
    const isDemon = who === 'demon';
    const name = isDemon ? '亂字魔王' : G.island(who).master;
    const src = isDemon ? IMG.demon : IMG.master(who);
    return h('div.speech' + (isDemon ? '.demon' : '') + (opts.small ? '.small' : ''),
      h('img.speech-face', { src, alt: name }),
      h('div.speech-bubble', h('div.speech-name', name), h('div.speech-text', text)),
    );
  }

  // ---------- 頂部列 ----------
  function topbar({ title, onBack, right }) {
    return h('header.topbar',
      onBack ? h('button.btn.icon.back', { onclick: onBack, 'aria-label': '返回' }, '‹ 返回') : h('span.spacer'),
      h('h1.topbar-title', title),
      h('div.topbar-right', right || null),
    );
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const stars = (n, max = 3) => h('span.stars', { 'aria-label': `${n} 粒星（最多 ${max} 粒）` }, '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n)));

  G.go = G.go || {}; // 各畫面的入口，由 main.js、castle.js、cards.js 填入

  Object.assign(G, { h, append, shuffle, pick, sample, isHan, IMG, show, onLeave, setBg, modal, confirm, toast, speech, topbar, sleep, stars });
})(window.G);
