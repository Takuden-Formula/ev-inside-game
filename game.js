// EV内部探検：6つのステージ（S1〜S6）と、文化祭用の進行（待機デモ・結果・ランキング・設定・記録・放置で戻る）
// index.html から普通の <script> で読み込む（file:// で直接開いても動くように、モジュールにはしない）
"use strict";
const W = 800, H = 450;
const cv = document.getElementById('cv'), g = cv.getContext('2d');
cv.width = W; cv.height = H;
const $ = id => document.getElementById(id);
const FONT = '-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Meiryo",sans-serif';

/* ---------- 共通UI ---------- */
let cur = null, running = false, stageIdx = 0, mist = 0, last = 0;
const stars = new Array(6).fill(0);
let ctl = {};
// mode: idle（待機。見どころのデモを流す）/ play（遊んでいる）/ result（結果画面）
let mode = 'idle';

// 待機中のデモでは、ステージの中からのメッセージやボタンは出さない
function msg(t, cls) { if (mode === 'idle') return; showMsg(t, cls); }
function showMsg(t, cls) { const m = $('msg'); m.textContent = t; m.className = cls || ''; }
function setControls(list) { if (mode === 'idle') return; makeControls(list); }
function makeControls(list) {
  const box = $('controls'); box.innerHTML = ''; ctl = {};
  list.forEach(it => {
    const b = document.createElement('button');
    b.textContent = it.label; if (it.cls) b.className = it.cls;
    if (it.hold) {
      b.classList.add('hold'); b.addEventListener('contextmenu', e => e.preventDefault());
      b.addEventListener('pointerdown', e => { e.preventDefault(); sfx.button(); it.down(); b.classList.add('on'); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => { it.up(); b.classList.remove('on'); }));
    } else b.addEventListener('click', e => { sfx.button(); it.fn(); b.blur(); });
    box.appendChild(b); if (it.id) ctl[it.id] = b;
  });
}
function setOn(id, on) { if (ctl[id]) ctl[id].classList.toggle('on', !!on); }
function overlay(html, btns) {
  const c = $('card'); c.innerHTML = html;
  const row = document.createElement('div'); row.className = 'btns';
  btns.forEach(b => {
    const e = document.createElement('button'); e.textContent = b.label;
    if (b.primary) e.className = 'primary';
    e.addEventListener('click', () => { if (performance.now() - shownAt < 400) return; sfx.button(); hideOverlay(); b.fn(); });   // 出た直前のタップの click で押されないように
    row.appendChild(e);
  });
  c.appendChild(row); $('overlay').style.display = 'flex'; shownAt = performance.now(); const pb = row.querySelector('.primary'); if (pb) pb.focus();
}
let shownAt = 0;
function hideOverlay() { $('overlay').style.display = 'none'; }
function renderProg() {
  $('prog').innerHTML = stages.map((s, i) =>
    `<span class="pill ${i === stageIdx && cur && mode === 'play' ? 'now' : ''} ${stars[i] ? 'done' : ''}">${i + 1}. ${s.short}${stars[i] ? ' ' + '★'.repeat(stars[i]) : ''}</span>`).join('');
}
function pointerXY(e) {
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function txt(s, x, y, size, color, align, bold) {
  g.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; g.fillStyle = color || '#1b2a3a';
  g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
function rrect(x, y, w, h, r, fill, stroke, lw) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 2; g.stroke(); }
}
function poly(pts, color, lw) {
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
  g.strokeStyle = color; g.lineWidth = lw || 4; g.lineJoin = 'round'; g.stroke();
}

/* ---------- ステージ1：プリチャージ ---------- */
const S1 = {
  rate() { return mist === 0 ? 3 : mist === 1 ? 2 : 1; },
  short: 'つなぐ順番', title: 'ステージ1　高電圧回路をつなぐ順番',
  learn: `<p>EVのバッテリーは約400V。インバータの中には大きなコンデンサがあり、空っぽのまま電池につなぐと<b>一瞬で大電流（突入電流）</b>が流れます。</p>
    <p>そこで<b>プリチャージ抵抗</b>を通してゆっくり充電してから、メインの接触器を入れます。3つの接触器を正しい順番で操作して、コンデンサを400Vまで充電しよう。</p>`,
  real: '実車では、イグニッションON直後に「カチッ、カチッ」と鳴るのがこの接触器（コンタクタ）。電圧が揃う前にメインを入れると接点が溶着することがあります。',
  hints: ['まず、電流の帰り道になる「マイナス」を閉じます。', '次に「プリチャージ」を閉じて、電圧が上がるのを待ちます。', '電圧が約90%(360V)を超えたら「メイン(+)」を閉じます。', '最後に「プリチャージ」を開いて完了です。'],
  start() {
    this.neg = this.pre = this.pos = false; this.v = 0; this.told = this.told2 = false; this.over = false; this.hintN = 0;
    setControls([
      { id: 'neg', label: 'マイナス接触器 (−)', fn: () => this.toggle('neg') },
      { id: 'pre', label: 'プリチャージ接触器', fn: () => this.toggle('pre') },
      { id: 'pos', label: 'メイン接触器 (+)', fn: () => this.toggle('pos') },
      { label: 'ヒント', fn: () => { msg('ヒント: ' + this.hints[Math.min(this.hintN++, 3)]); } }
    ]);
    msg('下のボタンで接触器を ON/OFF。コンデンサの電圧(右の青いタンク)を400Vまで上げよう。');
  },
  toggle(k) {
    if (this.over) return;
    this[k] = !this[k]; setOn(k, this[k]);
    if (this.neg && this.pos && this.v < 360) {
      this.over = true;
      fail('突入電流！ コンデンサの電圧が低いままメインを閉じると、一気に大電流が流れて接点が溶着します。メイン(+)は、プリチャージで電圧が揃ってから入れよう。');
    } else if (this.pre && !this.neg) msg('プリチャージを閉じても、帰り道(−)が開いたままなので電流は流れません。', 'warn');
  },
  tick(dt) {
    if (this.over) return;
    const path = this.neg && (this.pre || this.pos);
    if (path) this.v += (400 - this.v) * (1 - Math.exp(-dt / (this.pos ? 0.1 : 2.2)));
    else this.v *= Math.exp(-dt / 25);
    if (path && !this.pos && this.v >= 360 && !this.told) { this.told = true; msg('電圧がほぼ揃った！ メイン(+)を閉じよう。', 'good'); }
    if (this.neg && this.pos && this.pre && this.v >= 390 && !this.told2) { this.told2 = true; msg('メインがつながった。プリチャージは役目を終えたので開こう。', 'good'); }
    if (this.neg && this.pos && !this.pre && this.v >= 390) { this.over = true; win(); }
  },
  draw() {
    const live = this.neg && (this.pre || this.pos), on = '#f08a1c', off = '#c3cfdb';
    const cNeg = live ? on : off, cPre = live && this.pre ? on : off, cPos = live && this.pos ? on : off;
    g.setLineDash([]);
    // 配線
    poly([[90, 170], [90, 130], [220, 130]], live ? on : off);
    poly([[220, 130], [260, 130]], cPos); poly([[400, 130], [440, 130]], cPos);
    poly([[220, 130], [220, 60], [260, 60]], cPre); poly([[320, 60], [335, 60]], cPre);
    poly([[395, 60], [440, 60], [440, 130]], cPre);
    poly([[440, 130], [640, 130], [640, 170]], live ? on : off);
    poly([[90, 300], [90, 370], [260, 370]], live ? on : off);
    poly([[400, 370], [640, 370], [640, 300]], cNeg);
    // 接触器
    this.sw(260, 130, 400, this.pos, 'メイン (+)');
    this.sw(260, 60, 320, this.pre, 'プリチャージ');
    this.sw(260, 370, 400, this.neg, 'マイナス (−)');
    // 抵抗
    rrect(335, 48, 60, 24, 4, '#dbe3ec', '#6b7c8f', 2); txt('抵抗', 365, 60, 13, '#6b7c8f', 'center');
    // バッテリー
    rrect(40, 170, 100, 130, 10, '#e6f6f0', '#0f9d76', 3);
    txt('バッテリー', 90, 200, 16, '#0f9d76', 'center', true); txt('400 V', 90, 240, 24, '#1b2a3a', 'center', true);
    txt('+', 90, 155, 22, '#e0484d', 'center', true); txt('−', 90, 322, 24, '#2f7fe0', 'center', true);
    // インバータ（コンデンサ）
    rrect(560, 170, 160, 130, 10, '#eaf2fb', '#2f7fe0', 3);
    txt('インバータ', 640, 190, 15, '#2f7fe0', 'center', true);
    const f = clamp(this.v / 400, 0, 1);
    rrect(580, 205, 120, 70, 6, '#f7f9fc', '#c3cfdb', 2);
    g.fillStyle = f >= 0.9 ? '#8fdcc3' : '#9cc8f7'; g.fillRect(582, 273 - 66 * f, 116, 66 * f);
    txt(this.v.toFixed(0) + ' V', 640, 240, 22, '#1b2a3a', 'center', true);
    txt('コンデンサ', 640, 290, 12, '#6b7c8f', 'center');
    // 進行
    txt(this.pos && !this.pre && this.v >= 390 ? '接続完了！' : (f >= 0.9 ? '電圧OK → メインを入れてよい' : '電圧が低い…'), 640, 330, 13, f >= 0.9 ? '#0f9d76' : '#e69500', 'center');
  },
  sw(x1, y, x2, closed, label) {
    const c = closed ? '#0f9d76' : '#e0484d';
    g.fillStyle = c; [x1, x2].forEach(x => { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); });
    g.strokeStyle = c; g.lineWidth = 5; g.beginPath(); g.moveTo(x1, y);
    if (closed) g.lineTo(x2, y); else g.lineTo(x2 - 12, y - 28); g.stroke();
    txt(label + (closed ? ' ON' : ' OFF'), (x1 + x2) / 2, y + (y > 300 ? 28 : -34), 14, c, 'center', true);
  }
};

