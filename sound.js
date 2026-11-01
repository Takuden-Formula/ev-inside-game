// 効果音（Web Audio でその場で合成。音声ファイルは使わない）
// ボタン・ステージ移動・クリア・ミス・注意・正解・ゴール（全クリア）。
// ブラウザの決まりで、最初のタップ／クリック／キーのときに unlock() を呼んで音を出せるようにする（iPad の Safari も同じ）。
(function () {
  'use strict';
  class Sfx {
    constructor() { this.ctx = null; this.on = true; this.vol = 0.7; }
    unlock() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AC();
          this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        } catch { this.ctx = null; return; }
      }
      if (this.ctx.state !== 'running') { try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch {} }
    }
    ready() {
      if (!this.on || !this.ctx) return false;
      this.master.gain.value = this.vol;
      return true;
    }
    // 1音。f→f2 へ音程を動かす。type: sine / square / triangle / sawtooth
    tone(f, dur, o = {}) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0), osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      const v = o.vol ?? 0.25;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + 0.03);
    }
    // 短いノイズ（「シュッ」）
    noise(dur, o = {}) {
      if (!this.ready()) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = c.createBufferSource(); n.buffer = buf;
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.Q.value = o.q || 1;
      b.frequency.setValueAtTime(o.f || 800, t); if (o.f2) b.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(o.vol ?? 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(b); b.connect(g); g.connect(this.master); n.start(t); n.stop(t + dur + 0.03);
    }
    button() { this.tone(1046, 0.06, { type: 'triangle', vol: 0.18 }); }
    // ステージ移動（説明の画面が出るとき）：「シュッ」と上がる2音
    move() { this.noise(0.25, { f: 500, f2: 3000, q: 2, vol: 0.12 }); this.tone(587, 0.12, { type: 'triangle', vol: 0.18, delay: 0.05 }); this.tone(880, 0.18, { type: 'triangle', vol: 0.2, delay: 0.15 }); }
    // 小さな正解（CAN の仕分けなど）
    ok() { this.tone(988, 0.09, { type: 'square', vol: 0.09 }); this.tone(1319, 0.16, { type: 'square', vol: 0.09, delay: 0.08 }); }
    // 注意（保護が働いた・ショートなど）
    warn() { this.tone(740, 0.1, { type: 'square', vol: 0.1 }); this.tone(740, 0.1, { type: 'square', vol: 0.1, delay: 0.16 }); }
    // ミス・失敗：下がるブザー
    miss() { this.tone(220, 0.35, { type: 'sawtooth', f2: 110, vol: 0.16 }); this.tone(233, 0.35, { type: 'square', f2: 116, vol: 0.06 }); }
    // ステージクリア：ド・ミ・ソ・ド
    clear() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.4 : 0.14, { type: 'square', vol: 0.11, delay: i * 0.1 })); }
    // ゴール（全ステージ）：ファンファーレ＋和音
    goal() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.7 : 0.22, { type: 'square', vol: 0.11, delay: i * 0.14 }));
      [523, 659, 784].forEach((f) => this.tone(f, 1.2, { type: 'triangle', vol: 0.1, delay: 0.84 }));
    }
  }
  window.sfx = new Sfx();
})();
