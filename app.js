(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const GOAL = 20;
  const STEP = 60; // Sekunden, die ein Bestätigungs-Code gültig ist
  const KEY = 'dont-annoy-me:v1';
  const VERSION = '1.6';

  const PRIZES = [
    { short: 'Taxi', emoji: '🚗', color: '#ff3d7f', ink: '#fff', uses: 1,
      text: 'A car ride/pick-up incl. round trip from Ada' },
    { short: '20 €', emoji: '💶', color: '#ffd23f', ink: '#2a1300', uses: 1,
      text: '20 euros cash' },
    { short: 'Kitchen', emoji: '🍳', color: '#2ee6a6', ink: '#00321f', uses: 3,
      text: 'I leave the kitchen 3 times when you’re in it, EVEN if I’m eating' },
    { short: 'Favour', emoji: '✨', color: '#7b5cff', ink: '#fff', uses: 1,
      text: 'A random favour of your choice' }
  ];

  const CHIPS = ['Just annoying 🙄', 'Barged into my room 🚪', 'Dumb jokes 💬',
    'Stole my food 🍕', 'Way too loud 🔊', 'Hogged the bathroom 🚿'];

  // ---------- Speicher ----------
  const defaults = () => ({
    role: null, secret: null, name: '', count: 0, entries: [], usedSteps: [],
    vouchers: [], rounds: 0, sound: true, welcomed: false, wheelRot: 0
  });
  // Testmodus: Der Nerver probiert die Schwester-Ansicht mit eigenem, getrenntem Speicher aus.
  const TEST_FLAG = KEY + ':testmode', TEST_KEY = KEY + ':test';
  const TEST = (() => { try { return localStorage.getItem(TEST_FLAG) === '1'; } catch { return false; } })();
  const STORE = TEST ? TEST_KEY : KEY;
  const load = () => {
    try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(STORE)) || {}); }
    catch { return defaults(); }
  };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* privat */ } };
  let S = load();

  // ---------- Geschenk-Code (Base32) ----------
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32encode(bytes) {
    let bits = 0, val = 0, out = '';
    for (const b of bytes) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function b32decode(str) {
    let bits = 0, val = 0; const out = [];
    for (const ch of str) {
      val = (val << 5) | B32.indexOf(ch); bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  const newSecret = () => b32encode(crypto.getRandomValues(new Uint8Array(5)));
  const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    .replace(/0/g, 'O').replace(/1/g, 'I').replace(/8/g, 'B');
  const validCode = (s) => /^[A-Z2-7]{8}$/.test(s);
  const fmtCode = (s) => s ? s.slice(0, 4) + '-' + s.slice(4) : '';

  // ---------- Zeitbasierter Code (TOTP, HMAC-SHA1) ----------
  // Läuft komplett offline: Beide Handys kennen das gleiche Geheimnis
  // und berechnen daraus jede Minute denselben 4-stelligen Code.
  function sha1(msg) {
    const len = msg.length;
    const buf = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    buf.set(msg); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(buf.length - 8, Math.floor(len * 8 / 2 ** 32));
    dv.setUint32(buf.length - 4, (len * 8) >>> 0);
    const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
    const w = new Uint32Array(80);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    for (let off = 0; off < buf.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        const t = (rotl(a, 5) + (f >>> 0) + e + k + w[i]) >>> 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    const out = new Uint8Array(20); const odv = new DataView(out.buffer);
    [h0, h1, h2, h3, h4].forEach((h, i) => odv.setUint32(i * 4, h));
    return out;
  }
  function hmacSha1(key, msg) {
    const k = new Uint8Array(64); k.set(key.length > 64 ? sha1(key) : key);
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(84);
    for (let i = 0; i < 64; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
    ipad.set(msg, 64);
    opad.set(sha1(ipad), 64);
    return sha1(opad);
  }
  function totp(secret, step, digits = 4) {
    const msg = new Uint8Array(8); const dv = new DataView(msg.buffer);
    dv.setUint32(0, Math.floor(step / 2 ** 32)); dv.setUint32(4, step >>> 0);
    const h = hmacSha1(typeof secret === 'string' ? b32decode(secret) : secret, msg);
    const o = h[19] & 15;
    const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(bin % 10 ** digits).padStart(digits, '0');
  }
  const nowStep = () => Math.floor(Date.now() / 1000 / STEP);
  window.__dam = { totp, sha1 }; // für Tests in der Konsole

  // ---------- Sound ----------
  let actx = null;
  function audio() {
    if (!S.sound) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function honkAt(c, t, dur) {
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    out.gain.setValueAtTime(0.4, t + dur - 0.05);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 3;
    lp.connect(out); out.connect(c.destination);
    [370, 466, 740].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = i === 2 ? 'square' : 'sawtooth';
      g.gain.value = i === 2 ? 0.15 : 0.5;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.97, t + dur);
      o.connect(g); g.connect(lp);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function horn() {
    const c = audio(); if (!c) return;
    const t = c.currentTime + 0.01;
    honkAt(c, t, 0.17);
    honkAt(c, t + 0.24, 0.55);
  }
  function tick() {
    const c = audio(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 1400;
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.05);
  }
  function fanfare() {
    const c = audio(); if (!c) return;
    const t0 = c.currentTime + 0.02;
    [[523, 0, .14], [659, .14, .14], [784, .28, .14], [1047, .42, .5], [784, .62, .12], [1047, .74, .7]]
      .forEach(([f, s, d]) => {
        const o = c.createOscillator(), g = c.createGain(), t = t0 + s;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
      });
  }
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* egal */ } };

  // ---------- Smileys ----------
  function faceSVG(kind) {
    const fill = { happy: '#ffd23f', neutral: '#ff9f1c', angry: '#ff4b3e' }[kind];
    const ink = '#2a0b2a';
    const parts = {
      happy: `<path d="M27 43 Q35 33 43 43" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
              <path d="M57 43 Q65 33 73 43" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
              <ellipse cx="24" cy="58" rx="7" ry="4.5" fill="#ff6b9a" opacity=".6"/>
              <ellipse cx="76" cy="58" rx="7" ry="4.5" fill="#ff6b9a" opacity=".6"/>
              <path d="M28 57 Q50 88 72 57 Z" fill="${ink}"/>
              <path d="M39 70 Q50 78 61 70 Q55 81 50 81 Q45 81 39 70Z" fill="#ff6b6b"/>`,
      neutral: `<circle cx="36" cy="44" r="6" fill="${ink}"/><circle cx="64" cy="44" r="6" fill="${ink}"/>
                <path d="M30 32 L42 31 M58 31 L70 32" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
                <path d="M33 68 L67 68" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`,
      angry: `<path d="M23 31 L44 41 M77 31 L56 41" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>
              <circle cx="36" cy="50" r="6" fill="${ink}"/><circle cx="64" cy="50" r="6" fill="${ink}"/>
              <path d="M33 75 Q50 60 67 75" fill="none" stroke="${ink}" stroke-width="6.5" stroke-linecap="round"/>
              <path d="M10 14 q4 -6 0 -12 M90 14 q-4 -6 0 -12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>`
    }[kind];
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="50" cy="55" r="44" fill="rgba(0,0,0,.25)"/>
      <circle cx="50" cy="52" r="44" fill="${fill}"/>
      <ellipse cx="36" cy="22" rx="14" ry="6" fill="#fff" opacity=".25"/>${parts}</svg>`;
  }
  const moodOf = (n) => n <= 8 ? 'happy' : n <= 14 ? 'neutral' : 'angry';
  const MOOD_TEXT = { happy: 'All chill so far', neutral: 'Getting fed up …', angry: 'ABOUT TO EXPLODE!' };
  const segColor = (i) => `hsl(${Math.round(150 - i * 150 / (GOAL - 1))} 88% 58%)`;

  // ---------- Toast & Konfetti ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const cv = $('#confetti'), cx2 = cv.getContext('2d');
  let parts = [], raf = 0;
  function confetti(n = 140) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    cx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#ff3d7f', '#ffd23f', '#2ee6a6', '#7b5cff', '#ff9f1c', '#fff'];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - .5) * 80, y: innerHeight * .35,
        vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
        s: 6 + Math.random() * 6, c: cols[i % cols.length],
        r: Math.random() * 6, vr: (Math.random() - .5) * .4
      });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step() {
    cx2.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.y < innerHeight + 30);
    for (const p of parts) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      cx2.save(); cx2.translate(p.x, p.y); cx2.rotate(p.r);
      cx2.fillStyle = p.c; cx2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      cx2.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : 0;
  }

  // ---------- Plattform ----------
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function updateBadge() {
    if (TEST || S.role !== 'sister' || !('setAppBadge' in navigator)) return;
    const p = S.count > 0 ? navigator.setAppBadge(S.count) : navigator.clearAppBadge();
    if (p && p.catch) p.catch(() => {});
  }

  // ---------- Ansichten ----------
  let codeTimer = 0;
  function show(name) {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    window.scrollTo(0, 0);
    clearInterval(codeTimer);
    if (name === 'sister') renderSister();
    if (name === 'brother') { renderCode(); codeTimer = setInterval(renderCode, 1000); }
    if (name === 'birthday') renderBirthday();
  }

  function route() {
    const m = location.hash.match(/gift=([A-Za-z2-7]{8})/);
    if (m) {
      const n = location.hash.match(/[&#]n=([^&]*)/);
      history.replaceState(null, '', location.pathname + location.search);
      if (!S.role) {
        S.role = 'sister'; S.secret = m[1].toUpperCase();
        S.name = n ? decodeURIComponent(n[1]).slice(0, 24) : '';
        save();
        return show('birthday');
      }
      if (S.secret !== m[1].toUpperCase()) toast('This app is already set up with a different code.');
    }
    if (!S.role) return show('start');
    if (S.role === 'brother') return show('brother');
    show(S.welcomed ? 'sister' : 'birthday');
  }

  // Start
  $('.logo-face').innerHTML = faceSVG('angry');
  $('#choose-sister').onclick = () => show('pair');
  $('#choose-brother').onclick = () => {
    $('#gift-create').hidden = false; $('#gift-existing').hidden = true; $('#gift-result').hidden = true;
    show('gift');
  };
  document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => show(b.dataset.back); });

  // Bruder: Geschenk einrichten
  const giftLink = () => location.origin + location.pathname + '#gift=' + S.secret +
    (S.name ? '&n=' + encodeURIComponent(S.name) : '');
  const giftText = () => `Happy Birthday${S.name ? ' ' + S.name : ''}! 🎉 Your gift: the app “Dont annoy me!”. ` +
    `Open the link and install it. Your code: ${fmtCode(S.secret)}`;
  async function shareGift() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Dont annoy me!', text: giftText(), url: giftLink() }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copyGift();
  }
  async function copyGift() {
    const txt = giftText() + '\n' + giftLink();
    try { await navigator.clipboard.writeText(txt); toast('Link copied – paste it into the chat!'); }
    catch { window.prompt('Copy this text:', txt); }
  }
  $('#gift-generate').onclick = () => {
    S.role = 'brother'; S.secret = newSecret(); S.name = $('#gift-name').value.trim(); save();
    $('#gift-code').textContent = fmtCode(S.secret);
    $('#gift-create').hidden = true; $('#gift-result').hidden = false;
  };
  $('#gift-have-code').onclick = () => { $('#gift-create').hidden = true; $('#gift-existing').hidden = false; };
  $('#gift-code-ok').onclick = () => {
    const c = cleanCode($('#gift-code-input').value);
    if (!validCode(c)) return toast('The code has 8 characters, e.g. ABCD-EFGH');
    S.role = 'brother'; S.secret = c; save(); show('brother');
  };
  $('#gift-share').onclick = shareGift;
  $('#gift-copy').onclick = copyGift;
  $('#gift-done').onclick = () => show('brother');

  // Schwester: Code eingeben
  $('#pair-ok').onclick = () => {
    const c = cleanCode($('#pair-code').value);
    if (!validCode(c)) { $('#pair-code').classList.add('shake-x'); setTimeout(() => $('#pair-code').classList.remove('shake-x'), 400); return toast('The code has 8 characters, e.g. ABCD-EFGH'); }
    S.role = 'sister'; S.secret = c; S.name = $('#pair-name').value.trim() || S.name; save();
    show('birthday');
  };

  // Geburtstag
  function renderBirthday() {
    $('#bday-title').textContent = `Happy Birthday${S.name ? ', ' + S.name : ''}!`;
    $('#bday-ios-hint').hidden = !(isIOS && !isStandalone());
    $('#bday-code').textContent = fmtCode(S.secret);
    setTimeout(() => confetti(160), 250);
  }
  $('#bday-go').onclick = () => { S.welcomed = true; save(); horn(); show('sister'); };

  // ---------- Schwester: Hauptansicht ----------
  const segBox = $('#segments');
  for (let i = 0; i < GOAL; i++) segBox.appendChild(Object.assign(document.createElement('div'), { className: 'seg' }));
  const fmtTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderSister(justAdded = false) {
    const n = Math.min(S.count, GOAL);
    const countEl = $('#count');
    countEl.textContent = n;
    if (justAdded) { countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump'); }
    [...segBox.children].forEach((seg, i) => {
      const on = i < n;
      seg.classList.toggle('on', on);
      seg.style.background = on ? segColor(i) : '';
      seg.classList.toggle('new', justAdded && i === n - 1);
    });
    const mood = moodOf(n);
    const face = $('#mood-face');
    if (face.dataset.mood !== mood) { face.innerHTML = faceSVG(mood); face.dataset.mood = mood; }
    face.className = 'mood-face ' + mood;
    $('#mood-text').textContent = n >= GOAL ? 'Prize wheel unlocked!' : MOOD_TEXT[mood];

    const full = n >= GOAL;
    $('#nerv-btn').hidden = full;
    $('#wheel-cta').hidden = !full;
    $('#press-hint').hidden = full;
    $('#left').textContent = GOAL - n;

    // Gutscheine
    const vs = $('#vouchers');
    $('#vouchers-section').hidden = !S.vouchers.length;
    vs.innerHTML = S.vouchers.map((v) => {
      const p = PRIZES[v.p];
      const used = v.left <= 0;
      const extra = p.uses > 1 && !used ? ` · ${v.left}× left` : used ? ' · redeemed' : '';
      return `<div class="voucher${used ? ' used' : ''}">
        <span class="voucher-emoji">${p.emoji}</span>
        <div class="voucher-body"><b>${esc(p.text)}</b><small>Won on ${fmtTime.format(v.t)}${extra}</small></div>
        ${used ? '' : `<button class="btn" data-redeem="${v.id}">Redeem</button>`}
      </div>`;
    }).join('');

    // Protokoll
    const log = $('#log');
    log.innerHTML = S.entries.length
      ? S.entries.map((e, i) => `<li><span class="log-n">#${S.entries.length - i}</span>
          <span class="log-note">${esc(e.note || 'Annoyed')}</span>
          <span class="log-time">${fmtTime.format(e.t)}</span></li>`).join('')
      : '<li class="empty">Nothing yet – he’s been good (so far). 😇</li>';
    updateBadge();
  }

  $('#vouchers').addEventListener('click', (e) => {
    const b = e.target.closest('[data-redeem]'); if (!b) return;
    const v = S.vouchers.find((x) => x.id === b.dataset.redeem); if (!v) return;
    if (!confirm(`Redeem this voucher now?\n\n“${PRIZES[v.p].text}”`)) return;
    v.left -= 1; v.redeemed = Date.now(); save(); renderSister();
    horn(); toast(v.left > 0 ? `Redeemed! ${v.left}× left.` : 'Redeemed! Enjoy 😎');
  });

  // Nerv-Knopf
  $('#nerv-btn').onclick = () => {
    horn(); buzz([60, 60, 200]);
    const b = $('#nerv-btn'); b.classList.remove('honk'); void b.offsetWidth; b.classList.add('honk');
    if (S.count >= GOAL) return;
    openEntry();
  };

  // ---------- Eintrag mit doppelter Bestätigung ----------
  let chosenChip = '';
  const chipBox = $('#chips');
  chipBox.innerHTML = CHIPS.map((c) => `<button class="chip" type="button">${c}</button>`).join('');
  chipBox.addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    const active = c.classList.contains('active');
    chipBox.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
    chosenChip = active ? '' : c.textContent;
    if (!active) c.classList.add('active');
  });

  function openEntry() {
    chosenChip = '';
    chipBox.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
    $('#entry-note').value = ''; $('#entry-code').value = ''; $('#entry-error').textContent = '';
    $('#entry-testhint').hidden = !TEST;
    if (TEST) $('#entry-testhint').textContent = `🧪 Test: your current code is ${totp(S.secret, nowStep())}`;
    $('#sheet-entry').hidden = false;
  }
  function entryError(msg) {
    const el = $('#entry-error'); el.textContent = msg;
    const inp = $('#entry-code'); inp.classList.remove('shake-x'); void inp.offsetWidth; inp.classList.add('shake-x');
    buzz(200);
  }
  $('#entry-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    $('#entry-error').textContent = '';
    if (e.target.value.length === 4) submitEntry();
  });
  $('#entry-ok').onclick = submitEntry;

  function submitEntry() {
    const code = $('#entry-code').value;
    if (code.length !== 4) return entryError('He has to give you his 4-digit code.');
    const now = nowStep();
    const hit = [0, -1, 1].map((d) => now + d).find((st) => totp(S.secret, st) === code);
    if (hit === undefined) return entryError('Wrong code – that doesn’t count! 😤');
    if (S.usedSteps.includes(hit)) return entryError('This code was already used. Wait for the next one.');
    S.usedSteps = [...S.usedSteps, hit].slice(-40);
    S.count = Math.min(GOAL, S.count + 1);
    S.entries.unshift({ t: Date.now(), note: ($('#entry-note').value.trim() || chosenChip).slice(0, 60) });
    save();
    $('#sheet-entry').hidden = true;
    renderSister(true);
    buzz(40);
    if (S.count >= GOAL) {
      confetti(220); fanfare(); toast('20 reached – the prize wheel is unlocked! 🎡');
    } else {
      confetti(50); toast(`Added! ${S.count}/${GOAL}`);
    }
  }

  // ---------- Glücksrad ----------
  const SEGS = 8;
  const wheel = $('#wheel');
  (function buildWheel() {
    const pt = (a, r) => `${(r * Math.sin(a * Math.PI / 180)).toFixed(2)} ${(-r * Math.cos(a * Math.PI / 180)).toFixed(2)}`;
    let svg = '';
    for (let i = 0; i < SEGS; i++) {
      const p = PRIZES[i % PRIZES.length], a0 = i * 45 - 22.5, a1 = a0 + 45;
      svg += `<path d="M0 0 L${pt(a0, 100)} A100 100 0 0 1 ${pt(a1, 100)} Z" fill="${p.color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
        <g transform="rotate(${i * 45})">
          <text x="0" y="-84" text-anchor="middle" dominant-baseline="middle" font-size="15">${p.emoji}</text>
          <text transform="rotate(90)" x="-74" y="0" dominant-baseline="middle" font-size="10.5" fill="${p.ink}">${esc(p.short)}</text>
        </g>`;
    }
    svg += '<circle r="98" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/>';
    for (let i = 0; i < SEGS; i++) {
      const [x, y] = pt(i * 45 + 22.5, 93).split(' ');
      svg += `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/>`;
    }
    wheel.innerHTML = svg;
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${S.wheelRot}deg)`;
  })();

  let spinning = false, lastPrize = null;
  function openWheel() {
    $('#prize-card').hidden = true;
    $('#spin-btn').disabled = false;
    $('#wheel-later').hidden = false;
    $('#wheel-overlay').hidden = false;
  }
  $('#wheel-cta').onclick = () => { fanfare(); openWheel(); };
  $('#wheel-later').onclick = () => { if (!spinning) $('#wheel-overlay').hidden = true; };

  $('#spin-btn').onclick = () => {
    if (spinning || S.count < GOAL) return;
    spinning = true;
    $('#spin-btn').disabled = true; $('#wheel-later').hidden = true;
    const seg = crypto.getRandomValues(new Uint32Array(1))[0] % SEGS;
    const prizeIdx = seg % PRIZES.length;

    // Gewinn sofort sichern – auch wenn die App während des Drehens geschlossen wird.
    const v = { id: Date.now().toString(36), p: prizeIdx, t: Date.now(), left: PRIZES[prizeIdx].uses };
    S.vouchers.unshift(v);
    S.count = 0; S.entries = []; S.rounds += 1;
    const base = S.wheelRot - (S.wheelRot % 360);
    const jitter = (Math.random() - .5) * 30;
    S.wheelRot = base + 360 * 7 + ((360 - seg * 45) % 360) + jitter;
    save(); lastPrize = prizeIdx;

    wheel.style.transition = '';
    void wheel.offsetWidth;
    wheel.style.transform = `rotate(${S.wheelRot}deg)`;

    // Klick-Geräusch bei jedem Segment
    let last = null, acc = 0, ticks = 0;
    (function watch() {
      if (!spinning) return;
      const m = new DOMMatrix(getComputedStyle(wheel).transform);
      const ang = (Math.atan2(m.b, m.a) * 180 / Math.PI + 360) % 360;
      if (last !== null) {
        acc += (ang - last + 360) % 360;
        const t = Math.floor(acc / 45);
        if (t > ticks) { ticks = t; tick(); }
      }
      last = ang;
      requestAnimationFrame(watch);
    })();
  };
  wheel.addEventListener('transitionend', () => {
    if (!spinning) return;
    spinning = false;
    const p = PRIZES[lastPrize];
    $('#prize-emoji').textContent = p.emoji;
    $('#prize-text').textContent = p.text;
    $('#prize-card').hidden = false;
    fanfare(); confetti(240); buzz([100, 50, 100, 50, 300]);
    setTimeout(() => $('#prize-card').scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  });
  $('#prize-ok').onclick = () => {
    $('#wheel-overlay').hidden = true;
    renderSister();
    toast('New round – the Annoy-O-Meter is back at 0.');
  };

  // ---------- Bruder: Code-Anzeige ----------
  let shownStep = -1;
  function renderCode() {
    const secs = Date.now() / 1000;
    const st = Math.floor(secs / STEP);
    const left = Math.ceil(STEP - (secs % STEP));
    if (st !== shownStep) {
      shownStep = st;
      const d = $('#code-digits');
      d.textContent = totp(S.secret, st);
      d.classList.remove('bump'); void d.offsetWidth;
    }
    $('#code-secs').textContent = left;
    const ring = $('#ring-fg');
    ring.style.strokeDashoffset = (339.3 * (1 - left / STEP)).toFixed(1);
    ring.style.stroke = left <= 10 ? 'var(--yellow)' : '';
  }
  $('#brother-horn').onclick = () => {
    horn(); buzz([60, 60, 200]);
    const b = $('#brother-horn'); b.classList.remove('honk'); void b.offsetWidth; b.classList.add('honk');
  };

  // ---------- Sheets ----------
  document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { $('#sheet-' + b.dataset.close).hidden = true; }; });
  document.querySelectorAll('.sheet-backdrop').forEach((bd) => {
    bd.addEventListener('click', (e) => { if (e.target === bd) bd.hidden = true; });
  });
  document.querySelectorAll('[data-open="settings"]').forEach((b) => { b.onclick = openSettings; });

  function openSettings() {
    $('#set-sound').checked = S.sound;
    $('#set-badge').hidden = !(S.role === 'sister' && 'setAppBadge' in navigator);
    $('#set-share').hidden = S.role !== 'brother';
    $('#set-test').hidden = S.role !== 'brother' || TEST;
    $('#set-code').textContent = fmtCode(S.secret);
    $('#set-install').hidden = isStandalone();
    $('#sheet-settings').hidden = false;
  }
  $('#set-sound').onchange = (e) => { S.sound = e.target.checked; save(); if (S.sound) horn(); };
  $('#set-share').onclick = shareGift;
  $('#app-version').textContent = VERSION;

  // Erzwingt die neueste Version: alten Zwischenspeicher verwerfen und neu laden. Daten bleiben erhalten.
  $('#set-update').onclick = async () => {
    toast('Checking for updates …');
    try {
      if ('serviceWorker' in navigator) {
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      }
      if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    } catch { /* egal */ }
    location.replace(location.pathname + '?u=' + Date.now());
  };

  // Testmodus starten/beenden – die echte Nerver-Einrichtung bleibt unangetastet.
  $('#brother-test').onclick = () => $('#set-test').onclick();
  $('#set-test').onclick = () => {
    const t = Object.assign(defaults(), { role: 'sister', secret: S.secret, name: S.name, sound: S.sound });
    try {
      localStorage.setItem(TEST_KEY, JSON.stringify(t));
      localStorage.setItem(TEST_FLAG, '1');
    } catch { return toast('Test mode not possible (storage blocked).'); }
    location.replace(location.pathname);
  };
  $('#testbar').hidden = !TEST;
  $('#test-plus').onclick = () => {
    if (S.count >= GOAL) return toast('Already full – spin the wheel!');
    const add = Math.min(5, GOAL - S.count);
    for (let i = 0; i < add; i++) S.entries.unshift({ t: Date.now(), note: 'Test entry' });
    S.count += add; save(); renderSister(true);
    if (S.count >= GOAL) { confetti(220); fanfare(); toast('20 reached – the prize wheel is unlocked! 🎡'); }
  };
  $('#test-exit').onclick = () => {
    try { localStorage.removeItem(TEST_FLAG); localStorage.removeItem(TEST_KEY); } catch { /* egal */ }
    location.replace(location.pathname);
  };
  $('#set-badge').onclick = async () => {
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    } catch { /* egal */ }
    updateBadge();
    toast(isStandalone() ? 'The count now shows as a number on the app icon.' : 'Only works once the app is installed.');
  };
  $('#set-install').onclick = () => { $('#sheet-settings').hidden = true; installHelp(); };
  $('#set-reset').onclick = () => {
    if (!confirm('Really delete everything? Counter, log and vouchers will be gone.')) return;
    if (!confirm('Are you sure? This can’t be undone.')) return;
    try { localStorage.removeItem(STORE); } catch { /* egal */ }
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    location.replace(location.pathname);
  };

  // ---------- Installation ----------
  let deferredPrompt = null;
  const BANNER_KEY = 'dont-annoy-me:banner-off';
  const bannerOff = () => { try { return localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; } };
  function showBanner(text, withButton) {
    if (isStandalone() || bannerOff()) return;
    $('#install-text').innerHTML = text;
    $('#install-btn').hidden = !withButton;
    $('#install-banner').hidden = false;
  }
  function installHelp() {
    if (isStandalone()) return toast('The app is already installed ✓');
    if (deferredPrompt) return promptInstall();
    if (isIOS) return alert('How to install the app on iPhone/iPad:\n\n1. Open in Safari\n2. Tap “Share” (□↑) at the bottom\n3. Choose “Add to Home Screen”\n4. Tap “Add”');
    alert('How to install the app:\n\n• Android (Chrome): menu ⋮ → “Install app” or “Add to Home screen”\n• PC (Chrome/Edge): install icon on the right of the address bar, or menu → “Install app”\n• Mac (Safari): File → “Add to Dock”');
  }
  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('#install-banner').hidden = true;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    showBanner('📲 Install <b>Dont annoy me!</b> as an app?', true);
  });
  window.addEventListener('appinstalled', () => { $('#install-banner').hidden = true; toast('Installed! 🎉'); });
  $('#install-btn').onclick = promptInstall;
  $('#install-close').onclick = () => {
    $('#install-banner').hidden = true;
    try { localStorage.setItem(BANNER_KEY, '1'); } catch { /* egal */ }
  };
  if (isIOS && !isStandalone()) showBanner('📲 To install: tap <b>Share</b> at the bottom, then <b>“Add to Home Screen”</b>.', false);

  // ---------- Los ----------
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const id = document.activeElement && document.activeElement.id;
    if (id === 'pair-code' || id === 'pair-name') $('#pair-ok').click();
    if (id === 'gift-name') $('#gift-generate').click();
    if (id === 'gift-code-input') $('#gift-code-ok').click();
    if (id === 'entry-note') $('#entry-code').focus();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.role === 'brother') renderCode(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', () => { S = load(); route(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Bei einem Update übernimmt der neue Service Worker – dann einmal neu laden.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded || spinning) return;
      reloaded = true; location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
      })
      .catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  route();
})();