/* ---------- ステージ2：セルバランス ---------- */
const S2 = {
  rate() { const rem = this.limit - this.t; return rem >= 25 ? 3 : rem >= 10 ? 2 : 1; },
  short: 'セルバランス', title: 'ステージ2　バッテリーのセルを揃える',
  learn: `<p>EVの電池パックは小さな<b>セル</b>を何百個も直列・並列につないだもの。セルごとに少しずつ電圧がずれます。</p>
    <p>充電中は<b>いちばん電圧が高いセル</b>が上限(4.18V)に達した時点で、パック全体の充電が止まります。高いセルの電圧を<b>抵抗で少し捨てて（バランシング）</b>、全部のセルを4.05V以上・差0.05V以内にそろえよう。</p>
    <p>セルをクリック（またはキー 1〜8）で、放電抵抗のON/OFF。ただし抵抗は熱くなるので、温度が65℃になると強制停止します。</p>`,
  real: '実際のBMSにも、高いセルを抵抗で放電する「パッシブバランシング」があります。実機の放電電流は小さく、時間をかけて少しずつ行います（ゲームでは時間を縮めています）。電池の寿命と安全のため、セル電圧の差を小さく保つのがBMSの大切な仕事です。',
  LIM: 4.18, VMIN: 3.4, VMAX: 4.3,
  start() {
    this.cells = Array.from({ length: 8 }, () => ({ v: 3.55 + Math.random() * 0.3, r: 0.02 * (0.85 + Math.random() * 0.3), bleed: false, temp: 25, lock: false }));
    this.t = 0; this.limit = 60; this.charging = true; this.over = false; this.warned = false;
    setControls(this.cells.map((c, i) => ({ id: 'c' + i, label: `セル${i + 1} [${i + 1}]`, fn: () => this.toggle(i) })));
    msg('電圧の高いセルをクリックして放電。60秒以内に、全セルが緑のゾーン(4.05〜4.18V)で揃えば成功！');
  },
  toggle(i) {
    if (this.over) return; const c = this.cells[i];
    if (c.lock) { msg('セル' + (i + 1) + 'の抵抗が熱すぎて停止中。冷えるまで待とう。', 'warn'); return; }
    c.bleed = !c.bleed; setOn('c' + i, c.bleed);
  },
  tick(dt) {
    if (this.over) return;
    this.t += dt;
    const vs = this.cells.map(c => c.v), mx = Math.max(...vs), mn = Math.min(...vs);
    this.charging = mx < this.LIM;
    this.cells.forEach((c, i) => {
      c.v = Math.max(this.VMIN, c.v + ((this.charging ? c.r : 0) - (c.bleed ? 0.05 : 0)) * dt);
      c.temp = c.bleed ? c.temp + 8 * dt : Math.max(25, c.temp - 4 * dt);
      if (c.temp >= 65 && c.bleed) { c.bleed = false; c.lock = true; setOn('c' + i, false); se('warn'); msg('セル' + (i + 1) + 'が65℃に！ 保護のため放電を停止しました。', 'warn'); }
      if (c.lock && c.temp <= 45) c.lock = false;
      if (ctl['c' + i]) ctl['c' + i].classList.toggle('lock', c.lock);
    });
    if (!this.charging && !this.warned) { this.warned = true; msg('最高電圧のセルが上限！ パック全体の充電が止まりました。高いセルを放電しよう。', 'warn'); }
    if (this.charging) this.warned = false;
    if (mn >= 4.05 && mx - mn <= 0.05) { this.over = true; win(); }
    else if (this.t >= this.limit) { this.over = true; fail('時間切れ。いちばん電圧の高いセルが上限に当たるたび、充電が止まってしまいました。低いセルが追いつく前に、高いセルを先に放電しておくのがコツです。'); }
  },
  rect(i) { return [60 + i * 85, 95, 66, 230]; },
  y(v) { const [, y0, , h] = this.rect(0); return y0 + h - (v - this.VMIN) / (this.VMAX - this.VMIN) * h; },
  draw() {
    const [, y0, , h] = this.rect(0);
    // ゾーン
    g.fillStyle = 'rgba(53,208,160,.16)'; g.fillRect(40, this.y(this.LIM), 720, this.y(4.05) - this.y(this.LIM));
    g.setLineDash([6, 5]); poly([[40, this.y(this.LIM)], [760, this.y(this.LIM)]], '#e0484d', 2);
    poly([[40, this.y(4.05)], [760, this.y(4.05)]], '#0f9d76', 2); g.setLineDash([]);
    txt('充電停止 4.18V', 758, this.y(this.LIM) - 9, 12, '#e0484d', 'right');
    txt('目標 4.05V', 758, this.y(4.05) + 10, 12, '#0f9d76', 'right');
    this.cells.forEach((c, i) => {
      const [x, y, w, hh] = this.rect(i), top = this.y(c.v);
      rrect(x, y, w, hh, 8, '#f7f9fc', c.bleed ? '#e69500' : '#c3cfdb', c.bleed ? 4 : 2);
      g.fillStyle = c.v >= 4.05 ? '#5fcfab' : (c.v >= 3.85 ? '#8cbcf2' : '#c6d2de');
      g.fillRect(x + 3, top, w - 6, y + hh - top - 3);
      txt(c.v.toFixed(3), x + w / 2, y - 14, 15, '#1b2a3a', 'center', true);
      txt('セル' + (i + 1), x + w / 2, y + hh + 16, 14, '#6b7c8f', 'center');
      // 温度
      const tf = clamp((c.temp - 25) / 40, 0, 1);
      rrect(x, y + hh + 30, w, 10, 4, '#f7f9fc', '#c3cfdb', 1);
      g.fillStyle = tf > 0.75 ? '#e0484d' : '#e69500'; g.fillRect(x + 1, y + hh + 31, (w - 2) * tf, 8);
      txt(c.lock ? '停止中 ' + c.temp.toFixed(0) + '℃' : (c.bleed ? '放電中 ' + c.temp.toFixed(0) + '℃' : c.temp.toFixed(0) + '℃'), x + w / 2, y + hh + 52, 12, c.lock ? '#e0484d' : (c.bleed ? '#e69500' : '#6b7c8f'), 'center');
    });
    const vs = this.cells.map(c => c.v), mx = Math.max(...vs), mn = Math.min(...vs);
    txt('残り ' + Math.max(0, this.limit - this.t).toFixed(0) + ' 秒', 40, 28, 22, '#1b2a3a', 'left', true);
    txt(this.charging ? '⚡ 充電中' : '⏸ 充電停止中(最高セルが上限)', 40, 56, 15, this.charging ? '#0f9d76' : '#e0484d', 'left', true);
    txt(`最低 ${mn.toFixed(3)} V　最高 ${mx.toFixed(3)} V　差 ${(mx - mn).toFixed(3)} V`, 760, 28, 15, '#4a5b6d', 'right');
    txt('目標：最低4.05V以上 かつ 差0.05V以内', 760, 56, 14, '#6b7c8f', 'right');
  },
  pointer(e) {
    if (this.over || !running) return;
    const [px, py] = pointerXY(e);
    for (let i = 0; i < 8; i++) { const [x, y, w, h] = this.rect(i); if (px >= x - 8 && px <= x + w + 8 && py >= y && py <= y + h + 60) { this.toggle(i); return; } }
  },
  key(k) { const n = parseInt(k, 10); if (n >= 1 && n <= 8) this.toggle(n - 1); }
};

