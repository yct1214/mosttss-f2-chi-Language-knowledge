// 進度儲存：只存在本機瀏覽器（localStorage），不會傳送到任何伺服器。
window.G = window.G || {};
(function (G) {
  const KEY = 'jiudao-hero-v1';

  function blank() {
    return {
      v: 1,
      seenIntro: false,
      settings: { mode: 'basic', font: 'std' },
      islands: {},      // { 1: { typo: 星數, idiom: 星數, quote: 星數, trial: true/false } }
      stamps: {},       // { '1-3': 答對次數 }，2 次或以上即蓋印
      cards: {},        // { 'i1-2': 'ok' | 'crack', 'q1-4': ... }
      review: {},       // 再溫習清單 { 't1-3': 時間, 'i1-2': ..., 'q1-4': ... }
      passages: {},     // 每島上次抽到的捉錯字短文 { 1: 0 }，避免連續兩次相同
      castle: { opened: false, gates: [false, false, false], won: false, best: null },
    };
  }

  function merge(base, data) {
    // 只取已知欄位，避免匯入資料格式錯誤時弄壞遊戲
    const s = blank();
    if (!data || typeof data !== 'object') return s;
    s.seenIntro = !!data.seenIntro;
    if (data.settings) {
      if (['basic', 'challenge'].includes(data.settings.mode)) s.settings.mode = data.settings.mode;
      if (['std', 'lg', 'xl'].includes(data.settings.font)) s.settings.font = data.settings.font;
    }
    for (const k of ['islands', 'stamps', 'cards', 'review', 'passages']) if (data[k] && typeof data[k] === 'object') s[k] = data[k];
    if (data.castle && typeof data.castle === 'object') {
      s.castle.opened = !!data.castle.opened;
      s.castle.won = !!data.castle.won;
      if (Array.isArray(data.castle.gates)) s.castle.gates = [0, 1, 2].map((i) => !!data.castle.gates[i]);
      if (data.castle.best && typeof data.castle.best === 'object') s.castle.best = data.castle.best;
    }
    return s;
  }

  let state;
  try {
    state = merge(null, JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    state = blank();
  }

  const S = {
    get state() { return state; },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式或空間不足 */ }
    },
    reset() { state = blank(); S.save(); },

    island(id) {
      if (!state.islands[id]) state.islands[id] = { typo: 0, idiom: 0, quote: 0, trial: false };
      return state.islands[id];
    },
    setStars(id, place, stars) {
      const isl = S.island(id);
      isl[place] = Math.max(isl[place] || 0, stars);
      S.save();
    },
    placesDone(id) {
      const isl = S.island(id);
      return ['typo', 'idiom', 'quote'].every((p) => isl[p] > 0);
    },
    treasureCount() {
      let n = 0;
      for (let i = 1; i <= 8; i++) if (S.island(i).trial) n++;
      return n;
    },

    // 正字印章
    stampCount(key) { return state.stamps[key] || 0; },
    hasStamp(key) { return (state.stamps[key] || 0) >= 2; },
    addStampHit(key) {
      const before = S.hasStamp(key);
      state.stamps[key] = (state.stamps[key] || 0) + 1;
      S.save();
      return !before && S.hasStamp(key); // 這次是否剛蓋上印章
    },

    // 卡
    cardState(key) { return state.cards[key] || null; },
    collectCard(key) {
      const isNew = !state.cards[key];
      state.cards[key] = 'ok';
      S.save();
      return isNew;
    },

    // 答題結果：更新再溫習清單、卡的裂紋
    record(item, correct) {
      if (!item) return;
      const key = item.key;
      if (correct) {
        delete state.review[key];
        if (item.card && state.cards[item.card] === 'crack') state.cards[item.card] = 'ok';
      } else {
        state.review[key] = Date.now();
        if (item.card && state.cards[item.card]) state.cards[item.card] = 'crack';
      }
      S.save();
    },
    inReview(key) { return !!state.review[key]; },

    // 進度碼：把進度轉成一串文字，方便轉用其他裝置
    exportCode() {
      const json = JSON.stringify(state);
      const bytes = new TextEncoder().encode(json);
      let bin = '';
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return 'JD1.' + btoa(bin);
    },
    importCode(code) {
      code = (code || '').trim().replace(/\s+/g, '');
      if (!code.startsWith('JD1.')) throw new Error('這不是《九島勇者傳》的進度碼。');
      let data;
      try {
        const bin = atob(code.slice(4));
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        data = JSON.parse(new TextDecoder().decode(bytes));
      } catch (e) {
        throw new Error('進度碼不完整，請檢查有沒有複製漏了。');
      }
      if (!data || data.v !== 1) throw new Error('進度碼的版本不符。');
      state = merge(null, data);
      S.save();
    },
  };

  G.store = S;
})(window.G);
