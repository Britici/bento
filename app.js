'use strict';
/* Missão da Noite — app sem dependências. Dados ficam só neste aparelho (localStorage). */
(function () {

  /* ================= utilidades ================= */
  const pad = n => String(n).padStart(2, '0');
  // Data LOCAL (não usar toISOString: em UTC-3 vira o dia seguinte a partir das 21h).
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dayNumber = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  const rand = n => Math.floor(Math.random() * n);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (a, n) => shuffle(a).slice(0, n);

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv;
          }
        } else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ================= armazenamento ================= */
  const mem = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('mdn.' + k); if (v !== null) return JSON.parse(v); } catch (e) { /* ignora */ }
      return (k in mem) ? mem[k] : d;
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem('mdn.' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
  };

  const DEFAULTS = { childName: 'Bento', guideName: 'Super Amigo', guideEmoji: '🦸', clubName: 'Clube da Missão', perDay: 3, voice: true, sound: true };
  const GUIDES = ['🦸', '🐶', '🐻', '🦁', '🦖', '🚀', '⚽', '🤖'];

  let settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
  let log = store.get('log', []);
  let days = store.get('days', {});
  let levels = store.get('levels', {});
  if (!Array.isArray(log)) log = [];
  if (!days || typeof days !== 'object' || Array.isArray(days)) days = {};
  if (!levels || typeof levels !== 'object' || Array.isArray(levels)) levels = {};
  settings.perDay = clamp(parseInt(settings.perDay, 10) || DEFAULTS.perDay, 1, 5);

  /* ================= som e voz ================= */
  let actx = null;
  function audio() {
    if (!settings.sound) return null;
    try {
      if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; actx = new AC(); }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(freq, dur = 0.18, type = 'sine', vol = 0.15, when = 0) {
    const ac = audio(); if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      const t0 = ac.currentTime + when;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) { /* ignora */ }
  }
  const sfx = {
    ok() { tone(660, .12, 'triangle'); tone(880, .18, 'triangle', .15, .1); },
    bad() { tone(220, .22, 'sine', .12); },
    tap() { tone(520, .08, 'triangle', .1); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .15, i * .12)); }
  };

  let ptVoice = null;
  const hasTTS = () => typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  function loadVoice() {
    try {
      const vs = window.speechSynthesis.getVoices();
      ptVoice = vs.find(v => /^pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
    } catch (e) { /* ignora */ }
  }
  if (hasTTS()) {
    loadVoice();
    try { window.speechSynthesis.addEventListener('voiceschanged', loadVoice); } catch (e) { /* ignora */ }
  }
  function say(text) {
    if (!settings.voice || !hasTTS()) return;
    try {
      window.speechSynthesis.cancel();
      const u = new window.SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; if (ptVoice) u.voice = ptVoice;
      u.rate = 0.9; u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignora */ }
  }
  function stopSpeech() { try { if (hasTTS()) window.speechSynthesis.cancel(); } catch (e) { /* ignora */ } }

  /* ================= telas ================= */
  const app = document.getElementById('app');
  let cleanup = [];
  function onLeave(fn) { cleanup.push(fn); }
  function timeout(fn, ms) {
    const id = setTimeout(fn, ms);
    cleanup.push(() => clearTimeout(id));
    return id;
  }
  function runCleanup() {
    const c = cleanup; cleanup = [];
    c.forEach(f => { try { f(); } catch (e) { /* ignora */ } });
    stopSpeech();
  }
  // Limpa a tela anterior ANTES de montar a nova (os timers da nova tela ficam registrados).
  function render(build) {
    runCleanup();
    let node;
    try { node = build(); } catch (e) {
      console.error(e);
      node = h('div', { class: 'screen' }, h('p', null, 'Ops! Algo deu errado.'),
        h('button', { class: 'big-btn', type: 'button', onclick: () => location.reload() }, 'Recarregar'));
    }
    app.replaceChildren(node);
    app.scrollTop = 0;
  }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function toast(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 1800); }

  // Botão que exige segurar (evita toques acidentais da criança).
  function holdable(el, ms, fn) {
    let t = null;
    const stop = () => { if (t) { clearTimeout(t); t = null; } el.classList.remove('holding'); };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      el.style.setProperty('--hold', ms + 'ms');
      el.classList.add('holding');
      t = setTimeout(() => { t = null; el.classList.remove('holding'); fn(); }, ms);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, stop));
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(); fn(); } });
    onLeave(stop);
  }

  /* ================= níveis e registros ================= */
  function lvOf(id) {
    const v = levels[id];
    return (v && typeof v === 'object')
      ? { lv: clamp(+v.lv || 1, 1, 3), good: +v.good || 0, bad: +v.bad || 0 }
      : { lv: 1, good: 0, bad: 0 };
  }
  function adapt(id, c, e) {
    const tot = c + e; if (!tot) return;
    const s = lvOf(id), acc = c / tot;
    if (acc >= 0.85) { s.good++; s.bad = 0; if (s.good >= 2 && s.lv < 3) { s.lv++; s.good = 0; } }
    else if (acc < 0.5) { s.bad++; s.good = 0; if (s.bad >= 2 && s.lv > 1) { s.lv--; s.bad = 0; } }
    else { s.good = 0; s.bad = 0; }
    levels[id] = s; store.set('levels', levels);
  }
  const missionsToday = () => log.filter(x => x.d === localDate() && x.m !== 'calma');
  function pushLog(entry) {
    log.push(entry);
    if (log.length > 5000) log = log.slice(-5000);
    store.set('log', log);
  }
  function weekDates(d = new Date()) {
    const wd = (d.getDay() + 6) % 7; // segunda = 0
    return Array.from({ length: 7 }, (_, i) => localDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd + i)));
  }

  /* ================= missões ================= */
  const MISSIONS = {};
  const GROUPS = [['letras', 'mestre'], ['nome', 'numeros', 'nome', 'contar'], ['memoria', 'sequencia']];
  function todays() {
    const dn = dayNumber();
    return [GROUPS[0][dn % 2], GROUPS[1][dn % 4], GROUPS[2][Math.floor(dn / 2) % 2]];
  }

  function startMission(id) {
    const m = MISSIONS[id];
    if (!m || missionsToday().length >= settings.perDay) return home();
    const level = lvOf(id).lv;
    const t0 = Date.now();
    render(() => {
      const stage = h('div', { class: 'stage' });
      const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
      const back = h('button', { class: 'icon-btn hold', type: 'button', 'aria-label': 'Voltar (segure)' }, '⬅');
      holdable(back, 900, home);
      const root = h('div', { class: 'screen mission', 'data-mission': id },
        h('div', { class: 'topbar' }, back, h('div', { class: 'mtitle' }, `${m.emoji} ${m.title}`), dots), stage);
      const stats = { correct: 0, errors: 0 };
      let finished = false, lastN = 0;
      const ctx = {
        level, stage, say, timeout,
        progress(i, n) {
          lastN = n;
          dots.replaceChildren(...Array.from({ length: n }, (_, k) => h('span', { class: 'dot' + (k < i ? ' on' : '') })));
        },
        ok() { stats.correct++; sfx.ok(); },
        bad() { stats.errors++; sfx.bad(); },
        finish() {
          if (finished) return; finished = true;
          if (lastN) ctx.progress(lastN, lastN);
          timeout(() => endMission(m, stats, Math.round((Date.now() - t0) / 1000)), 700);
        }
      };
      m.run(ctx);
      return root;
    });
  }

  function endMission(m, stats, secs) {
    const now = new Date();
    pushLog({ d: localDate(now), t: localTime(now), m: m.id, lv: lvOf(m.id).lv, c: stats.correct, e: stats.errors, s: secs });
    adapt(m.id, stats.correct, stats.errors);
    celebrate();
  }

  function celebrate() {
    const left = settings.perDay - missionsToday().length;
    render(() => {
      sfx.win();
      say(`Missão cumprida! Muito bem, ${settings.childName}!`);
      const conf = h('div', { class: 'confetti', 'aria-hidden': 'true' },
        Array.from({ length: 24 }, () => h('span', { style: { left: rand(100) + '%', animationDelay: (Math.random() * 1.5).toFixed(2) + 's', fontSize: (18 + rand(18)) + 'px' } },
          pick(['⭐', '✨', '🎉', '🎈', '🌟'], 1)[0])));
      const kids = [conf, h('div', { class: 'trophy' }, '🏆'), h('h1', null, 'Missão cumprida!')];
      if (left > 0) {
        kids.push(h('button', { class: 'big-btn next', type: 'button', onclick: () => home() }, '➡️ Outra missão'));
        kids.push(h('button', { class: 'big-btn alt rest', type: 'button', onclick: () => calma() }, '🌙 Respirar'));
      } else {
        kids.push(h('p', { class: 'bubble' }, 'Por hoje chega! Amanhã tem mais.'));
        kids.push(h('button', { class: 'big-btn alt rest', type: 'button', onclick: () => calma() }, '🌙 Respirar e dormir'));
      }
      return h('div', { class: 'screen celebrate' }, kids);
    });
  }

  /* ---------- home ---------- */
  function home() {
    render(() => {
      const done = missionsToday();
      const left = settings.perDay - done.length;
      const doneIds = new Set(done.map(x => x.m));
      const gear = h('button', { class: 'icon-btn hold', type: 'button', 'aria-label': 'Área dos pais (segure)' }, '⚙️');
      holdable(gear, 1500, parent);
      const text = left > 0 ? `Oi, ${settings.childName}! Escolhe uma missão.` : 'Missões de hoje completas! Amanhã tem mais.';
      const guide = h('button', { class: 'guide', type: 'button', onclick: () => say(text), 'aria-label': 'Ouvir o guia' },
        h('span', null, h('span', { class: 'avatar' }, settings.guideEmoji), h('span', { class: 'gname' }, settings.guideName)),
        h('span', { class: 'bubble' }, text));

      const COLORS = ['#ffd23f', '#4cc9f0', '#3ddc97'];
      const cards = todays().map((id, i) => {
        const m = MISSIONS[id], isDone = doneIds.has(id);
        const b = h('button', { class: 'card' + (isDone ? ' done' : ''), type: 'button', 'data-mission': id, style: { '--c': COLORS[i] }, disabled: left <= 0 },
          h('span', { class: 'emoji' }, m.emoji), h('span', { class: 'label' }, m.title), isDone ? h('span', null, '✅') : null);
        b.addEventListener('click', () => { sfx.tap(); startMission(id); });
        return b;
      });
      const calm = h('button', { class: 'card calm', type: 'button', onclick: () => calma() },
        h('span', { class: 'emoji' }, '🌙'), h('span', { class: 'label' }, 'Respirar e dormir'));

      const wk = weekDates(), active = new Set(log.filter(x => x.m !== 'calma').map(x => x.d)), today = localDate();
      const stars = wk.map((d, i) => h('div', { class: 'day' + (active.has(d) ? ' on' : '') + (d === today ? ' today' : '') },
        h('span', { class: 'star' }, '⭐'), h('span', { class: 'dl' }, 'STQQSSD'[i])));
      const count = wk.filter(d => active.has(d)).length;

      return h('div', { class: 'screen home' },
        h('div', { class: 'topbar' }, h('div', { class: 'club' }, settings.clubName), gear),
        guide,
        h('div', { class: 'cards' }, cards, calm),
        h('div', { class: 'week', 'aria-label': `${count} estrelas nesta semana` }, stars),
        count >= 5 ? h('div', { class: 'reward' }, '🎁 Escolha a história da noite!') : null);
    });
  }

  /* ---------- calma (respiração) ---------- */
  function calma() {
    render(() => {
      const CYCLES = 6, t0 = Date.now();
      let n = 0, ended = false;
      const circle = h('div', { class: 'breath' });
      const label = h('div', { class: 'breath-label' }, '🌬️');
      const back = h('button', { class: 'icon-btn hold', type: 'button', 'aria-label': 'Voltar (segure)' }, '⬅');
      holdable(back, 900, home);
      const stage = h('div', { class: 'stage' }, circle, label);
      const root = h('div', { class: 'screen calm-screen' }, h('div', { class: 'topbar' }, back), stage);

      function inhale() {
        if (n >= CYCLES) return end();
        circle.style.setProperty('--dur', '4s'); circle.classList.add('in');
        label.textContent = '👃 Enche a barriga';
        if (n < 2) say('Enche a barriga');
        timeout(exhale, 4000);
      }
      function exhale() {
        circle.style.setProperty('--dur', '6s'); circle.classList.remove('in');
        label.textContent = '😮‍💨 Solta o ar devagar';
        if (n < 2) say('Solta o ar devagar');
        n++;
        timeout(inhale, 6000);
      }
      function end() {
        if (ended) return; ended = true;
        const d = new Date();
        pushLog({ d: localDate(d), t: localTime(d), m: 'calma', lv: 0, c: 1, e: 0, s: Math.round((Date.now() - t0) / 1000) });
        label.textContent = '🌙 Boa noite!';
        say('Boa noite!');
        stage.append(h('button', { class: 'big-btn alt', type: 'button', onclick: () => home() }, 'Fechar'));
      }
      timeout(inhale, 600);
      return root;
    });
  }

  /* ================= mini-jogos ================= */
  const EMO = ['⚽', '🚀', '🐶', '🦖', '🍎', '🌙', '⭐', '🚗', '🐸', '🍌', '🎈', '🦁', '🐙', '🌈'];

  /* ---------- 1. caça-letras (atenção) ---------- */
  MISSIONS.letras = {
    id: 'letras', emoji: '🔎', title: 'Caça-letras',
    run(c) {
      const L = c.level, rounds = 4;
      const cfg = [null, { cols: 3, cells: 9, t: 2 }, { cols: 3, cells: 12, t: 3 }, { cols: 4, cells: 16, t: 4 }][L];
      const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const CONF = { B: 'DPR', D: 'BOP', P: 'BRF', Q: 'OGP', M: 'NW', N: 'MZH', W: 'MV', E: 'FL', F: 'EP', O: 'QCD', A: 'VH', S: 'ZC', V: 'UW', U: 'VO', L: 'IT', T: 'IL', R: 'BP', G: 'CQ', C: 'GO', H: 'NA' };
      const TARGETS = Object.keys(CONF);
      let last = '';
      const other = T => { let x; do { x = ALPHA[rand(ALPHA.length)]; } while (x === T); return x; };

      function round(i) {
        if (i >= rounds) return c.finish();
        c.progress(i, rounds);
        let T; do { T = TARGETS[rand(TARGETS.length)]; } while (T === last);
        last = T;
        const conf = (L >= 2 ? CONF[T] : '').split('').filter(Boolean);
        const p = L === 2 ? 0.5 : 0.85;
        const dis = Array.from({ length: cfg.cells - cfg.t }, () => (conf.length && Math.random() < p) ? conf[rand(conf.length)] : other(T));
        const cells = shuffle([...Array(cfg.t).fill(T), ...dis]);
        let found = 0;
        const btns = cells.map(ch => {
          const b = h('button', { class: 'cell', type: 'button', 'aria-label': 'Letra ' + ch }, ch);
          b.addEventListener('click', () => {
            if (b.disabled) return;
            if (ch === T) {
              b.disabled = true; b.classList.add('right'); c.ok(); found++;
              if (found === cfg.t) c.timeout(() => round(i + 1), 700);
            } else { c.bad(); shake(b); }
          });
          return b;
        });
        c.stage.replaceChildren(
          h('button', { class: 'prompt', type: 'button', onclick: () => c.say(`Ache a letra ${T}`) }, '🔊', h('span', { class: 'big-letter' }, T)),
          h('div', { class: 'grid', style: { '--cols': cfg.cols } }, btns));
        c.say(`Ache todas as letras ${T}`);
      }
      round(0);
    }
  };

  /* ---------- 2. memória (pares) ---------- */
  MISSIONS.memoria = {
    id: 'memoria', emoji: '🃏', title: 'Memória',
    run(c) {
      const n = [0, 3, 4, 6][c.level], cols = n === 3 ? 3 : 4;
      const faces = pick(EMO, n);
      const deck = shuffle([...faces, ...faces]).map((f, i) => ({ f, i, up: false, done: false, seen: false, el: null }));
      let first = null, lock = false, matched = 0;
      c.progress(0, n);
      const paint = d => {
        d.el.textContent = (d.up || d.done) ? d.f : '❓';
        d.el.classList.toggle('up', d.up && !d.done);
        d.el.classList.toggle('done', d.done);
      };
      function flip(d) {
        if (lock || d.up || d.done) return;
        d.up = true; paint(d); sfx.tap();
        const wasSeen = d.seen; d.seen = true;
        if (!first) { first = { d, wasSeen }; return; }
        const a = first; first = null;
        if (a.d.f === d.f) {
          a.d.done = true; d.done = true; paint(a.d); paint(d);
          matched++; c.ok(); c.progress(matched, n);
          if (matched === n) c.finish();
        } else {
          lock = true;
          // só conta erro se alguma das cartas já tinha sido vista (falha de memória, não exploração)
          if (a.wasSeen || wasSeen) c.bad(); else tone(300, .15, 'sine', .1);
          c.timeout(() => { a.d.up = false; d.up = false; paint(a.d); paint(d); lock = false; }, 900);
        }
      }
      deck.forEach(d => {
        d.el = h('button', { class: 'cell mem', type: 'button', 'aria-label': 'Carta' }, '❓');
        d.el.addEventListener('click', () => flip(d));
      });
      c.stage.replaceChildren(h('div', { class: 'grid', style: { '--cols': cols } }, deck.map(d => d.el)));
      c.say('Ache os pares iguais');
    }
  };

  /* ---------- peças em ordem (nome e números) ---------- */
  function sequenceBoard(c, seq, opts, onDone) {
    const strSeq = seq.map(String);
    const slots = strSeq.map(s => h('div', { class: 'slot' + (opts.ghost ? ' ghost' : '') }, opts.ghost ? s : ''));
    let order = shuffle(strSeq), tries = 0;
    while (strSeq.length > 1 && order.every((s, k) => s === strSeq[k]) && tries++ < 20) order = shuffle(order);
    let pos = 0, errs = 0, done = false;
    const tiles = order.map(s => {
      const b = h('button', { class: 'tile', type: 'button' }, s);
      b.addEventListener('click', () => {
        if (b.disabled || done) return;
        if (s === strSeq[pos]) {
          b.disabled = true; b.classList.add('used');
          slots[pos].textContent = s; slots[pos].classList.add('filled');
          pos++; c.ok();
          if (pos === strSeq.length) { done = true; onDone(); }
        } else {
          errs++; c.bad(); shake(b);
          if (errs % 3 === 0) {
            const t = tiles.find((x, k) => !x.disabled && order[k] === strSeq[pos]);
            if (t) { t.classList.add('hint'); c.timeout(() => t.classList.remove('hint'), 1500); }
          }
        }
      });
      return b;
    });
    c.stage.replaceChildren(
      h('button', { class: 'prompt', type: 'button', onclick: () => c.say(opts.say) }, '🔊', h('span', { class: 'icon-big' }, opts.icon)),
      h('div', { class: 'slots' }, slots),
      h('div', { class: 'tiles' }, tiles));
    c.say(opts.say);
  }

  function nameLetters() {
    const s = String(settings.childName || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10);
    return s.length >= 2 ? s : 'BENTO';
  }

  /* ---------- 3. meu nome (escrita em ordem) ---------- */
  MISSIONS.nome = {
    id: 'nome', emoji: '✏️', title: 'Meu nome',
    run(c) {
      const L = c.level, name = nameLetters();
      const SHORT = ['GOL', 'SOL', 'LUA', 'UVA', 'PAI', 'REI', 'BOI'];
      const LONG = ['BOLA', 'PATO', 'GATO', 'CASA', 'FOCA', 'DEDO', 'AMIGO', 'BANANA'];
      const IMG = { GOL: '🥅', SOL: '☀️', LUA: '🌙', UVA: '🍇', PAI: '👨', REI: '👑', BOI: '🐂', BOLA: '⚽', PATO: '🦆', GATO: '🐱', CASA: '🏠', FOCA: '🦭', DEDO: '☝️', AMIGO: '🤝', BANANA: '🍌' };
      const words = [name, ...pick(L === 1 ? SHORT : LONG, 2)];
      function round(i) {
        if (i >= words.length) return c.finish();
        c.progress(i, words.length);
        const w = words[i];
        sequenceBoard(c, w.split(''), {
          ghost: L < 3,
          icon: i === 0 ? settings.guideEmoji : (IMG[w] || '🔤'),
          say: i === 0 ? `Monte o nome ${settings.childName}` : `Monte a palavra ${w.toLowerCase()}`
        }, () => c.timeout(() => round(i + 1), 900));
      }
      round(0);
    }
  };

  /* ---------- 4. números em fila ---------- */
  MISSIONS.numeros = {
    id: 'numeros', emoji: '🔢', title: 'Números em fila',
    run(c) {
      const L = c.level;
      const rng = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
      const rounds = [null,
        [rng(1, 4), rng(1, 5), rng(1, 5)],
        [rng(1, 6), rng(1, 8), rng(4, 9)],
        [rng(1, 10), rng(1, 5).reverse(), rng(1, 8).reverse()]][L];
      function round(i) {
        if (i >= rounds.length) return c.finish();
        c.progress(i, rounds.length);
        const seq = rounds[i], desc = seq[0] > seq[seq.length - 1];
        sequenceBoard(c, seq, {
          ghost: L === 1,
          icon: desc ? '🚀' : '🔢',
          say: desc ? 'Contagem regressiva! Do maior para o menor' : 'Toque os números em ordem'
        }, () => c.timeout(() => round(i + 1), 900));
      }
      round(0);
    }
  };

  /* ---------- 5. conta as bolas ---------- */
  MISSIONS.contar = {
    id: 'contar', emoji: '⚽', title: 'Conta as bolas',
    run(c) {
      const [lo, hi] = [null, [1, 5], [3, 8], [5, 12]][c.level], rounds = 5;
      const ITEM = ['⚽', '🚀', '⭐', '🍎', '🐶', '🌙'];
      let last = 0;
      function round(i) {
        if (i >= rounds) return c.finish();
        c.progress(i, rounds);
        let n; do { n = lo + rand(hi - lo + 1); } while (n === last && hi > lo);
        last = n;
        const emo = pick(ITEM, 1)[0];
        let counted = 0, solved = false;
        const items = Array.from({ length: n }, () => {
          const b = h('button', { class: 'item', type: 'button', style: { transform: `rotate(${rand(21) - 10}deg)` } }, emo);
          b.addEventListener('click', () => {
            if (b.dataset.c || solved) return;
            counted++; b.dataset.c = String(counted);
            b.append(h('span', { class: 'num' }, counted));
            c.say(String(counted)); sfx.tap();
          });
          return b;
        });
        const opts = new Set([n]);
        let guard = 0;
        while (opts.size < 3 && guard++ < 60) opts.add(clamp(n + rand(5) - 2, 1, hi + 2));
        for (let v = 1; opts.size < 3; v++) opts.add(v);
        const answers = shuffle([...opts]).map(v => {
          const b = h('button', { class: 'ans', type: 'button' }, String(v));
          b.addEventListener('click', () => {
            if (solved) return;
            if (v === n) {
              solved = true; c.ok(); b.classList.add('right');
              c.say(`${n}! Isso mesmo!`);
              c.timeout(() => round(i + 1), 1100);
            } else { c.bad(); b.disabled = true; shake(b); }
          });
          return b;
        });
        c.stage.replaceChildren(
          h('button', { class: 'prompt', type: 'button', onclick: () => c.say('Conta e escolhe: quantos tem?') }, '🔊', h('span', { class: 'icon-big' }, '❓')),
          h('div', { class: 'field' }, items),
          h('div', { class: 'answers' }, answers));
        c.say('Conta e escolhe: quantos tem?');
      }
      round(0);
    }
  };

  /* ---------- 6. seu mestre mandou (controle inibitório) ---------- */
  MISSIONS.mestre = {
    id: 'mestre', emoji: '🚦', title: 'Seu mestre mandou',
    run(c) {
      const L = c.level;
      const rounds = [0, 6, 8, 10][L], waitMs = [0, 3500, 3000, 2500][L];
      const noGo = Math.max(1, Math.round(rounds * [0, 0.25, 0.33, 0.4][L]));
      const plan = Array(rounds).fill(true);
      pick(Array.from({ length: rounds - 1 }, (_, k) => k + 1), noGo).forEach(i => { plan[i] = false; });
      const ITEMS = [['⚽', 'na bola'], ['🚀', 'no foguete'], ['⭐', 'na estrela'], ['🍎', 'na maçã'], ['🐶', 'no cachorro'], ['🦖', 'no dinossauro']];

      function round(i) {
        if (i >= rounds) return c.finish();
        c.progress(i, rounds);
        const go = plan[i], [emo, phrase] = pick(ITEMS, 1)[0];
        let settled = false;
        const banner = h('div', { class: 'banner ' + (go ? 'go' : 'stop') }, go ? '✅ O mestre mandou!' : '✋ O mestre NÃO mandou!');
        const target = h('button', { class: 'target', type: 'button', 'aria-label': 'Figura' }, emo);
        const bar = go ? null : h('div', { class: 'wait', style: { '--w': waitMs + 'ms' } });
        c.stage.replaceChildren(...[banner, target, bar].filter(Boolean));
        c.say(go ? `O mestre mandou! Toque ${phrase}!` : 'O mestre não mandou! Fique paradinho!');
        target.addEventListener('click', () => {
          if (settled) return; settled = true;
          if (go) { c.ok(); target.classList.add('pop'); c.timeout(() => round(i + 1), 700); }
          else { c.bad(); shake(target); c.timeout(() => round(i + 1), 900); }
        });
        if (!go) {
          c.timeout(() => {
            if (settled) return; settled = true;
            c.ok(); target.classList.add('pop');
            c.timeout(() => round(i + 1), 600);
          }, waitMs);
        }
      }
      round(0);
    }
  };

  /* ---------- 7. luzes mágicas (sequência) ---------- */
  MISSIONS.sequencia = {
    id: 'sequencia', emoji: '💡', title: 'Luzes mágicas',
    run(c) {
      const base = [0, 2, 3, 4][c.level], lens = [base, base, base + 1];
      const FREQ = [262, 330, 392, 523];
      let seq = [], pos = 0, inputOn = false, attempts = 0, ri = 0;
      const status = h('div', { class: 'status' }, '👀');
      const pads = FREQ.map((f, k) => {
        const b = h('button', { class: 'pad p' + k, type: 'button', 'aria-label': 'Luz ' + (k + 1) });
        b.addEventListener('click', () => press(k));
        return b;
      });
      c.stage.replaceChildren(status, h('div', { class: 'pads' }, pads));
      function light(k, ms = 420) {
        pads[k].classList.add('lit'); tone(FREQ[k], ms / 1000, 'triangle', 0.2);
        c.timeout(() => pads[k].classList.remove('lit'), ms);
      }
      function play() {
        inputOn = false; pos = 0; status.textContent = '👀';
        seq.forEach((k, idx) => c.timeout(() => light(k), 800 + idx * 700));
        c.timeout(() => { inputOn = true; status.textContent = '👆'; }, 800 + seq.length * 700);
      }
      function nextRound() {
        if (ri >= lens.length) return c.finish();
        c.progress(ri, lens.length);
        seq = Array.from({ length: lens[ri] }, () => rand(4));
        ri++; attempts = 0;
        c.say('Olha as luzes e repete!');
        play();
      }
      function press(k) {
        if (!inputOn) return;
        light(k, 250);
        if (k === seq[pos]) {
          c.ok(); pos++;
          if (pos === seq.length) { inputOn = false; status.textContent = '🌟'; c.timeout(nextRound, 900); }
        } else {
          c.bad(); inputOn = false; attempts++; status.textContent = '🙈';
          if (attempts < 2) { c.say('Olha de novo!'); c.timeout(play, 1000); }
          else c.timeout(nextRound, 1000);
        }
      }
      nextRound();
    }
  };

  /* ================= área dos pais ================= */
  function dayStats(d) {
    const L = log.filter(x => x.d === d && x.m !== 'calma');
    const c = L.reduce((s, x) => s + x.c, 0), e = L.reduce((s, x) => s + x.e, 0);
    return Object.assign({
      n: L.length,
      acc: (c + e) ? Math.round(100 * c / (c + e)) : null,
      calma: log.filter(x => x.d === d && x.m === 'calma').length
    }, days[d] || {});
  }
  function csvCell(v) {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmula ao abrir na planilha
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const toCsv = rows => rows.map(r => r.map(csvCell).join(';')).join('\r\n');
  function csvMissions() {
    return toCsv([['data', 'hora', 'missao', 'nivel', 'acertos', 'erros', 'duracao_s'], ...log.map(x => [x.d, x.t, x.m, x.lv, x.c, x.e, x.s])]);
  }
  function csvDays() {
    const all = Array.from(new Set([...Object.keys(days), ...log.map(x => x.d)])).sort();
    return toCsv([['data', 'dormiu', 'tela_min', 'atencao_1a5', 'humor_1a5', 'missoes', 'acerto_pct', 'respiracoes', 'obs'],
      ...all.map(d => { const s = dayStats(d); return [d, s.sleep || '', s.screen == null ? '' : s.screen, s.att == null ? '' : s.att, s.mood == null ? '' : s.mood, s.n, s.acc == null ? '' : s.acc, s.calma, s.note || '']; })]);
  }
  function showText(title, text) {
    const ta = h('textarea', { class: 'inp area', readonly: true, rows: 10 });
    ta.value = text;
    const ov = h('div', { class: 'overlay' }, h('div', { class: 'sheet' }, h('h3', null, title), ta,
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(text); toast('Copiado ✔'); } catch (e) { ta.select(); toast('Selecione e copie'); } } }, 'Copiar'),
        h('button', { class: 'btn alt', type: 'button', onclick: () => ov.remove() }, 'Fechar'))));
    document.body.append(ov);
  }
  function exportCsv(name, text) {
    try {
      const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) { showText(name, text); }
  }

  function parent() {
    render(() => {
      let guideSel = settings.guideEmoji;
      const lab = (t, el) => h('label', { class: 'field' }, h('span', null, t), el);
      const inp = p => h('input', Object.assign({ class: 'inp' }, p));
      const sel = (opts, cur) => h('select', { class: 'inp' }, opts.map(([v, t]) => h('option', { value: v, selected: String(v) === String(cur) }, t)));

      const fName = inp({ type: 'text', maxlength: 14, value: settings.childName });
      const fGuide = inp({ type: 'text', maxlength: 20, value: settings.guideName });
      const fClub = inp({ type: 'text', maxlength: 24, value: settings.clubName });
      const fPer = inp({ type: 'number', min: 1, max: 5, inputmode: 'numeric', value: settings.perDay });
      const fVoice = inp({ type: 'checkbox', checked: settings.voice });
      const fSound = inp({ type: 'checkbox', checked: settings.sound });
      const avatarBtns = GUIDES.map(g => {
        const b = h('button', { class: 'av' + (g === guideSel ? ' on' : ''), type: 'button', 'aria-label': 'Guia ' + g }, g);
        b.addEventListener('click', () => { guideSel = g; avatarBtns.forEach(x => x.classList.toggle('on', x === b)); });
        return b;
      });
      const lvSel = {};
      Object.values(MISSIONS).forEach(m => { lvSel[m.id] = sel([[1, 'Nível 1'], [2, 'Nível 2'], [3, 'Nível 3']], lvOf(m.id).lv); });

      function saveSettings() {
        settings = Object.assign({}, settings, {
          childName: fName.value.trim() || DEFAULTS.childName,
          guideName: fGuide.value.trim() || DEFAULTS.guideName,
          clubName: fClub.value.trim() || DEFAULTS.clubName,
          guideEmoji: guideSel,
          perDay: clamp(parseInt(fPer.value, 10) || DEFAULTS.perDay, 1, 5),
          voice: fVoice.checked, sound: fSound.checked
        });
        store.set('settings', settings);
        Object.values(MISSIONS).forEach(m => {
          const v = clamp(parseInt(lvSel[m.id].value, 10) || 1, 1, 3);
          if (v !== lvOf(m.id).lv) levels[m.id] = { lv: v, good: 0, bad: 0 };
        });
        store.set('levels', levels);
        toast('Salvo ✔');
      }

      // registro do dia
      const fDate = inp({ type: 'date', value: localDate(), max: localDate() });
      const fSleep = inp({ type: 'time' });
      const fScreen = inp({ type: 'number', min: 0, max: 1440, inputmode: 'numeric' });
      const fAtt = sel([['', '—'], 1, 2, 3, 4, 5].map(x => Array.isArray(x) ? x : [x, String(x)]), '');
      const fMood = sel([['', '—'], 1, 2, 3, 4, 5].map(x => Array.isArray(x) ? x : [x, String(x)]), '');
      const fNote = inp({ type: 'text', maxlength: 200 });
      function loadDay() {
        const d = days[fDate.value] || {};
        fSleep.value = d.sleep || '';
        fScreen.value = d.screen == null ? '' : d.screen;
        fAtt.value = d.att == null ? '' : d.att;
        fMood.value = d.mood == null ? '' : d.mood;
        fNote.value = d.note || '';
      }
      fDate.addEventListener('change', loadDay);
      loadDay();
      function saveDay() {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fDate.value)) return toast('Escolha uma data');
        days[fDate.value] = {
          sleep: fSleep.value || '',
          screen: fScreen.value === '' ? null : clamp(parseInt(fScreen.value, 10) || 0, 0, 1440),
          att: fAtt.value ? +fAtt.value : null,
          mood: fMood.value ? +fMood.value : null,
          note: fNote.value.slice(0, 200)
        };
        store.set('days', days);
        toast('Dia salvo ✔');
        parent();
      }

      // resumo 7 dias
      const rows = Array.from({ length: 7 }, (_, i) => {
        const x = new Date(); x.setDate(x.getDate() - i);
        const d = localDate(x), s = dayStats(d);
        return h('tr', null,
          h('td', null, `${d.slice(8, 10)}/${d.slice(5, 7)}`), h('td', null, s.n), h('td', null, s.acc == null ? '–' : s.acc + '%'),
          h('td', null, s.sleep || '–'), h('td', null, s.screen == null ? '–' : s.screen), h('td', null, s.att == null ? '–' : s.att));
      });

      const wipe = () => {
        if (!confirm('Apagar TODOS os dados deste aparelho (histórico, níveis e registros)?')) return;
        log = []; days = {}; levels = {};
        store.set('log', log); store.set('days', days); store.set('levels', levels);
        toast('Dados apagados'); parent();
      };

      return h('div', { class: 'screen parent' },
        h('div', { class: 'topbar' }, h('button', { class: 'btn alt', type: 'button', onclick: () => home() }, '⬅ Voltar'), h('div', { class: 'mtitle' }, 'Área dos pais')),
        h('h2', null, 'Configurações'),
        lab('Nome da criança', fName), lab('Nome do guia', fGuide), lab('Nome do clube', fClub),
        h('div', { class: 'row' }, avatarBtns),
        lab('Missões por dia (1 a 5)', fPer),
        h('div', { class: 'checks' }, h('label', null, fVoice, 'Voz'), h('label', null, fSound, 'Sons')),
        h('h2', null, 'Níveis (ajuste manual)'),
        Object.values(MISSIONS).map(m => lab(`${m.emoji} ${m.title}`, lvSel[m.id])),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: saveSettings }, 'Salvar configurações')),
        h('h2', null, 'Registro da noite'),
        h('p', { class: 'note' }, 'Use a data da NOITE em que ele foi dormir. Preencha na manhã seguinte.'),
        lab('Data', fDate), lab('Dormiu às', fSleep), lab('Tela no dia (minutos)', fScreen),
        lab('Atenção hoje (1 a 5)', fAtt), lab('Humor / agitação (1 a 5)', fMood), lab('Observação', fNote),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: saveDay }, 'Salvar dia')),
        h('h2', null, 'Últimos 7 dias'),
        h('table', null, h('thead', null, h('tr', null, ['Dia', 'Miss.', 'Acerto', 'Dormiu', 'Tela', 'Aten.'].map(t => h('th', null, t)))), h('tbody', null, rows)),
        h('h2', null, 'Planilha'),
        h('p', { class: 'note' }, 'CSV com ";" e acentos (abre direto no Excel/Google Planilhas em português). Faça backup toda semana: os dados ficam só neste aparelho.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn alt', type: 'button', onclick: () => exportCsv('missoes.csv', csvMissions()) }, 'Baixar missões'),
          h('button', { class: 'btn alt', type: 'button', onclick: () => exportCsv('dias.csv', csvDays()) }, 'Baixar dias')),
        h('h2', null, 'Zona de perigo'),
        h('div', { class: 'row' }, h('button', { class: 'btn danger', type: 'button', onclick: wipe }, 'Apagar todos os dados')));
    });
  }

  /* ================= início ================= */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline opcional */ }); });
  }
  home();
})();