/* ---------- ステージ3：インバータ ---------- */
const PH = ['U', 'V', 'W'], PCOL = ['#e5484d', '#0f9d76', '#2f7fe0'];
const CFG = [[0, 1], [0, 2], [1, 2], [1, 0], [2, 0], [2, 1]]; // [上アーム相, 下アーム相]
const AXIS = [90, -30, 210];
const KEYS = { q: 0, w: 1, e: 2, a: 3, s: 4, d: 5 };
const S3 = {
  rate() { const p = this.pct; return p >= 0.85 ? 3 : p >= 0.7 ? 2 : 1; },
  short: 'インバータ', title: 'ステージ3　インバータでモータを回す',
  learn: `<p>インバータは6個のスイッチで、バッテリーの直流をモータ用の三相に切り替えます。モータの磁石(ローター)は回っているので、<b>60°進むごとに、流す相を1つずつ入れ替え</b>ます（120°通電方式）。</p>
    <p>画面の金色の枠が「いま入れるべきスイッチ」です。上アームと下アームを1組ずつONにして、ローターを回し続けよう。</p>
    <p><b>注意：</b>同じ相の上と下を同時にONにすると、電池が短絡(ショート)します！ 切り替えるときは先にOFFにしよう。</p>`,
  real: '実際のインバータは、短絡を防ぐため、上下の切り替え時に両方OFFの「デッドタイム」を入れます。EVのモータ制御はこれをマイクロ秒単位で、さらになめらかなPWMで行っています。',
  start() {
    this.on = [false, false, false, false, false, false];
    this.t = 0; this.total = 40; this.theta = 0; this.good = 0; this.shortT = 0; this.flash = 0; this.torque = 0; this.over = false;
    const labs = ['U 上 [Q]', 'V 上 [W]', 'W 上 [E]', 'U 下 [A]', 'V 下 [S]', 'W 下 [D]'];
    setControls(labs.map((l, i) => ({ id: 's' + i, label: l, fn: () => this.toggle(i) })));
    msg('金色の枠のスイッチをONに、不要なスイッチはOFFに。ボタンかキーボード(Q W E / A S D)で操作。');
  },
  toggle(i) { if (this.over) return; this.on[i] = !this.on[i]; setOn('s' + i, this.on[i]); },
  sector() { return Math.floor(this.theta / 60) % 6; },
  state() {
    const hi = [0, 1, 2].filter(i => this.on[i]), lo = [0, 1, 2].filter(i => this.on[i + 3]);
    const sc = [0, 1, 2].some(i => this.on[i] && this.on[i + 3]);
    return { hi, lo, sc };
  },
  tick(dt) {
    if (this.over) return;
    this.t += dt;
    const secT = lerp(2.6, 1.0, clamp(this.t / this.total, 0, 1));
    this.theta = (this.theta + 60 / secT * dt) % 360;
    const s = this.sector(), p = (this.theta % 60) / 60, st = this.state();
    const ok = !st.sc && st.hi.length === 1 && st.lo.length === 1 && st.hi[0] === CFG[s][0] && st.lo[0] === CFG[s][1];
    if (ok) this.good += dt;
    if (st.sc) { if (this.flash <= 0) se('warn'); this.shortT += dt; this.flash = 1; } else this.flash = Math.max(0, this.flash - dt * 2);
    this.torque += ((ok ? Math.sin((120 - 60 * p) * Math.PI / 180) : 0) - this.torque) * Math.min(1, dt * 8);
    if (this.shortT > 1.5) { this.over = true; fail('短絡(ショート)の合計が1.5秒を超え、ヒューズが飛びました！ 同じ相の上下スイッチを同時にONにしないよう、先にOFFにしてから切り替えよう。'); return; }
    if (this.t >= this.total) {
      this.over = true; this.pct = this.good / this.total;
      if (this.pct >= 0.55) win(); else fail(`ローターに力が伝わった時間は ${(this.pct * 100).toFixed(0)}%。55%以上が合格です。金色の枠を目で追って、切り替えを早めよう。`);
    }
  },
  draw() {
    const s = this.sector(), p = (this.theta % 60) / 60, st = this.state();
    const need = new Set([CFG[s][0], CFG[s][1] + 3]);
    // バス
    poly([[60, 70], [380, 70]], '#e0484d', 5); poly([[60, 380], [380, 380]], '#2f7fe0', 5);
    txt('+ バッテリー', 60, 52, 14, '#e0484d'); txt('−', 60, 400, 16, '#2f7fe0');
    for (let ph = 0; ph < 3; ph++) {
      const x = 110 + ph * 105;
      poly([[x, 70], [x, 110]], '#c3cfdb', 3); poly([[x, 190], [x, 265]], '#c3cfdb', 3); poly([[x, 340], [x, 380]], '#c3cfdb', 3);
      this.swbox(x - 26, 110, ph, need.has(ph), this.on[ph], '上');
      this.swbox(x - 26, 265, ph, need.has(ph + 3), this.on[ph + 3], '下');
      txt('→' + PH[ph], x, 228, 18, PCOL[ph], 'center', true);
      if (this.on[ph] && this.on[ph + 3]) { g.fillStyle = 'rgba(255,90,95,' + (0.25 + 0.2 * Math.sin(this.t * 25)) + ')'; g.fillRect(x - 34, 105, 68, 245); }
    }
    // モータ
    const cx = 610, cy = 225, R = 135;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = '#eaf2fb'; g.fill(); g.strokeStyle = '#c3cfdb'; g.lineWidth = 3; g.stroke();
    for (let ph = 0; ph < 3; ph++) {
      const a = AXIS[ph] * Math.PI / 180, x = cx + 104 * Math.cos(a), y = cy - 104 * Math.sin(a);
      const isHi = st.hi.length === 1 && st.hi[0] === ph && !st.sc, isLo = st.lo.length === 1 && st.lo[0] === ph && !st.sc;
      g.beginPath(); g.arc(x, y, 22, 0, 7); g.fillStyle = (isHi || isLo) ? PCOL[ph] : '#eef2f7'; g.fill(); g.strokeStyle = PCOL[ph]; g.lineWidth = 3; g.stroke();
      txt(PH[ph] + (isHi ? '＋' : isLo ? '−' : ''), x, y, 16, (isHi || isLo) ? '#ffffff' : PCOL[ph], 'center', true);
    }
    // ステータ磁界
    if (st.hi.length === 1 && st.lo.length === 1 && !st.sc) {
      const a = Math.atan2(Math.sin(AXIS[st.hi[0]] * Math.PI / 180) - Math.sin(AXIS[st.lo[0]] * Math.PI / 180), Math.cos(AXIS[st.hi[0]] * Math.PI / 180) - Math.cos(AXIS[st.lo[0]] * Math.PI / 180));
      this.arrow(cx, cy, a, 80, '#d99a00');
    }
    // ローター
    const phi = (240 - this.theta) * Math.PI / 180;
    g.lineWidth = 16; g.lineCap = 'butt';
    g.strokeStyle = '#e0484d'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 62 * Math.cos(phi), cy - 62 * Math.sin(phi)); g.stroke();
    g.strokeStyle = '#2f7fe0'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 62 * Math.cos(phi), cy + 62 * Math.sin(phi)); g.stroke();
    txt('N', cx + 78 * Math.cos(phi), cy - 78 * Math.sin(phi), 14, '#e0484d', 'center', true);
    txt('S', cx - 78 * Math.cos(phi), cy + 78 * Math.sin(phi), 14, '#2f7fe0', 'center', true);
    // HUD
    txt(`残り ${Math.max(0, this.total - this.t).toFixed(0)} 秒`, 20, 24, 20, '#1b2a3a', 'left', true);
    txt(`トルクが出た割合 ${(this.t > 0 ? this.good / this.t * 100 : 0).toFixed(0)}%（合格55%）`, 780, 24, 15, '#4a5b6d', 'right');
    const nx = CFG[(s + 1) % 6];
    txt(`いま：${PH[CFG[s][0]]}上 + ${PH[CFG[s][1]]}下　次：${PH[nx[0]]}上 + ${PH[nx[1]]}下`, 20, 428, 15, '#d99a00', 'left', true);
    rrect(520, 408, 260, 14, 6, '#f7f9fc', '#c3cfdb', 1); g.fillStyle = '#0f9d76'; g.fillRect(522, 410, 256 * clamp(this.torque, 0, 1), 10);
    txt('トルク', 505, 415, 12, '#6b7c8f', 'right');
    if (this.flash > 0) { g.fillStyle = `rgba(255,60,60,${this.flash * 0.25})`; g.fillRect(0, 0, W, H); txt('短絡！ ショート危険', 400, 225, 34, '#e0484d', 'center', true); }
  },
  swbox(x, y, ph, needed, on, lab) {
    rrect(x, y, 52, 80, 8, on ? PCOL[ph] : '#eef2f7', needed ? '#d99a00' : '#c3cfdb', needed ? 4 : 2);
    txt(PH[ph] + lab, x + 26, y + 30, 16, on ? '#ffffff' : PCOL[ph], 'center', true);
    txt(on ? 'ON' : 'OFF', x + 26, y + 56, 14, on ? '#ffffff' : '#6b7c8f', 'center', true);
    if (needed && !on) { g.setLineDash([5, 4]); rrect(x - 5, y - 5, 62, 90, 10, null, '#d99a00', 2); g.setLineDash([]); }
  },
  arrow(cx, cy, a, len, color) {
    const ex = cx + len * Math.cos(a), ey = cy - len * Math.sin(a);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
    g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 14 * Math.cos(a - 0.45), ey + 14 * Math.sin(a - 0.45)); g.lineTo(ex - 14 * Math.cos(a + 0.45), ey + 14 * Math.sin(a + 0.45)); g.fill();
  },
  key(k) { if (k in KEYS) this.toggle(KEYS[k]); }
};

