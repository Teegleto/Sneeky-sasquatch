/* Sneeky Sasquatch - core helpers: math, random, input, audio */
'use strict';
var SS = window.SS = window.SS || {};

(function () {
  var TAU = Math.PI * 2;
  SS.TAU = TAU;
  SS.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  SS.lerp = function (a, b, t) { return a + (b - a) * t; };
  SS.dist = function (ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); };
  SS.angDiff = function (a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  };
  SS.approachAngle = function (a, b, step) {
    var d = SS.angDiff(a, b);
    if (Math.abs(d) <= step) return b;
    return a + Math.sign(d) * step;
  };

  // Seeded random (mulberry32)
  SS.rng = function (seed) {
    var s = seed >>> 0;
    var r = function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    r.range = function (a, b) { return a + r() * (b - a); };
    r.int = function (a, b) { return Math.floor(a + r() * (b - a + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.chance = function (p) { return r() < p; };
    r.weighted = function (list) { // [[value, weight], ...]
      var total = 0, i;
      for (i = 0; i < list.length; i++) total += list[i][1];
      var x = r() * total;
      for (i = 0; i < list.length; i++) { x -= list[i][1]; if (x <= 0) return list[i][0]; }
      return list[list.length - 1][0];
    };
    return r;
  };
  SS.rand = SS.rng((Date.now() ^ 0x5eed) >>> 0);

  // ---------- geometry ----------
  SS.distToSeg = function (px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var l2 = dx * dx + dy * dy;
    var t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  SS.distToPolyline = function (px, py, pts) {
    var best = Infinity;
    for (var i = 0; i < pts.length - 1; i++) {
      var d = SS.distToSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (d < best) best = d;
    }
    return best;
  };
  SS.segCircle = function (ax, ay, bx, by, cx, cy, r) {
    return SS.distToSeg(cx, cy, ax, ay, bx, by) < r;
  };
  SS.segRect = function (ax, ay, bx, by, x0, y0, x1, y1) {
    // Liang-Barsky clip
    var t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay;
    var p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  };
  // Catmull-Rom smoothing of a polyline into a dense one
  SS.smoothPath = function (pts, steps) {
    steps = steps || 8;
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var s = 0; s < steps; s++) {
        var t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };

  SS.fmtTime = function (minutes) {
    var m = Math.floor(minutes % 1440);
    var h = Math.floor(m / 60), mm = m % 60;
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  };

  // ---------- input ----------
  var input = SS.input = {
    keys: {}, pressed: {}, released: {},
    joy: { x: 0, y: 0, active: false, id: null, bx: 0, by: 0 },
    touchRun: false, touchAction: false, touchActionPressed: false,
    pointer: { x: 0, y: 0, down: false, pressed: false, released: false },
    isTouch: false,
    enabled: true
  };
  var gameKeys = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, Tab: 1 };
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
    // let Space/Enter press a focused dialogue choice; otherwise they're game keys
    if (gameKeys[e.code] && !(e.target && e.target.closest && e.target.closest('#dialog button'))) e.preventDefault();
    if (SS.audio) SS.audio.unlock();
  });
  window.addEventListener('keyup', function (e) {
    input.keys[e.code] = false;
    input.released[e.code] = true;
  });
  window.addEventListener('blur', function () { input.keys = {}; input.touchRun = false; input.touchAction = false; });

  input.down = function () {
    for (var i = 0; i < arguments.length; i++) if (input.keys[arguments[i]]) return true;
    return false;
  };
  input.hit = function () {
    for (var i = 0; i < arguments.length; i++) if (input.pressed[arguments[i]]) return true;
    return false;
  };
  input.axis = function () {
    var x = 0, y = 0;
    if (input.down('KeyA', 'ArrowLeft')) x -= 1;
    if (input.down('KeyD', 'ArrowRight')) x += 1;
    if (input.down('KeyW', 'ArrowUp')) y -= 1;
    if (input.down('KeyS', 'ArrowDown')) y += 1;
    if (x || y) { var l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    if (input.joy.active) {
      var jl = Math.hypot(input.joy.x, input.joy.y);
      // unit direction plus a separate magnitude, so a half-tilted stick means half speed
      if (jl > 0.15) return { x: input.joy.x / jl, y: input.joy.y / jl, mag: SS.clamp((jl - 0.1) / 0.6, 0.3, 1) };
    }
    return { x: 0, y: 0 };
  };
  input.running = function () { return input.down('ShiftLeft', 'ShiftRight') || input.touchRun; };
  input.actionPressed = function () { return input.hit('KeyE', 'Space', 'Enter') || input.touchActionPressed; };
  input.actionHeld = function () { return input.down('KeyE', 'Space', 'Enter') || input.touchAction || input.pointer.down; };
  input.endFrame = function () {
    input.pressed = {}; input.released = {};
    input.touchActionPressed = false;
    input.pointer.pressed = false; input.pointer.released = false;
  };

  // Touch joystick + buttons are wired in SS.setupTouch (called by UI once DOM exists)
  SS.setupTouch = function (root) {
    var joyEl = document.getElementById('joy');
    var knob = document.getElementById('joyKnob');
    var R = 52;
    function setKnob() {
      knob.style.transform = 'translate(' + (input.joy.x * R) + 'px,' + (input.joy.y * R) + 'px)';
    }
    function markTouch() {
      if (!input.isTouch) { input.isTouch = true; document.body.classList.add('touch'); }
    }
    root.addEventListener('touchstart', function (e) {
      markTouch();
      if (SS.audio) SS.audio.unlock();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (e.target.closest && e.target.closest('.ui, button, .slot, .tbtn')) continue;
        if (input.joy.id === null && t.clientX < window.innerWidth * 0.5 && SS.game && SS.game.mode === 'play') {
          input.joy.id = t.identifier; input.joy.active = true;
          input.joy.bx = t.clientX; input.joy.by = t.clientY;
          joyEl.style.left = (t.clientX - 60) + 'px';
          joyEl.style.top = (t.clientY - 60) + 'px';
          joyEl.classList.add('on');
          input.joy.x = 0; input.joy.y = 0; setKnob();
        }
      }
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === input.joy.id) {
          var dx = (t.clientX - input.joy.bx) / R, dy = (t.clientY - input.joy.by) / R;
          var l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          input.joy.x = dx; input.joy.y = dy; setKnob();
        }
      }
    }, { passive: true });
    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === input.joy.id) {
          input.joy.id = null; input.joy.active = false; input.joy.x = 0; input.joy.y = 0;
          joyEl.classList.remove('on'); setKnob();
        }
      }
    }
    root.addEventListener('touchend', endTouch);
    root.addEventListener('touchcancel', endTouch);

    function holdButton(el, onDown, onUp) {
      el.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); markTouch(); if (SS.audio) SS.audio.unlock(); el.classList.add('held'); onDown(); }, { passive: false });
      el.addEventListener('touchend', function (e) { e.preventDefault(); el.classList.remove('held'); onUp(); }, { passive: false });
      el.addEventListener('touchcancel', function () { el.classList.remove('held'); onUp(); });
      el.addEventListener('mousedown', function (e) { e.preventDefault(); onDown(); });
      el.addEventListener('mouseup', function () { onUp(); });
      el.addEventListener('mouseleave', function () { onUp(); });
    }
    holdButton(document.getElementById('btnAction'),
      function () { input.touchAction = true; input.touchActionPressed = true; },
      function () { input.touchAction = false; });
    holdButton(document.getElementById('btnRun'),
      function () { input.touchRun = true; },
      function () { input.touchRun = false; });
  };

  // ---------- audio (procedural, WebAudio) ----------
  var audio = SS.audio = {
    ctx: null, master: null, sfx: null, music: null,
    sfxOn: true, musicOn: true, mode: 'none', _next: 0, _step: 0, _timer: null,
    unlock: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) { return; }
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 0.55 : 0; this.sfx.connect(this.master);
      this.music = this.ctx.createGain(); this.music.gain.value = this.musicOn ? 0.22 : 0; this.music.connect(this.master);
      var buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      var self = this;
      this._timer = setInterval(function () { self._schedule(); }, 30);
    },
    setSfx: function (on) { this.sfxOn = on; if (this.sfx) this.sfx.gain.value = on ? 0.55 : 0; },
    setMusicOn: function (on) { this.musicOn = on; if (this.music) this.music.gain.value = on ? 0.22 : 0; },
    tone: function (freq, dur, o) {
      o = o || {};
      if (!this.ctx || (!o.dest && !this.sfxOn)) return;
      var t = this.ctx.currentTime + (o.delay || 0);
      var osc = this.ctx.createOscillator(), g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + o.slide), t + dur);
      if (o.vib) {
        var lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        lfo.frequency.value = o.vib; lg.gain.value = o.vibAmt || 30;
        lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      var v = (o.vol === undefined ? 0.2 : o.vol);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.dest || this.sfx);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise: function (dur, o) {
      o = o || {};
      if (!this.ctx || (!o.dest && !this.sfxOn)) return;
      var t = this.ctx.currentTime + (o.delay || 0);
      var src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
      var f = this.ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 1;
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      var g = this.ctx.createGain();
      var v = o.vol === undefined ? 0.3 : o.vol;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.dest || this.sfx);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },
    play: function (name) {
      if (!this.ctx || !this.sfxOn) return;
      var a = this;
      switch (name) {
        case 'pickup': a.tone(660, 0.08, { type: 'triangle', vol: 0.25 }); a.tone(990, 0.12, { type: 'triangle', vol: 0.25, delay: 0.07 }); break;
        case 'eat': for (var i = 0; i < 3; i++) a.noise(0.07, { freq: 900 + i * 200, vol: 0.35, delay: i * 0.11, filter: 'bandpass', q: 2 }); break;
        case 'drink': a.tone(400, 0.25, { type: 'sine', slide: 300, vol: 0.2 }); a.tone(500, 0.2, { type: 'sine', slide: 350, vol: 0.15, delay: 0.22 }); break;
        case 'scream': a.tone(880, 0.55, { type: 'sawtooth', slide: -300, vol: 0.12, vib: 14, vibAmt: 60 }); a.tone(1180, 0.5, { type: 'square', slide: -400, vol: 0.05, vib: 11, vibAmt: 50, delay: 0.05 }); break;
        case 'huh': a.tone(300, 0.12, { type: 'triangle', slide: 120, vol: 0.18 }); break;
        case 'alert': a.tone(880, 0.09, { vol: 0.15 }); a.tone(1320, 0.16, { vol: 0.15, delay: 0.09 }); break;
        case 'whistle': a.tone(2100, 0.18, { type: 'sine', vol: 0.18, vib: 30, vibAmt: 120 }); a.tone(2100, 0.35, { type: 'sine', vol: 0.18, vib: 30, vibAmt: 120, delay: 0.22 }); break;
        case 'caught': [523, 392, 330, 262].forEach(function (f, i) { a.tone(f, 0.22, { type: 'triangle', vol: 0.22, delay: i * 0.16 }); }); break;
        case 'splash': a.noise(0.35, { freq: 2500, sweep: 400, vol: 0.3 }); break;
        case 'cast': a.noise(0.25, { filter: 'bandpass', freq: 3000, sweep: 800, vol: 0.18 }); break;
        case 'bite': a.tone(1200, 0.06, { type: 'square', vol: 0.15 }); a.tone(1500, 0.08, { type: 'square', vol: 0.15, delay: 0.07 }); break;
        case 'nibble': a.noise(0.05, { freq: 1500, vol: 0.12 }); break;
        case 'reel': a.noise(0.03, { filter: 'highpass', freq: 3000, vol: 0.08 }); break;
        case 'catch': [523, 659, 784, 1046].forEach(function (f, i) { a.tone(f, 0.12, { type: 'triangle', vol: 0.22, delay: i * 0.07 }); }); break;
        case 'lose': a.tone(330, 0.25, { type: 'triangle', slide: -150, vol: 0.2 }); break;
        case 'coin': a.tone(988, 0.07, { type: 'square', vol: 0.12 }); a.tone(1319, 0.22, { type: 'square', vol: 0.12, delay: 0.07 }); break;
        case 'door': a.tone(1319, 0.5, { type: 'sine', vol: 0.15 }); a.tone(1760, 0.6, { type: 'sine', vol: 0.12, delay: 0.12 }); break;
        case 'quest': [523, 659, 784, 1046, 1319].forEach(function (f, i) { a.tone(f, 0.18, { type: 'triangle', vol: 0.2, delay: i * 0.09 }); }); a.tone(1568, 0.5, { type: 'sine', vol: 0.15, delay: 0.45 }); break;
        case 'hit': a.noise(0.06, { filter: 'highpass', freq: 2000, vol: 0.4 }); a.tone(700, 0.08, { type: 'triangle', vol: 0.2 }); break;
        case 'putt': a.tone(900, 0.05, { type: 'triangle', vol: 0.2 }); break;
        case 'cup': a.tone(600, 0.08, { type: 'sine', vol: 0.3 }); a.tone(400, 0.15, { type: 'sine', vol: 0.3, delay: 0.08 }); break;
        case 'rustle': a.noise(0.22, { filter: 'bandpass', freq: 2200, q: 0.7, vol: 0.18 }); break;
        case 'trash': for (var j = 0; j < 4; j++) a.noise(0.06, { filter: 'bandpass', freq: 3000 + Math.random() * 2000, q: 8, vol: 0.25, delay: j * 0.13 }); break;
        case 'engine': a.tone(80, 0.5, { type: 'sawtooth', slide: 90, vol: 0.12 }); break;
        case 'sleep': [392, 330, 262, 196].forEach(function (f, i) { a.tone(f, 0.5, { type: 'sine', vol: 0.18, delay: i * 0.3 }); }); break;
        case 'deny': a.tone(140, 0.18, { type: 'square', vol: 0.12 }); break;
        case 'ui': a.tone(1000, 0.04, { type: 'triangle', vol: 0.12 }); break;
        case 'grab': a.tone(500, 0.06, { type: 'triangle', vol: 0.2, slide: 300 }); break;
        case 'win': [523, 659, 784, 659, 784, 1046].forEach(function (f, i) { a.tone(f, 0.2, { type: 'square', vol: 0.12, delay: i * 0.13 }); }); break;
      }
    },
    setMusic: function (mode) {
      if (this.mode === mode) return;
      this.mode = mode; this._step = 0;
      if (this.ctx) this._next = this.ctx.currentTime + 0.1;
    },
    // A tiny generative sequencer: cheerful by day, sparse at night, tense when chased.
    _schedule: function () {
      if (!this.ctx || this.mode === 'none') return;
      var now = this.ctx.currentTime;
      // don't build oscillators nobody will hear
      if (!this.musicOn || document.hidden || this.ctx.state !== 'running') { this._next = now + 0.1; return; }
      if (this._next < now) this._next = now + 0.05;
      var modes = {
        day: { bpm: 104, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [0, -3, 5, 7], root: 60 },
        title: { bpm: 96, scale: [0, 2, 4, 7, 9, 12, 14, 16], chords: [0, 5, -3, 7], root: 62 },
        night: { bpm: 66, scale: [0, 3, 5, 7, 10, 12], chords: [0, -4, -2, -5], root: 57 },
        chase: { bpm: 152, scale: [0, 1, 3, 5, 7, 8], chords: [0, 0, 1, -2], root: 52 },
        golf: { bpm: 112, scale: [0, 2, 4, 5, 7, 9, 11, 12], chords: [0, 5, 2, 7], root: 65 }
      };
      var m = modes[this.mode]; if (!m) return;
      var stepDur = 60 / m.bpm / 2;
      while (this._next < now + 0.2) {
        var s = this._step, t = this._next - now;
        var bar = Math.floor(s / 8) % 4, beat = s % 8;
        var chord = m.chords[bar];
        var mf = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
        var md = this.music;
        if (this.mode === 'chase') {
          this.tone(mf(m.root - 12 + chord + (beat % 2 ? 7 : 0)), stepDur * 0.9, { type: 'sawtooth', vol: 0.16, delay: t, dest: md });
          if (beat === 0 || beat === 4) this.noise(0.08, { freq: 200, vol: 0.5, delay: t, dest: md });
          if (beat === 2 || beat === 6) this.noise(0.05, { filter: 'highpass', freq: 5000, vol: 0.15, delay: t, dest: md });
          if (beat % 2 === 0) { var hn = m.scale[(s * 3 + bar) % m.scale.length]; this.tone(mf(m.root + 12 + chord + hn), stepDur * 0.5, { type: 'square', vol: 0.05, delay: t, dest: md }); }
        } else if (this.mode === 'night') {
          if (beat === 0) this.tone(mf(m.root - 12 + chord), stepDur * 7, { type: 'sine', vol: 0.16, delay: t, dest: md, attack: 0.2 });
          var hash = Math.sin(s * 12.9898 + bar * 78.233) * 43758.5453; hash -= Math.floor(hash);
          if (hash < 0.35) this.tone(mf(m.root + 12 + chord + m.scale[Math.floor(hash * 100) % m.scale.length]), stepDur * 3, { type: 'sine', vol: 0.07, delay: t, dest: md, attack: 0.05 });
          if (hash > 0.8) this.tone(4200 + hash * 600, 0.04, { type: 'sine', vol: 0.03, delay: t, dest: md });
        } else {
          if (beat === 0 || beat === 4) this.tone(mf(m.root - 12 + chord), stepDur * 1.8, { type: 'triangle', vol: 0.2, delay: t, dest: md });
          if (beat === 2 || beat === 6) this.tone(mf(m.root - 5 + chord), stepDur * 0.8, { type: 'triangle', vol: 0.12, delay: t, dest: md });
          var h2 = Math.sin((s % 32) * 91.3458 + Math.floor(s / 32) % 2 * 17.1) * 24634.6345; h2 -= Math.floor(h2);
          if (h2 < 0.62) {
            var note = m.scale[Math.floor(h2 * 997) % m.scale.length];
            this.tone(mf(m.root + chord + note), stepDur * (h2 < 0.2 ? 1.8 : 0.9), { type: 'square', vol: 0.045, delay: t, dest: md });
          }
          if (beat % 2 === 1) this.noise(0.03, { filter: 'highpass', freq: 7000, vol: 0.05, delay: t, dest: md });
        }
        this._step++;
        this._next += stepDur;
      }
    }
  };
})();
