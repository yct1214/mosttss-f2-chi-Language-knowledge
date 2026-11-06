// 測試用：在瀏覽器主控台貼上，或由自動測試注入。會自動答題（可設定答錯機率），用來檢查整個流程。
// 用法：await autoplay({ wrongRate: 0.1, max: 200 })
window.autoplay = async function ({ wrongRate = 0, max = 300, delay = 30 } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = async (el) => { if (el && !el.disabled) { el.click(); await sleep(delay); } };
  const log = [];
  for (let n = 0; n < max; n++) {
    await sleep(delay);
    const next = document.querySelector('.q-feedback .next');
    if (next) { await click(next); continue; }
    const intro = document.querySelector('.round-intro .btn');
    if (intro) { await click(intro); continue; }
    const qEl = document.querySelector('.q');
    const q = G.current;
    if (!qEl || !q) break;
    const bad = Math.random() < wrongRate;
    log.push(q.type + ':' + (q.label || ''));
    if (q.type === 'mcq') {
      const opts = [...qEl.querySelectorAll('.opt')];
      const i = bad ? opts.findIndex((b, k) => k !== q.answer && !b.disabled) : q.answer;
      await click(opts[i]);
    } else if (q.type === 'judge') {
      const two = [...qEl.querySelectorAll('.opts.two .opt')];
      if (two.length) await click(two[(q.isWrong !== bad) ? 1 : 0]);
      if (q.isWrong && !bad && !G.current.__done) {
        const chars = [...qEl.querySelectorAll('.word button.ch')];
        if (chars.length) await click(chars[q.pos[0]]);
        const opts = [...qEl.querySelectorAll('.opts.four .opt')];
        await click(opts.find((b) => b.textContent === q.fix));
      }
    } else if (q.type === 'findfix') {
      for (const t of q.targets) {
        if (t.fixed) continue;
        if (bad) {
          const plain = [...qEl.querySelectorAll('.ff-text button.ch')].find((b) => !q.targets.some((x) => x.el === b) && !b.disabled);
          await click(plain);
          if (!q.multi) break;
        }
        await click(t.el);
        const opts = [...qEl.querySelectorAll('.opts.four .opt')];
        await click(opts.find((b) => b.textContent === t.answer));
      }
    } else if (q.type === 'order') {
      const seq = bad ? q.answer.slice().reverse() : q.answer;
      for (const p of seq) {
        const btn = [...qEl.querySelectorAll('.piece')].find((b) => b.textContent === p && !b.disabled);
        await click(btn);
      }
    }
  }
  return log;
};