/* ---------- ステージ4：回生ブレーキ ---------- */
const S4 = {
  rate() { const p = this.pct; return p >= 0.55 ? 3 : p >= 0.42 ? 2 : 1; },
  short: '回生ブレーキ', title: 'ステージ4　ブレーキで電気をつくる',
  learn: `<p>EVはブレーキをかけるとき、モータを<b>発電機</b>にして、車の運動エネルギーを電気に変えてバッテリーへ戻します（回生ブレーキ）。</p>
    <p>青いゾーンの中にぴったり止めよう。<b>回生</b>で減速するほど電気が戻ります。ただし<b>低速になるほど回生は弱く</b>なるので、最後は<b>メカブレーキ(摩擦)</b>で補います。メカブレーキは熱になって捨てるだけです。</p>
    <p>ボタンを押している間だけ働きます。キーボードは R=回生、B=メカ。</p>`,
  real: '回生ブレーキのおかげで、EVは街中でガソリン車より電費が良くなります。多くのEVは、ふだんの減速のほとんどを回生でまかない、強く踏んだときだけ摩擦ブレーキが加わります。',
  M: 1600, V0: 20, LINE: 110, ZONE: 10,
  predict() {
    let x = this.x, v = this.v;
    while (v > 0.02 && x < 400) { let a = 0.25 + 3 * Math.min(1, v / 2.5); const vn = Math.max(0, v - a * 0.02); x += (v + vn) / 2 * 0.02; v = vn; }
    return x;
  },
  start() {
    this.x = 0; this.v = this.V0; this.reg = this.mech = false; this.E = 0; this.H = 0; this.over = false;
    this.KE0 = 0.5 * this.M * this.V0 * this.V0; this.a = 0;
    setControls([
      { id: 'reg', hold: true, label: '回生ブレーキ [R]', down: () => this.reg = true, up: () => this.reg = false },
      { id: 'mech', hold: true, label: 'メカブレーキ [B]', down: () => this.mech = true, up: () => this.mech = false }
    ]);
    msg('惰性で走っています。緑の線は「今から回生すると止まる位置」。青いゾーンに重なる瞬間に回生を踏もう。');
  },
  key(k) { if (k === 'r') { this.reg = true; setOn('reg', true); } if (k === 'b') { this.mech = true; setOn('mech', true); } },
  keyup(k) { if (k === 'r') { this.reg = false; setOn('reg', false); } if (k === 'b') { this.mech = false; setOn('mech', false); } },
  release() { this.reg = this.mech = false; setOn('reg', false); setOn('mech', false); },
  tick(dt) {
    if (this.over) return;
    const v = this.v; let a = 0.25, reg = 0, mech = 0;
    if (this.reg) { reg = 3 * Math.min(1, v / 2.5); a += reg; }
    if (this.mech) { mech = 6; a += mech; }
    this.a = a;
    const vn = Math.max(0, v - a * dt), vm = (v + vn) / 2;
    this.E += reg * this.M * vm * dt * 0.75; this.H += mech * this.M * vm * dt;
    this.v = vn; this.x += vm * dt;
    if (this.x > this.LINE) { this.over = true; fail('停止線を越えてしまいました。回生の効きは約3 m/s²。止まるのに必要な距離を、速度から見積もろう。'); return; }
    if (this.v <= 0.02) {
      this.over = true;
      if (this.x >= this.LINE - this.ZONE) { this.pct = this.E / this.KE0; win(); }
      else fail('ゾーンの手前で止まりました。緑の線（今回生を始めたら止まる位置）を目安に、ブレーキを遅らせてみよう。');
    }
  },
  draw() {
    const X = x => 24 + x * 6.7, L = this.LINE;
    g.fillStyle = '#e7edf4'; g.fillRect(0, 270, W, 70);
    g.setLineDash([22, 18]); poly([[0, 305], [W, 305]], '#ffffff', 3); g.setLineDash([]);
    g.fillStyle = 'rgba(47,127,224,.22)'; g.fillRect(X(L - this.ZONE), 262, X(L) - X(L - this.ZONE), 86);
    g.fillStyle = '#e0484d'; g.fillRect(X(L) - 2, 255, 4, 100);
    txt('停止線', X(L) - 2, 244, 14, '#e0484d', 'center', true); txt('ここに止める', X(L - this.ZONE / 2), 366, 13, '#2f7fe0', 'center', true);
    const px = this.predict();
    if (this.v > 0.5 && px < this.LINE + 30) { poly([[X(px), 262], [X(px), 348]], '#0f9d76', 2); txt('今 回生すると ここで停止', Math.min(X(px), W - 80), 380, 12, '#0f9d76', 'center', true); }
    const cx = X(this.x);
    rrect(cx - 40, 276, 40, 24, 8, '#ffffff', '#6b7c8f', 2.5); rrect(cx - 30, 266, 24, 14, 5, '#dbe9f7', '#6b7c8f', 2);
    [cx - 31, cx - 10].forEach(wx => { g.beginPath(); g.arc(wx, 302, 6, 0, 7); g.fillStyle = '#1b2a3a'; g.fill(); });
    if (this.reg && this.v > 0.1) txt('⚡ 回収中', cx - 20, 232, 14, '#0f9d76', 'center', true);
    if (this.mech && this.v > 0.1) txt('🔥 熱に変わる', cx - 20, 232, 14, '#e0484d', 'center', true);
    txt((this.v * 3.6).toFixed(0), 24, 40, 44, '#1b2a3a', 'left', true); txt('km/h', 108, 48, 16, '#6b7c8f', 'left');
    txt('停止線まで ' + Math.max(0, L - this.x).toFixed(0) + ' m', 24, 84, 18, '#4a5b6d', 'left', true);
    const bar = (y, lab, f, col, val) => { txt(lab, 330, y, 14, '#4a5b6d', 'left', true); rrect(450, y - 9, 250, 18, 8, '#f7f9fc', '#c3cfdb', 1.5); g.fillStyle = col; g.beginPath(); g.roundRect(451, y - 8, Math.max(0, 248 * clamp(f, 0, 1)), 16, 7); g.fill(); txt(val, 710, y, 13, '#4a5b6d', 'left'); };
    bar(36, '電気に戻した量', this.E / this.KE0 / 0.7, '#5fcfab', (this.E / this.KE0 * 100).toFixed(0) + '%');
    bar(66, '熱にして捨てた量', this.H / this.KE0, '#f2a39b', (this.H / this.KE0 * 100).toFixed(0) + '%');
    bar(96, '減速の強さ', this.a / 9, this.mech ? '#f2a39b' : '#8cbcf2', (this.a).toFixed(1) + ' m/s²');
  }
};

/* ---------- ステージ5：CAN通信 ---------- */
const PK = [
  ['トルク指令  120 Nm', '0x100', 1, 'アクセル操作から決まるトルクの指令は、モータを動かすインバータが受け取ります。'],
  ['アクセル開度  45 %', '0x120', 3, 'ペダルの情報は、車両全体を管理するVCUが集めて、トルク指令を計算します。'],
  ['車速  60 km/h（表示用）', '0x3A0', 0, '表示用の速度は、運転席のメーターが受け取って表示します。'],
  ['SOC（電池残量）  63 %（表示用）', '0x3B0', 0, '残量はメーターに表示されます。'],
  ['充電電流の上限  32 A', '0x1F0', 2, 'BMSが「この電流までOK」と充電器に伝えます。'],
  ['インバータ温度  82 ℃', '0x140', 3, '温度が高いと、VCUが出力を制限して部品を守ります。'],
  ['モータ回転数  3200 rpm（表示用）', '0x3A1', 0, '表示用の回転数も、メーターが受け取って表示します。'],
  ['トルク指令  −40 Nm（回生）', '0x100', 1, 'マイナスのトルク指令で、インバータはモータを発電機として動かします。'],
  ['ブレーキ踏力  30 %', '0x121', 3, 'ブレーキの情報はVCUが集め、回生と摩擦の配分を決めます。'],
  ['バッテリー電圧  352 V（表示用）', '0x3B1', 0, '表示用の電圧は、メーターが受け取って表示します。'],
  ['充電開始の許可', '0x1F2', 2, 'BMSの許可を受けて、充電器が出力を始めます。'],
  ['モータ温度  95 ℃', '0x141', 3, '温度が高いときは、VCUが出力を絞ります。']
];
const BINS = ['メーター', 'インバータ', '充電器', 'VCU（車両制御）'];
const S5 = {
  rate() { return Math.max(1, this.lives); },
  short: 'CAN通信', title: 'ステージ5　CANバスで信号を届ける',
  learn: `<p>EVの中のコンピュータ（ECU）は、<b>CAN</b>という1本の通信線（バス）を<b>みんなで共有</b>しています。メッセージは全員に届きますが、必要なECUだけが拾って使います。</p>
    <p>流れてくるメッセージを、<b>主に受け取って使うECU</b>に届けよう（実際はほかのECUも聞いていますが、ここでは一番の相手を選びます）。時間切れや間違いはミス（3回まで）。</p>
    <p>CANのメッセージにはIDがあり、<b>IDが小さいほど優先度が高い</b>（同時に送ると勝つ）という決まりがあります。※画面のIDは例です。</p>`,
  real: 'CANは車の神経のような存在で、1台に何十ものECUがつながっています。同好会のEVでも、インバータやBMSの情報をCANで読み書きします。',
  start() {
    this.order = PK.map(p => p).sort(() => Math.random() - 0.5);
    this.i = 0; this.lives = 3; this.hit = 0; this.t = 0; this.phase = 'wait'; this.fb = 0; this.pick = -1; this.over = false;
    setControls(BINS.map((b, k) => ({ label: `${b} [${k + 1}]`, fn: () => this.answer(k) })));
    msg('流れてきたメッセージを、必要とするECUのボタンで受け取ろう。');
  },
  lim() { return lerp(7, 4, this.i / (PK.length - 1)); },
  answer(k) {
    if (this.phase !== 'wait' || this.over) return;
    const p = this.order[this.i], ok = p[2] === k;
    this.phase = 'fb'; this.fb = 1.8; this.pick = k;
    if (ok) { this.hit++; se('ok'); } else { this.lives--; se('miss'); }
    msg((k < 0 ? '⏱ 時間切れ。' : ok ? '✔ 正解！ ' : '✖ ちがいます。') + `正解は「${BINS[p[2]]}」。${p[3]}`, ok ? 'good' : 'bad');
  },
  key(k) { const n = parseInt(k, 10); if (n >= 1 && n <= 4) this.answer(n - 1); },
  tick(dt) {
    if (this.over) return;
    if (this.phase === 'wait') { this.t += dt; if (this.t >= this.lim()) this.answer(-1); return; }
    this.fb -= dt;
    if (this.fb > 0) return;
    if (this.lives <= 0) { this.over = true; fail('ミスが3回になりました。信号の「中身」を見て、それを使うECUを考えよう。'); return; }
    if (this.i >= PK.length - 1) { this.over = true; win(); return; }
    this.i++; this.t = 0; this.phase = 'wait'; this.pick = -1; msg('次のメッセージが来ました。');
  },
  draw() {
    const p = this.order[this.i], yb = 225;
    poly([[20, yb], [600, yb]], '#c3cfdb', 6);
    txt('CANバス', 30, yb + 52, 13, '#6b7c8f', 'left', true);
    BINS.forEach((b, k) => {
      const y = 40 + k * 90, hl = this.phase === 'fb' && k === p[2], bad = this.phase === 'fb' && k === this.pick && k !== p[2];
      poly([[600, yb], [620, yb], [620, y + 31], [640, y + 31]], hl ? '#0f9d76' : '#c3cfdb', 4);
      rrect(640, y, 140, 62, 12, hl ? '#e3f6ef' : bad ? '#fdeaea' : '#ffffff', hl ? '#0f9d76' : bad ? '#e0484d' : '#c3cfdb', hl || bad ? 3 : 2);
      txt(b, 710, y + 24, 15, '#1b2a3a', 'center', true); txt('キー ' + (k + 1), 710, y + 46, 12, '#6b7c8f', 'center');
    });
    const f = this.phase === 'wait' ? this.t / this.lim() : 1, px = lerp(20, 380, clamp(f, 0, 1));
    rrect(px, yb - 36, 220, 72, 12, '#ffffff', this.phase === 'fb' && this.pick === p[2] ? '#0f9d76' : '#2f7fe0', 3);
    txt('ID ' + p[1], px + 14, yb - 14, 13, '#6b7c8f', 'left', true); txt(p[0], px + 14, yb + 12, 15, '#1b2a3a', 'left', true);
    txt('♥'.repeat(Math.max(0, this.lives)) + '♡'.repeat(3 - Math.max(0, this.lives)), 24, 36, 26, '#e0484d', 'left');
    txt(`${this.i + 1} / ${PK.length}　正解 ${this.hit}`, 24, 72, 16, '#4a5b6d', 'left', true);
    if (this.phase === 'wait') { rrect(24, 100, 220, 10, 5, '#f7f9fc', '#c3cfdb', 1); g.fillStyle = f > 0.75 ? '#e0484d' : '#2f7fe0'; g.fillRect(25, 101, 218 * (1 - f), 8); }
  }
};

/* ---------- ステージ6：急速充電 ---------- */
const S6 = {
  rate() { return this.t <= 36 ? 3 : this.t <= 48 ? 2 : 1; },
  short: '急速充電', title: 'ステージ6　急速充電をやりとげる',
  learn: `<p>急速充電は、まず<b>一定の電流で一気に</b>充電（CC）し、電池の電圧が上限に近づいたら<b>電流をしぼって</b>仕上げます（CV）。電流が大きいほど、電池は<b>熱く</b>なります。</p>
    <p>電流を上げ下げして、<b>残量90%</b>まで、できるだけ速く充電しよう。ただし<b>電圧が4.2Vを超える</b>と保護が働いて充電が止まり（3回で失敗）、<b>50℃</b>を超えると失敗です。</p>
    <p>電流は ↑↓ キーまたはボタンで10Aずつ変えられます。</p>`,
  real: '実際のEVの急速充電が80%を超えると遅くなるのは、このためです。BMSが電圧と温度を見て、充電器に「ここまでの電流で」と指示しています。',
  limit: 60, target: 0.9,
  start() {
    this.soc = 0.1; this.I = 50; this.T = 25; this.t = 0; this.cut = 0; this.viol = 0; this.V = 3.52; this.hist = []; this.hAcc = 0; this.over = false; this.hotTold = false;
    setControls([{ label: '電流 −10 A [↓]', fn: () => this.adj(-10) }, { label: '電流 +10 A [↑]', fn: () => this.adj(10) }]);
    msg('電流は50Aから。電圧と温度の余裕を見ながら、電流を上げ下げしよう。');
  },
  adj(d) { if (!this.over) this.I = clamp(this.I + d, 0, 200); },
  key(k) { if (k === 'up') this.adj(10); if (k === 'down') this.adj(-10); },
  tick(dt) {
    if (this.over) return;
    this.t += dt; this.cut = Math.max(0, this.cut - dt);
    let Ie = this.cut > 0 ? 0 : this.I, V = 3.45 + 0.7 * this.soc + 0.002 * Ie;
    if (V > 4.2 && this.cut <= 0) {
      this.viol++; this.cut = 2; Ie = 0; V = 3.45 + 0.7 * this.soc;
      se('warn'); msg(`⚠ 電圧が4.2Vを超えたため、保護で充電停止！（${this.viol}/3回）電流を下げよう。`, 'warn');
    }
    this.V = V; this.Ie = Ie;
    this.soc = Math.min(1, this.soc + Ie / 216000 * 80 * dt);
    this.T += ((Ie / 100) ** 2 * 4 - (this.T - 25) * 0.15) * dt;
    this.hAcc += dt; if (this.hAcc >= 0.25) { this.hAcc = 0; this.hist.push(Ie); }
    if (this.T > 45 && !this.hotTold) { this.hotTold = true; se('warn'); msg('温度が45℃を超えました。50℃で失敗です。電流を下げよう。', 'warn'); }
    if (this.T < 40) this.hotTold = false;
    if (this.T > 50) { this.over = true; fail('電池が50℃を超えて過熱しました。電流を大きくしすぎると、発熱は電流の2乗で増えます。'); return; }
    if (this.viol >= 3) { this.over = true; fail('過電圧の保護が3回働きました。残量が増えると電圧が上がるので、電流を少しずつ下げていこう。'); return; }
    if (this.soc >= this.target) { this.over = true; win(); return; }
    if (this.t >= this.limit) { this.over = true; fail('時間切れ。電流が小さすぎたか、保護停止が多かったようです。'); }
  },
  draw() {
    rrect(40, 70, 120, 260, 14, '#f7f9fc', '#c3cfdb', 3);
    g.fillStyle = this.soc >= this.target ? '#5fcfab' : '#8cc2f7'; g.beginPath(); g.roundRect(44, 74 + 252 * (1 - this.soc), 112, 252 * this.soc, 10); g.fill();
    poly([[44, 74 + 252 * (1 - this.target)], [156, 74 + 252 * (1 - this.target)]], '#0f9d76', 2);
    txt('目標 90%', 100, 74 + 252 * (1 - this.target) - 12, 12, '#0f9d76', 'center', true);
    txt((this.soc * 100).toFixed(0) + '%', 100, 200, 30, '#1b2a3a', 'center', true);
    txt('残り ' + Math.max(0, this.limit - this.t).toFixed(0) + ' 秒', 40, 30, 20, '#1b2a3a', 'left', true);
    txt(this.cut > 0 ? '⛔ 保護で充電停止中' : '⚡ 充電中', 190, 30, 14, this.cut > 0 ? '#e0484d' : '#0f9d76', 'left', true);
    const bar = (y, lab, v, lo, hi, marks, val, col) => {
      txt(lab, 210, y - 18, 15, '#4a5b6d', 'left', true); txt(val, 520, y - 18, 15, '#1b2a3a', 'right', true);
      rrect(210, y - 6, 310, 22, 10, '#f7f9fc', '#c3cfdb', 1.5);
      g.fillStyle = col; g.beginPath(); g.roundRect(211, y - 5, Math.max(0, 308 * clamp((v - lo) / (hi - lo), 0, 1)), 20, 9); g.fill();
      marks.forEach(([m, c, t], mi) => { const mx = 210 + 310 * (m - lo) / (hi - lo); poly([[mx, y - 10], [mx, y + 20]], c, 2); txt(t, mx + (mi ? 14 : -14), y + 34, 12, c, 'center', true); });
    };
    bar(110, 'セル電圧', this.V, 3.4, 4.3, [[4.2, '#e0484d', '上限 4.2V']], this.V.toFixed(3) + ' V', this.V > 4.15 ? '#f2a39b' : '#8cbcf2');
    bar(205, '電池温度', this.T, 25, 60, [[45, '#e69500', '警告 45℃'], [50, '#e0484d', '失敗 50℃']], this.T.toFixed(0) + ' ℃', this.T > 45 ? '#f2a39b' : '#f5cf8a');
    bar(300, '充電電流', this.I, 0, 200, [], this.I.toFixed(0) + ' A', '#8cc2f7');
    rrect(560, 70, 220, 260, 12, '#ffffff', '#c3cfdb', 2); txt('電流の履歴', 570, 90, 13, '#6b7c8f', 'left', true);
    if (this.hist.length > 1) {
      const n = this.limit * 4; g.beginPath();
      this.hist.forEach((v, k) => { const x = 570 + 200 * k / n, y = 320 - 210 * v / 200; k ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = '#2f7fe0'; g.lineWidth = 2.5; g.stroke();
    }
  }
};

const stages = [S1, S2, S3, S4, S5, S6];

/* ---------- 進行 ---------- */
// 待機（見どころのデモ・本日のランキング）→ タップ／クリック／Enter → ステージ1〜6（説明 → スタート → クリア／失敗）
//   → 結果（スコア・評価・本日の順位）→ 数十秒で待機へ。途中の「ここで終わる」でも結果へ。放置すると待機へ戻る
function drawTitle() {
  g.fillStyle = '#f7f9fc'; g.fillRect(0, 0, W, H);
  txt('⚡', 400, 150, 90, '#d99a00', 'center');
  txt('EV内部探検', 400, 245, 46, '#1b2a3a', 'center', true);
  txt('バッテリー → インバータ → モータ', 400, 300, 20, '#6b7c8f', 'center');
}
const se = name => { if (mode !== 'idle') sfx[name](); };   // デモ中は効果音を鳴らさない
function begin(i) {
  stageIdx = i; mist = 0; const s = stages[i];
  se('move');
  overlay(`<h2>${s.title}</h2>${s.learn}<div class="real">🚗 ${s.real}</div>`, [{ label: 'スタート', primary: true, fn: () => run(i) }]);
  cur = null; renderProg();
}
function run(i) { cur = stages[i]; cur.start(); running = true; if (session) session.ran = true; renderProg(); }
function win() {
  if (mode === 'idle') return demoEnd();
  running = false; const s = stages[stageIdx];
  const n = s.rate();
  stars[stageIdx] = Math.max(stars[stageIdx], n); renderProg();
  se('clear');
  const isLast = stageIdx === stages.length - 1;
  overlay(`<h2>ステージクリア！</h2><p class="star">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</p><p>${s.real}</p>`,
    isLast ? [{ label: 'もう一度あそぶ', fn: () => begin(stageIdx) }, { label: '結果を見る', primary: true, fn: () => finale('clear') }]
         : [{ label: 'ここで終わる', fn: () => finale('quit') }, { label: 'もう一度', fn: () => run(stageIdx) }, { label: '次のステージへ', primary: true, fn: () => begin(stageIdx + 1) }]);
}
function fail(reason) {
  if (mode === 'idle') return demoEnd();
  running = false; mist++; if (session) session.miss++;
  se('miss');
  msg(reason, 'bad');
  overlay(`<h2>失敗…</h2><p>${reason}</p>`, [{ label: 'ここで終わる', fn: () => finale('quit') }, { label: 'もう一度', primary: true, fn: () => run(stageIdx) }]);
}
// 結果画面。kind: clear（6ステージ目までクリア）/ quit（途中で「ここで終わる」）
function finale(kind) {
  const r = endSession(kind === 'clear' ? '全クリア' : '途中で終了');
  mode = 'result'; resultAt = performance.now();
  cur = null; running = false; makeControls([]); renderProg();
  const story = kind === 'clear' ? `<p>電気はこうして旅をしました。</p>
    <p>① バッテリーを、プリチャージを使って安全に接続<br>② 何百個ものセルを、BMSがそろえて充電<br>③ インバータが三相に切り替えて、モータを回す<br>④ ブレーキのときは、モータが発電して電気を戻す<br>⑤ ECUどうしが、CANバスで情報をやりとりする<br>⑥ 電圧と温度を見ながら、急速充電する</p>
    <p>実際のEVでも、この6つが組み合わさって走っています。</p>` : '<p>次は6つのステージ全部に挑戦してみてね。</p>';
  overlay(`<h2>${kind === 'clear' ? '探検おわり！' : 'おつかれさま！'}</h2>${r ? resultHtml(r) : ''}${story}<p class="note" id="backIn"></p>`,
    [{ label: 'タイトルへ', primary: true, fn: goIdle }]);
  showMsg('おつかれさま！');
  se(kind === 'clear' ? 'goal' : 'clear');
}

/* ---------- スコア・評価・ランキング ---------- */
const TIME_BONUS = 480;   // 時間ボーナス = 480 − プレイ秒（0 未満は 0）。6ステージをふつうに遊ぶと 3〜5 分
const timeBonus = (cleared, sec) => cleared === 6 ? Math.max(0, TIME_BONUS - sec) : 0;   // 時間ボーナスは全クリアのときだけ
const calcScore = (st, miss, sec, cleared) => Math.max(0, st * 100 - miss * 20 + timeBonus(cleared, sec));
function gradeOf(cleared, st) {
  if (cleared === 6 && st >= 16) return { g: 'S', msg: 'EVエンジニア級！' };
  if (cleared === 6 && st >= 12) return { g: 'A', msg: 'すばらしい！' };
  if (cleared === 6) return { g: 'B', msg: '探検成功！' };
  return { g: 'C', msg: cleared >= 3 ? 'あと少し！' : 'またチャレンジしてね' };
}
const fmtSec = s => s >= 60 ? `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒` : `${s}秒`;
const byScore = (a, b) => b.score - a.score || a.sec - b.sec;
const ranked = () => stats.list.filter(e => e.stars > 0).sort(byScore);   // ★0（何もクリアしていない回）はランキングに入れない
function rankingHtml(mark) {
  const list = ranked().slice(0, 5);
  if (!list.length) return '<p class="note">本日のランキングはまだありません。最初の挑戦者になろう！</p>';
  return '<table class="rank"><tr><th colspan="5">本日のランキング</th></tr>' + list.map((e, i) =>
    `<tr class="${e === mark ? 'me' : ''}"><td>${i + 1}位</td><td>${e.no}番</td><td><b>${e.score}</b> 点</td><td>★${e.stars}</td><td>${fmtSec(e.sec)}</td></tr>`).join('') + '</table>';
}
function resultHtml(r) {
  const bonus = timeBonus(r.cleared, r.sec);
  return `<div class="result"><div class="grade g${r.grade.g}">${r.grade.g}</div>
    <div><div class="score">${r.score}<small> 点</small></div><div class="gmsg">${r.grade.msg}</div></div></div>
    <p class="star">${'★'.repeat(r.stars)}${'☆'.repeat(stages.length * 3 - r.stars)}</p>
    <table class="rtab"><tr><th>クリアしたステージ</th><td>${r.cleared} / 6</td></tr><tr><th>プレイ時間</th><td>${fmtSec(r.sec)}</td></tr>
    <tr><th>ミス</th><td>${r.miss} 回</td></tr><tr><th>本日の順位</th><td>${r.rank ? `<b>${r.rank} 位</b>（${r.total} 人中）` : '–（★を取るとランキングに入ります）'}</td></tr></table>
    <p class="note">スコア ＝ ★${r.stars} × 100 − ミス ${r.miss} × 20 ＋ 時間ボーナス ${bonus}（全クリアのとき ${TIME_BONUS} − プレイ秒）</p>
    ${rankingHtml(r.entry)}`;
}

/* ---------- 1回の挑戦（受付） ---------- */
let session = null, resultAt = 0, lastAct = 0, dayCheckAt = 0;
function startSession() {
  if (mode !== 'idle') return;
  rollDay();
  session = { no: Math.max(stats.lastNo || 0, ...stats.list.map(e => e.no)) + 1, playSec: 0, miss: 0, ran: false, done: false };
  mode = 'play'; cur = null; running = false; stars.fill(0); lastAct = performance.now();
  $('idlePanel').style.display = 'none'; makeControls([]); document.body.classList.remove('idle');
  showMsg(`${session.no} 番目の挑戦者さん、ようこそ！ 説明を読んで「スタート」を押そう。`);
  begin(0);
}
// 記録を1行残して、結果をかえす（ステージを1つも始めていなければ残さない）
function endSession(result) {
  const s = session; if (!s || s.done || !s.ran) return null; s.done = true;
  const st = stars.reduce((a, b) => a + b, 0), cleared = stars.filter(x => x > 0).length, sec = Math.round(s.playSec);
  const score = calcScore(st, s.miss, sec, cleared), grade = gradeOf(cleared, st), at = new Date().toLocaleString('sv');
  const entry = { no: s.no, score, sec, stars: st, cleared, at };
  rollDay(); stats.list.push(entry); stats.lastNo = Math.max(stats.lastNo || 0, s.no);
  if (!stats.best || score > stats.best.score) stats.best = { score, at };
  saveStats(); drawStats();
  saveRecord({ '日時': at, '受付番号': s.no, '結果': result, 'クリアしたステージ数': cleared, '星': st, 'ミス': s.miss, '時間秒': sec,
    'スコア': score, '評価': grade.g, '星の内訳': stars.join('-'), '難易度': speedName() });
  const rk = ranked(), rank = rk.indexOf(entry) + 1;
  return { ...entry, entry, miss: s.miss, grade, rank, total: rk.length };
}
function goIdle() {
  releaseAll(); hideOverlay();
  mode = 'idle'; running = false; cur = null; session = null; stars.fill(0); renderProg();
  document.body.classList.add('idle');
  showMsg('EVの中を、電気になって旅しよう。');
  makeControls([{ label: 'ゲームを始める（タップ／Enter）', cls: 'primary big', fn: startSession }]);
  $('idlePanel').style.display = ''; drawIdlePanel();
  demoK = -1; demoT = 0; demoEndT = 0;
}
function drawIdlePanel() {
  $('idleRank').innerHTML = rankingHtml(null);
  $('idleBest').textContent = stats.best ? `これまでの最高：${stats.best.score} 点（${stats.best.at.slice(5, 10).replace('-', '/')}）` : 'これまでの最高：まだ記録がありません';
  $('idleCount').textContent = `本日の挑戦者 ${stats.list.length} 人`;
}

/* ---------- 待機中の見どころデモ（各ステージを自動で少しずつ見せる） ---------- */
const TITLE_SEC = 4, DEMO_SEC = 9;
let demoK = -1, demoT = 0, demoEndT = 0;   // demoK = -1 はタイトルの絵
const DEMO = [
  (s, t) => {   // S1：− → プリチャージ → 電圧がそろったらメイン → プリチャージを開く
    if (!s.neg && t > 0.8) s.toggle('neg');
    else if (s.neg && !s.pre && !s.pos && t > 1.6) s.toggle('pre');
    else if (s.pre && !s.pos && s.v >= 365) s.toggle('pos');
    else if (s.pre && s.pos && s.v >= 392) s.toggle('pre');
  },
  (s) => {      // S2：いちばん低いセルより高いセルを放電
    if ((s.dk = (s.dk || 0) + 1) % 10) return;
    const mn = Math.min(...s.cells.map(c => c.v));
    s.cells.forEach((c, i) => { const want = !c.lock && c.v - mn > 0.02; if (want !== c.bleed) s.toggle(i); });
  },
  (s) => {      // S3：金色の枠どおりにスイッチを入れる（先に OFF、あとで ON）
    const n = CFG[s.sector()], want = i => i === n[0] || i === n[1] + 3;
    for (let i = 0; i < 6; i++) if (s.on[i] && !want(i)) s.toggle(i);
    for (let i = 0; i < 6; i++) if (!s.on[i] && want(i)) s.toggle(i);
  },
  (s) => { if (!s.reg && s.v > 0.5 && s.predict() >= s.LINE - s.ZONE * 0.45) s.reg = true; },   // S4
  (s) => { if (s.phase === 'wait' && s.t > 1.6) s.answer(s.order[s.i][2]); },                    // S5
  (s) => {      // S6：電圧と温度を見て電流を上げ下げ
    if ((s.dk = (s.dk || 0) + 1) % 15) return;
    if (s.V > 4.12 || s.T > 41) s.adj(-10); else if (s.V < 4.05 && s.T < 37 && s.I < 90) s.adj(10);   // 100 A 以上を続けると 50℃ を超える
  }
];
function nextDemo() {
  demoK++; if (demoK >= stages.length) demoK = -1;
  demoT = 0; demoEndT = 0;
  if (demoK >= 0) { cur = stages[demoK]; cur.start(); running = true; } else { cur = null; running = false; }
}
function demoEnd() { running = false; demoEndT = demoT + 1.5; }
function demoStep(dt) {
  demoT += dt;
  if (demoK < 0) { if (demoT >= TITLE_SEC) nextDemo(); return; }
  if (running) { DEMO[demoK](cur, demoT); if (running) cur.tick(dt); }
  if ((demoEndT && demoT >= demoEndT) || demoT >= DEMO_SEC) nextDemo();
}
function drawDemoBand() {
  g.fillStyle = 'rgba(16,38,58,.82)'; g.fillRect(0, H - 66, W, 66);
  const lab = demoK < 0 ? '6つのステージで、EVの中の仕事を体験しよう' : `見どころ ${demoK + 1}/6　${stages[demoK].title.replace(/^ステージ\d+\s*/, '')}`;
  txt(lab, 22, H - 44, 19, '#ffffff', 'left', true);
  if (demoK >= 0) txt('（自動でプレイしている見本）', W - 18, H - 44, 13, '#c8d6e4', 'right');
  const a = 0.55 + 0.45 * Math.sin(performance.now() / 300);
  txt('タップ／クリック／Enter で はじめる', 22, H - 18, 17, `rgba(120,232,190,${a.toFixed(2)})`, 'left', true);
}

/* ---------- 設定（S キー、または右上の ⚙。タッチ端末は ⚙ を1秒長押し） ---------- */
const SKEY = 'evx.settings', STATKEY = 'evx.stats';
const DEF = { idle: 60, result: 30, sound: true, vol: 70, speed: 1 };
const SPEEDS = { 1: 'ふつう', 0.8: 'ゆっくり', 0.65: 'とてもゆっくり' };
const speedName = () => SPEEDS[settings.speed] || String(settings.speed);
function load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } }
const settings = Object.assign({}, DEF, load(SKEY));
if (!SPEEDS[settings.speed]) settings.speed = 1;
const stats = Object.assign({ day: '', list: [], best: null, resetAt: '', lastNo: 0 }, load(STATKEY));   // lastNo = 本日の受付番号の最後（集計のリセットでは戻さない）
function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} }
function saveStats() { try { localStorage.setItem(STATKEY, JSON.stringify(stats)); } catch {} }
const today = () => new Date().toLocaleDateString('sv');   // YYYY-MM-DD
function rollDay() { if (stats.day !== today()) { stats.day = today(); stats.list = []; stats.lastNo = 0; saveStats(); return true; } return false; }
const settingsOpen = () => $('settings').classList.contains('show');
function toggleSettings(show) {
  const on = show === undefined ? !settingsOpen() : show;
  $('settings').classList.toggle('show', on);
  if (on) drawStats();
  lastAct = performance.now();
}
function bindSettings() {
  $('setIdle').value = settings.idle; $('setResult').value = settings.result; $('setSound').checked = settings.sound;
  $('setVol').value = settings.vol; $('setSpeed').value = String(settings.speed);
  const upd = () => {
    settings.idle = Math.max(15, parseInt($('setIdle').value) || DEF.idle);
    settings.result = Math.max(5, parseInt($('setResult').value) || DEF.result);
    settings.sound = $('setSound').checked; settings.vol = parseInt($('setVol').value);
    settings.speed = parseFloat($('setSpeed').value) || 1;
    $('volVal').textContent = settings.vol + '%';
    sfx.on = settings.sound; sfx.vol = settings.vol / 100;
    saveSettings();
  };
  ['setIdle', 'setResult', 'setSound', 'setVol', 'setSpeed'].forEach(id => $(id).addEventListener(['setSpeed', 'setIdle', 'setResult'].includes(id) ? 'change' : 'input', upd));
  $('setVol').addEventListener('change', () => sfx.clear());   // 音量を変えたら試しに鳴らす
  upd();
}
function drawStats() {
  const st = { none: '記録: 未設定', prompt: '記録: 許可待ち（画面をクリック）', ok: `記録: ${records.name}`, error: '記録: 読めません' }[records.state];
  $('stRec').textContent = st; $('stRec').className = records.state === 'ok' ? 'ok' : records.state === 'none' ? '' : 'ng';
  $('stStats').textContent = `本日 ${stats.list.length} 人`;
  $('recName').textContent = records.name || '未設定';
  $('recState').textContent = { none: '', prompt: '（許可待ち）', ok: `（${records.rows.length} 件）`, error: '（読めません: ' + (records.error || '') + '）' }[records.state];
  $('statsDetail').textContent = `本日の挑戦 ${stats.list.length} 人、全クリア ${stats.list.filter(e => e.cleared === 6).length} 人、最高 ${stats.best ? stats.best.score + ' 点' : '–'}` + (stats.resetAt ? `（${stats.resetAt} にリセット）` : '');
  if (mode === 'idle') drawIdlePanel();
}

/* ---------- 記録フォルダ（records.csv） ---------- */
function showError(m) { const e = $('error'); e.textContent = '⚠ ' + m + '（タップで閉じる）'; e.style.display = 'block'; console.error(m); }
const records = new Records({
  cols: ['日時', '受付番号', '結果', 'クリアしたステージ数', '星', 'ミス', '時間秒', 'スコア', '評価', '星の内訳', '難易度'],
  db: 'ev-inside-game', lkey: 'evx.records', pickerId: 'ev-inside-records',
  local: location.protocol === 'file:'   // index.html を直接開いたときは、フォルダを使わずブラウザ内に残す
});
// 記録から本日のランキングと集計を作り直す（集計のリセットより前の行は数えない）
function applyRecords() {
  if (records.state !== 'ok') return;
  const rows = records.rows.filter(r => (r['日時'] || '') >= stats.resetAt && !isNaN(parseInt(r['スコア'])));
  const num = v => parseInt(v) || 0;
  if (stats.day !== today()) stats.lastNo = 0;
  stats.day = today();
  for (const r of records.rows) if ((r['日時'] || '').startsWith(today())) stats.lastNo = Math.max(stats.lastNo || 0, parseInt(r['受付番号']) || 0);
  stats.list = rows.filter(r => r['日時'].startsWith(today())).map(r => ({ no: num(r['受付番号']), score: num(r['スコア']), sec: num(r['時間秒']), stars: num(r['星']), cleared: num(r['クリアしたステージ数']), at: r['日時'] }));
  stats.best = null;
  for (const r of rows) if (!stats.best || num(r['スコア']) > stats.best.score) stats.best = { score: num(r['スコア']), at: r['日時'] };
  saveStats(); drawStats();
}
async function recordsGrant() { if (records.state === 'prompt' && await records.grant()) applyRecords(); drawStats(); }
async function saveRecord(rec) {
  try { if (!(await records.append(rec)) && records.state !== 'none') console.warn('記録フォルダに書けません（許可待ち）'); }
  catch (e) { showError('記録を保存できません: ' + e.message); }
  drawStats();
}
function bindRecords() {
  if (!records.supported) {
    $('btnRecPick').textContent = 'records.csv を書き出す';
    $('recNote').textContent = location.protocol === 'file:'
      ? 'index.html を直接開いているので、記録はこのブラウザの中に残します。フォルダに保存したいときは「起動.bat」（Mac は「起動_Mac.command」）から開いてください。'
      : 'このブラウザ（Safari など）はフォルダを選べないので、記録はブラウザの中に残します。「records.csv を書き出す」でファイルにできます。';
  }
  $('btnRecPick').onclick = async () => {
    if (!records.supported) return records.download();
    try { await records.pick(); applyRecords(); } catch (e) { if (e.name !== 'AbortError') showError('フォルダを使えません: ' + e.message); }
    drawStats();
  };
  $('btnRecLoad').onclick = async () => {
    try { if (records.state === 'prompt') await records.grant(); else if (records.state !== 'none') await records.load(); applyRecords(); } catch (e) { showError('記録を読めません: ' + e.message); }
    drawStats();
  };
  $('btnReset').onclick = () => {
    if (!confirm('本日の集計・ランキングと「これまでの最高」をリセットしますか？（records.csv は消えません）')) return;
    stats.list = []; stats.best = null; stats.resetAt = new Date().toLocaleString('sv'); stats.day = today();
    saveStats(); drawStats();
  };
}

/* ---------- 全画面 ---------- */
// 起動_全画面.bat / 起動_全画面_Mac.command で開いたとき（?fs=1）は、最初のクリック/キーで全画面にする（ブラウザの決まりで操作が必要）。
// 解除は Esc（ブラウザ標準）。もう一度全画面にするときは F キー。
const wantFs = new URLSearchParams(location.search).has('fs');
let fsDone = false;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function enterFullscreen() {
  const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) return;   // iPhone の Safari などは全画面にできない
  try { const p = fn.call(el); if (p && p.catch) p.catch(e => console.warn('全画面にできません: ' + e.message)); } catch (e) { console.warn(e); }
}
function exitFullscreen() { const fn = document.exitFullscreen || document.webkitExitFullscreen; if (fn) fn.call(document); }
function updateFsHint() { $('fsHint').style.display = wantFs && !fsDone && !fsEl() ? 'block' : 'none'; }
const autoFs = e => {
  if (!wantFs || fsDone || fsEl() || (e.target.closest && e.target.closest('#fsBtn'))) return;
  if (e.type === 'keydown' && ['Escape', 'f', 'F'].includes(e.key)) return;
  fsDone = true; enterFullscreen(); updateFsHint();
};
document.addEventListener('pointerdown', autoFs); document.addEventListener('keydown', autoFs);
const onFsChange = () => { if (fsEl()) fsDone = true; updateFsHint(); };
document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange);
// 全画面ボタン：押すたびに全画面 ⇔ 元に戻す。全画面にできないブラウザ（iPhone の Safari など）では出さない
const fsOK = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
function updateFsBtn() { const b = $('fsBtn'); b.hidden = !fsOK; b.textContent = fsEl() ? '全画面をやめる' : '⛶ 全画面'; }
$('fsBtn').addEventListener('click', e => { e.stopPropagation(); e.currentTarget.blur(); fsDone = true; if (fsEl()) exitFullscreen(); else enterFullscreen(); });
document.addEventListener('fullscreenchange', updateFsBtn); document.addEventListener('webkitfullscreenchange', updateFsBtn);
updateFsBtn();

/* ---------- 入力・ループ ---------- */
const unlock = () => { sfx.unlock(); lastAct = performance.now(); };
document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true); document.addEventListener('touchend', () => sfx.unlock(), true);
// ブラウザを開き直したあと、最初の操作で記録フォルダへの書き込みを許可してもらう
document.addEventListener('pointerdown', recordsGrant); document.addEventListener('keydown', recordsGrant);
// 待機中は画面のどこを押しても始まる（⚙・設定・下の状態表示は除く）
document.addEventListener('click', e => {   // pointerdown で始めると、指を離したときの click が説明の「スタート」に当たるため click で受ける
  if (mode !== 'idle' || settingsOpen() || e.target.closest('#gear, #fsBtn, #settings, #status, #error, #overlay')) return;
  e.preventDefault(); sfx.button(); startSession();
});
cv.addEventListener('pointerdown', e => { if (mode === 'play' && cur && cur.pointer) cur.pointer(e); });
// ⚙：マウスはクリック、タッチは1秒長押し（お客さんが触って開かないように）
let gearTimer = 0, gearType = 'mouse';
$('gear').addEventListener('pointerdown', e => {
  gearType = e.pointerType; if (gearType === 'mouse') return;
  $('gear').classList.add('holding'); gearTimer = setTimeout(() => { $('gear').classList.remove('holding'); sfx.button(); toggleSettings(); }, 1000);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => $('gear').addEventListener(ev, () => { clearTimeout(gearTimer); $('gear').classList.remove('holding'); }));
$('gear').addEventListener('click', () => { if (gearType === 'mouse') toggleSettings(); });
$('gear').addEventListener('contextmenu', e => e.preventDefault());
$('btnClose').onclick = () => toggleSettings(false);
// 共通のキー（ステージのキーより先に見る）
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const inSettings = e.target && e.target.closest && e.target.closest('#settings');
  if (e.key === 'Escape') { if (fsEl()) exitFullscreen(); else if (settingsOpen()) toggleSettings(false); return; }
  if (inSettings) return;   // 設定の入力欄に打っているとき
  const playing = mode === 'play' && running;
  if ((e.key === 'f' || e.key === 'F') && !e.repeat) { fsDone = true; enterFullscreen(); updateFsHint(); return; }
  if ((e.key === 's' || e.key === 'S') && !playing && !e.repeat) { toggleSettings(); return; }   // ステージ3では S = V 下なので、遊んでいる間は開かない
  if (mode === 'idle' && !settingsOpen() && (e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); sfx.button(); startSession(); }
});
addEventListener('keydown', e => {
  if (mode !== 'play' || !running || !cur || !cur.key || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && e.target.closest && e.target.closest('#settings')) return;
  const k = keyName(e); if (k) { cur.key(k); e.preventDefault(); }
});
addEventListener('keyup', e => { if (mode !== 'play' || !running || !cur || !cur.keyup) return; const k = keyName(e); if (k) cur.keyup(k); });
function releaseAll() { if (cur && cur.release) cur.release(); }
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', releaseAll);
function keyName(e) {
  const m = /^(?:Key|Digit|Numpad)(.)$/.exec(e.code); if (m) return m[1].toLowerCase();
  return { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'space' }[e.code];
}
function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts;
  const now = performance.now();
  if (mode === 'idle') { demoStep(dt); if (now - dayCheckAt > 30000) { dayCheckAt = now; if (rollDay()) drawStats(); } }
  else if (running && cur) { session.playSec += dt * settings.speed; cur.tick(dt * settings.speed); }   // 難易度「ゆっくり」はゲームの時間をゆっくり進める（プレイ時間もゲームの時間で数える）
  g.setLineDash([]); g.lineCap = 'butt';
  if (cur) { g.fillStyle = '#f7f9fc'; g.fillRect(0, 0, W, H); cur.draw(); } else drawTitle();
  if (mode === 'idle') drawDemoBand();
  // 放置で待機画面へ（設定を開いている間は戻らない）
  if (mode !== 'idle' && !settingsOpen()) {
    if (mode === 'result') {
      const left = Math.ceil(settings.result - (now - resultAt) / 1000), b = $('backIn');
      if (b) b.textContent = `${Math.max(0, left)} 秒後にタイトルへ戻ります`;
      if (left <= 0) goIdle();
    } else if (now - lastAct > settings.idle * 1000) {
      if (session) endSession('放置で終了');
      goIdle();
    }
  }
  requestAnimationFrame(loop);
}

/* ---------- 起動 ---------- */
bindSettings(); bindRecords(); rollDay(); updateFsHint();
goIdle(); drawStats(); requestAnimationFrame(loop);
records.restore().then(() => { applyRecords(); drawStats(); }).catch(e => { console.warn('記録フォルダを読めません: ' + e.message); drawStats(); });

// テスト用
window.__dbg = { get mode() { return mode; }, get session() { return session; }, stats, settings, records, stages, stars, startSession, finale, goIdle };
