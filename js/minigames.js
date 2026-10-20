/* Sneeky Sasquatch - minigames: fishing (in the world) and the golf challenge (own scene) */
'use strict';
(function () {
  var W = SS.world, R = SS.R, input = SS.input;
  var clamp = SS.clamp, TAU = SS.TAU;

  // ================= FISHING =================
  var F = SS.Fishing = {};
  F.start = function (G, bx, by, kind) {
    var P = G.player;
    G.fishing = { phase: 'cast', t: 0, bx: bx, by: by, kind: kind, sx: P.x, sy: P.y - 30, nib: 0, dip: 0 };
    SS.audio.play('cast');
  };
  F.cancel = function (G, msg) {
    if (!G.fishing) return;
    G.fishing = null;
    if (msg) SS.ui.toast(msg);
  };
  F.rodTip = function (G) {
    var P = G.player, f = R.faceOf(P.dir);
    var dx = f === 'left' ? -22 : f === 'right' ? 22 : 10, dy = f === 'up' ? -52 : -40;
    return [P.x + dx, P.y + dy];
  };
  F.update = function (dt, G) {
    var f = G.fishing, P = G.player;
    if (!f) return;
    f.t += dt;
    var ax = input.axis();
    if ((ax.x || ax.y) && f.phase !== 'reel') { F.cancel(G, 'You reeled in your line.'); return; }
    var act = input.actionPressed() || input.pointer.pressed;
    switch (f.phase) {
      case 'cast':
        if (f.t > 0.45) {
          f.phase = 'wait'; f.t = 0;
          f.wait = SS.rand.range(3, 9) * (P.bait > 0 ? 0.5 : 1) * (P.gear.prorod ? 0.75 : 1);
          f.nib = SS.rand.range(0.8, 2);
          SS.audio.play('splash');
        }
        break;
      case 'wait':
        f.nib -= dt;
        if (f.nib <= 0) { f.dip = 0.35; f.nib = SS.rand.range(0.7, 2.2); SS.audio.play('nibble'); }
        if (f.dip > 0) f.dip -= dt;
        if (act && f.t > 0.3) { F.cancel(G, 'Too early! Wait for the bobber to dip.'); return; }
        if (f.t >= f.wait) { f.phase = 'bite'; f.t = 0; f.window = P.gear.prorod ? 1.15 : 0.9; SS.audio.play('bite'); }
        break;
      case 'bite':
        if (act) {
          var table = SS.FISH_TABLES[f.kind][G.dark > 0.35 ? 'night' : 'day'];
          var fish = SS.rand.weighted(table);
          if (fish === 'golden' && f.kind !== 'deep' && SS.rand() < 0.5) fish = 'bass';
          f.fish = fish; f.diff = SS.FISH[fish];
          f.phase = 'reel'; f.t = 0;
          f.zone = 0.1; f.zv = 0; f.zh = P.gear.prorod ? 0.33 : 0.25;
          f.fpos = 0.5; f.ftarget = 0.5; f.fchange = 0;
          f.prog = 0.3;
          if (P.bait > 0) P.bait--;
          SS.audio.play('reel');
        } else if (f.t > f.window) { F.cancel(G, 'It got away... press E faster when it bites!'); SS.audio.play('lose'); }
        break;
      case 'reel':
        var held = input.actionHeld();
        f.zv += (held ? 2.8 : -2.3) * dt;
        f.zv = clamp(f.zv, -1.4, 1.4);
        f.zone += f.zv * dt;
        if (f.zone < 0) { f.zone = 0; f.zv *= -0.25; }
        if (f.zone > 1 - f.zh) { f.zone = 1 - f.zh; f.zv *= -0.25; }
        f.fchange -= dt;
        if (f.fchange <= 0) { f.ftarget = SS.rand.range(0.03, 0.97); f.fchange = SS.rand.range(0.35, 1.7 - f.diff); }
        var spd = 0.22 + f.diff * 0.95;
        var d = f.ftarget - f.fpos;
        f.fpos += clamp(d, -spd * dt, spd * dt) + Math.sin(f.t * 17) * 0.002 * f.diff;
        f.fpos = clamp(f.fpos, 0, 1);
        var inZone = f.fpos >= f.zone && f.fpos <= f.zone + f.zh;
        f.inZone = inZone;
        f.prog += (inZone ? (0.34 - f.diff * 0.1) : -(0.16 + f.diff * 0.1)) * dt;
        if (Math.random() < dt * 8) SS.audio.play('reel');
        if (f.prog >= 1) {
          var name = SS.ITEMS[f.fish].name;
          if (P.add(f.fish, 1)) { SS.ui.toast('You caught a ' + name + '!', f.fish); G.stats.fish++; }
          else SS.ui.toast('You caught a ' + name + ', but your backpack is full. You let it go.');
          SS.audio.play('catch');
          G.fishing = null; SS.ui.refresh();
        } else if (f.prog <= 0) {
          F.cancel(G, 'The ' + SS.ITEMS[f.fish].name.toLowerCase() + ' got away!'); SS.audio.play('lose');
        }
        break;
    }
  };
  F.drawWorld = function (ctx, G, t) {
    var f = G.fishing;
    if (!f) return;
    var tip = F.rodTip(G), P = G.player;
    var bx = f.bx, by = f.by, bz = 0;
    if (f.phase === 'cast') { var k = clamp(f.t / 0.45, 0, 1); bx = tip[0] + (f.bx - tip[0]) * k; by = tip[1] + (f.by - tip[1]) * k + 0; bz = Math.sin(k * Math.PI) * 40; by -= bz; }
    // rod
    ctx.strokeStyle = P.gear.prorod ? '#2c3e50' : '#7a4f2a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(P.x + (tip[0] - P.x) * 0.3, P.y - 22); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    // line
    var dip = f.phase === 'bite' ? 5 + Math.sin(t * 30) * 2 : f.phase === 'reel' ? 4 : (f.dip > 0 ? 3 : Math.sin(t * 3) * 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.quadraticCurveTo((tip[0] + bx) / 2, Math.max(tip[1], by) + 10, bx, by + dip); ctx.stroke();
    if (f.phase !== 'cast') {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(t * 4) * 0.3) + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(bx, by + 2, 8 + Math.sin(t * 2) * 3, 3, 0, 0, TAU); ctx.stroke();
    }
    R.circ(ctx, bx, by + dip - 2, 4, '#e04040');
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 4, by + dip - 2, 8, 2.5);
  };
  F.drawUI = function (ctx, G, cam) {
    var f = G.fishing;
    if (!f) return;
    var P = G.player;
    var sx = (P.x - cam.x) * cam.scale, sy = (P.y - cam.y) * cam.scale;
    if (f.phase === 'bite') {
      ctx.save();
      ctx.font = 'bold 34px "Lilita One", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ffdf4a'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 5;
      var y = sy - 70 * cam.scale - Math.abs(Math.sin(f.t * 14)) * 6;
      ctx.strokeText('!', sx, y); ctx.fillText('!', sx, y);
      ctx.font = 'bold 16px Nunito, sans-serif';
      ctx.strokeText(input.isTouch ? 'TAP!' : 'PRESS E!', sx, y + 24); ctx.fillText(input.isTouch ? 'TAP!' : 'PRESS E!', sx, y + 24);
      ctx.restore();
    }
    if (f.phase !== 'reel') return;
    var bw = 38, bh = Math.min(240, cam.vh * 0.42);
    var bx = sx + 60, by = sy - bh * 0.8;
    if (bx + bw + 40 > cam.vw) bx = sx - 60 - bw - 30;
    by = clamp(by, 70, cam.vh - bh - 110);
    ctx.save();
    R.rrect(ctx, bx - 6, by - 6, bw + 34, bh + 12, 10, 'rgba(59,36,20,0.92)');
    var gr = ctx.createLinearGradient(0, by, 0, by + bh);
    gr.addColorStop(0, '#5fb0e8'); gr.addColorStop(1, '#1f5f9a');
    R.rrect(ctx, bx, by, bw, bh, 6, null); ctx.fillStyle = gr; ctx.fill();
    var zy = by + bh - (f.zone + f.zh) * bh;
    R.rrect(ctx, bx + 2, zy, bw - 4, f.zh * bh, 5, f.inZone ? 'rgba(130,230,110,0.85)' : 'rgba(130,230,110,0.5)');
    ctx.strokeStyle = '#e9ffe0'; ctx.lineWidth = 2; ctx.strokeRect(bx + 2, zy, bw - 4, f.zh * bh);
    var fy = by + bh - f.fpos * bh;
    ctx.save(); ctx.translate(bx + bw / 2, fy); ctx.scale(0.42, 0.42); ctx.translate(-32, -34);
    R.drawIcon(ctx, f.fish);
    ctx.restore();
    // progress
    R.rrect(ctx, bx + bw + 8, by, 14, bh, 5, '#2a1a0e');
    var ph = clamp(f.prog, 0, 1) * bh;
    R.rrect(ctx, bx + bw + 8, by + bh - ph, 14, ph, 5, f.prog > 0.66 ? '#7bc96f' : f.prog > 0.33 ? '#f2c14e' : '#e0603f');
    ctx.font = 'bold 13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6dc';
    ctx.fillText(input.isTouch ? 'Hold the hand button' : 'Hold E / Space', bx + (bw + 22) / 2, by + bh + 26);
    ctx.restore();
  };

  // ================= GOLF =================
  var Golf = SS.Golf = {};
  Golf.HOLES = [
    {
      par: 3, tee: [130, 300], cup: [840, 300],
      fair: [[[130, 300], [800, 300], 140]], green: [840, 300, 82],
      sand: [[620, 212, 55, 26], [660, 392, 50, 24], [935, 300, 24, 62]], water: [],
      trees: [[300, 150], [340, 460], [500, 140], [520, 470], [720, 150], [760, 470], [200, 470], [180, 130]]
    },
    {
      par: 4, tee: [110, 480], cup: [860, 130],
      fair: [[[110, 480], [330, 450], 120], [[330, 450], [420, 200], 120], [[420, 200], [820, 140], 120]], green: [860, 130, 76],
      sand: [[760, 216, 45, 22], [470, 335, 40, 20]], water: [[620, 380, 150, 72]],
      trees: [[210, 300], [250, 200], [600, 525], [720, 505], [905, 300], [870, 430], [150, 150], [560, 252], [655, 258], [400, 540]]
    },
    {
      par: 3, tee: [130, 300], cup: [760, 300],
      fair: [[[130, 300], [290, 300], 110], [[560, 300], [720, 300], 130]], green: [760, 300, 82],
      sand: [[700, 196, 42, 20], [705, 410, 44, 20], [865, 300, 24, 52]], water: [[420, 300, 72, 270]],
      trees: [[250, 115], [250, 485], [620, 105], [620, 500], [140, 140], [140, 460], [900, 140], [900, 460]]
    }
  ];
  var BOUNDS = [40, 50, 960, 550];
  var V_DRIVE = 620, VZ_DRIVE = 330, GRAV = 900, V_PUTT = 430;
  var FRICTION = { fair: 340, rough: 660, sand: 1700, green: 230 };

  Golf.start = function (G) {
    var g = Golf.s = { hole: 0, scores: [], strokes: 0, msg: null, msgT: 0, done: false, t: 0, club: 'driver', aim: 0, power: 0, drag: null };
    Golf.setupHole();
    G.mode = 'golf';
    SS.audio.setMusic('golf');
    SS.ui.showGolf(true);
  };
  Golf.setupHole = function () {
    var g = Golf.s, h = Golf.HOLES[g.hole];
    g.ball = { x: h.tee[0], y: h.tee[1], z: 0, vx: 0, vy: 0, vz: 0, moving: false };
    g.last = [h.tee[0], h.tee[1]];
    g.strokes = 0; g.inCup = false;
    g.aim = Math.atan2(h.cup[1] - h.tee[1], h.cup[0] - h.tee[0]);
    g.power = 0.6; g.club = 'driver';
    g.msg = 'Hole ' + (g.hole + 1) + ' · Par ' + h.par; g.msgT = 2;
  };
  function surface(h, x, y) {
    var i;
    for (i = 0; i < h.water.length; i++) if (W.inEllipse(x, y, h.water[i], 0)) return 'water';
    for (i = 0; i < h.sand.length; i++) if (W.inEllipse(x, y, h.sand[i], 0)) return 'sand';
    if (Math.hypot(x - h.green[0], y - h.green[1]) < h.green[2]) return 'green';
    for (i = 0; i < h.fair.length; i++) { var f = h.fair[i]; if (SS.distToSeg(x, y, f[0][0], f[0][1], f[1][0], f[1][1]) < f[2] / 2) return 'fair'; }
    return 'rough';
  }
  Golf.surface = surface;

  Golf.shoot = function () {
    var g = Golf.s, b = g.ball;
    if (b.moving || g.inCup || g.power < 0.04) return;
    var p = g.power;
    if (g.club === 'driver') { b.vx = Math.cos(g.aim) * V_DRIVE * p; b.vy = Math.sin(g.aim) * V_DRIVE * p; b.vz = VZ_DRIVE * p; SS.audio.play('hit'); }
    else { b.vx = Math.cos(g.aim) * V_PUTT * p; b.vy = Math.sin(g.aim) * V_PUTT * p; b.vz = 0; SS.audio.play('putt'); }
    b.moving = true; g.last = [b.x, b.y]; g.strokes++;
    g.swingT = 0.35;
  };

  function screenMap(cam) {
    var sw = cam.vw, sh = cam.vh;
    var top = 64, bottom = input.isTouch ? 90 : 60;
    var sc = Math.min(sw / 1000, (sh - top - bottom) / 600);
    return { sc: sc, ox: (sw - 1000 * sc) / 2, oy: top + (sh - top - bottom - 600 * sc) / 2 };
  }
  Golf.buttons = function (cam) {
    return {
      club: { x: 12, y: 12, w: 150, h: 40 },
      quit: { x: cam.vw - 102, y: 12, w: 90, h: 40 }
    };
  };
  function inBtn(b, x, y) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }

  Golf.update = function (dt, G, cam) {
    var g = Golf.s;
    if (!g) return;
    g.t += dt;
    if (g.msgT > 0) g.msgT -= dt;
    if (g.swingT > 0) g.swingT -= dt;
    var h = Golf.HOLES[g.hole], b = g.ball;
    var m = screenMap(cam), ptr = input.pointer, btn = Golf.buttons(cam);
    if (g.done) {
      if (input.actionPressed() || ptr.pressed) Golf.finish(G);
      return;
    }
    if (ptr.pressed && inBtn(btn.quit, ptr.x, ptr.y)) { Golf.quit(G); return; }
    if ((ptr.pressed && inBtn(btn.club, ptr.x, ptr.y)) || input.hit('KeyC', 'Tab')) { g.club = g.club === 'driver' ? 'putter' : 'driver'; SS.audio.play('ui'); return; }
    if (input.hit('Escape')) { Golf.quit(G); return; }

    if (!b.moving && !g.inCup) {
      if (input.down('KeyA', 'ArrowLeft')) g.aim -= dt * 1.4;
      if (input.down('KeyD', 'ArrowRight')) g.aim += dt * 1.4;
      if (input.down('KeyW', 'ArrowUp')) g.power = clamp(g.power + dt * 0.7, 0.05, 1);
      if (input.down('KeyS', 'ArrowDown')) g.power = clamp(g.power - dt * 0.7, 0.05, 1);
      if (input.hit('Space', 'KeyE', 'Enter')) Golf.shoot();
      if (ptr.pressed && !inBtn(btn.club, ptr.x, ptr.y)) g.drag = { x: ptr.x, y: ptr.y };
      if (g.drag && ptr.down) {
        var dx = g.drag.x - ptr.x, dy = g.drag.y - ptr.y, len = Math.hypot(dx, dy);
        if (len > 6) { g.aim = Math.atan2(dy, dx); g.power = clamp(len / 140, 0.05, 1); }
      }
      if (g.drag && ptr.released) {
        var l2 = Math.hypot(g.drag.x - ptr.x, g.drag.y - ptr.y);
        g.drag = null;
        if (l2 > 12) Golf.shoot();
      }
    }

    if (b.moving) {
      var steps = 4, sdt = dt / steps;
      for (var s = 0; s < steps; s++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        if (b.z > 0 || b.vz > 0) {
          b.vz -= GRAV * sdt; b.z += b.vz * sdt;
          if (b.z <= 0) {
            b.z = 0;
            var surf = surface(h, b.x, b.y);
            if (surf === 'sand') { b.vx *= 0.2; b.vy *= 0.2; b.vz = 0; }
            else if (surf !== 'water' && b.vz < -110) { b.vz = -b.vz * 0.28; b.vx *= 0.62; b.vy *= 0.62; }
            else { b.vz = 0; b.vx *= 0.6; b.vy *= 0.6; }
          }
        } else {
          var sf = surface(h, b.x, b.y);
          if (sf === 'water') {
            g.strokes++; SS.audio.play('splash');
            g.msg = 'Splash! +1 penalty'; g.msgT = 1.8;
            b.x = g.last[0]; b.y = g.last[1]; b.vx = b.vy = 0; b.moving = false; break;
          }
          var sp = Math.hypot(b.vx, b.vy);
          var dec = FRICTION[sf] * sdt;
          if (sp <= dec || sp < 4) { b.vx = b.vy = 0; } else { b.vx *= (sp - dec) / sp; b.vy *= (sp - dec) / sp; }
          var cd = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
          if (cd < 9) {
            if (sp < 215) { g.inCup = true; b.moving = false; b.x = h.cup[0]; b.y = h.cup[1]; SS.audio.play('cup'); Golf.holeDone(); break; }
            else { var a = Math.atan2(b.vy, b.vx) + SS.rand.range(-0.5, 0.5); b.vx = Math.cos(a) * sp * 0.7; b.vy = Math.sin(a) * sp * 0.7; }
          } else if (cd < 26 && sp < 215 && sp > 0) {
            // gentle slope toward the cup
            b.vx += (h.cup[0] - b.x) / cd * 30 * sdt; b.vy += (h.cup[1] - b.y) / cd * 30 * sdt;
          }
        }
        if (b.z < 28) {
          for (var i = 0; i < h.trees.length; i++) {
            var tr = h.trees[i], tdx = b.x - tr[0], tdy = b.y - tr[1], td = Math.hypot(tdx, tdy);
            if (td < 20) {
              var nx = tdx / td, ny = tdy / td, dot = b.vx * nx + b.vy * ny;
              if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; b.vx *= 0.5; b.vy *= 0.5; }
              b.x = tr[0] + nx * 20.5; b.y = tr[1] + ny * 20.5;
              SS.audio.play('putt');
            }
          }
        }
        if (b.x < BOUNDS[0]) { b.x = BOUNDS[0]; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > BOUNDS[2]) { b.x = BOUNDS[2]; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.y < BOUNDS[1]) { b.y = BOUNDS[1]; b.vy = Math.abs(b.vy) * 0.5; }
        if (b.y > BOUNDS[3]) { b.y = BOUNDS[3]; b.vy = -Math.abs(b.vy) * 0.5; }
      }
      if (b.moving && b.z <= 0 && b.vz === 0 && Math.hypot(b.vx, b.vy) < 1) {
        b.moving = false;
        if (g.strokes >= 8) { g.msg = 'Picked up (8 strokes)'; g.msgT = 2; g.inCup = true; Golf.holeDone(); }
        else g.club = surface(h, b.x, b.y) === 'green' ? 'putter' : 'driver';
      }
    }
    if (g.nextT > 0) { g.nextT -= dt; if (g.nextT <= 0) Golf.nextHole(); }
  };
  Golf.holeDone = function () {
    var g = Golf.s, h = Golf.HOLES[g.hole];
    var d = g.strokes - h.par;
    var names = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double Bogey' };
    if (g.strokes >= 8 && !(g.msgT > 0)) g.msg = 'Picked up';
    else g.msg = g.strokes === 1 ? 'HOLE IN ONE!' : (names[d] || ('+' + d));
    g.msgT = 2.2;
    g.scores.push(Math.min(g.strokes, 8));
    g.nextT = 2.3;
    if (d < 0 || g.strokes === 1) SS.audio.play('quest');
  };
  Golf.nextHole = function () {
    var g = Golf.s;
    if (g.hole < Golf.HOLES.length - 1) { g.hole++; Golf.setupHole(); }
    else { g.done = true; }
  };
  Golf.totals = function () {
    var g = Golf.s, par = 0, tot = 0;
    Golf.HOLES.forEach(function (h, i) { par += h.par; if (g.scores[i] !== undefined) tot += g.scores[i]; });
    return { par: par, total: tot };
  };
  Golf.finish = function (G) {
    var tt = Golf.totals();
    Golf.s = null;
    SS.ui.showGolf(false);
    G.mode = 'play';
    G.golfFinished(tt.total, tt.par);
  };
  Golf.quit = function (G) {
    Golf.s = null; SS.ui.showGolf(false); G.mode = 'play';
    SS.ui.toast('You left the golf course.');
  };

  Golf.render = function (ctx, cam) {
    var g = Golf.s;
    if (!g) return;
    var h = Golf.HOLES[g.hole], b = g.ball, t = g.t;
    var m = screenMap(cam);
    ctx.save();
    ctx.fillStyle = '#2f5e2a'; ctx.fillRect(0, 0, cam.vw, cam.vh);
    ctx.translate(m.ox, m.oy); ctx.scale(m.sc, m.sc);
    // rough with stripes
    ctx.fillStyle = '#5c9e45'; ctx.fillRect(0, 0, 1000, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; for (var sx = 0; sx < 1000; sx += 50) ctx.fillRect(sx, 0, 25, 600);
    // fairways
    h.fair.forEach(function (f) {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#86cc58'; ctx.lineWidth = f[2];
      ctx.beginPath(); ctx.moveTo(f[0][0], f[0][1]); ctx.lineTo(f[1][0], f[1][1]); ctx.stroke();
    });
    h.fair.forEach(function (f) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = f[2] * 0.5;
      ctx.beginPath(); ctx.moveTo(f[0][0], f[0][1]); ctx.lineTo(f[1][0], f[1][1]); ctx.stroke();
    });
    R.circ(ctx, h.green[0], h.green[1], h.green[2] + 10, '#90d463');
    R.circ(ctx, h.green[0], h.green[1], h.green[2], '#a8e47c');
    ctx.save(); ctx.beginPath(); ctx.arc(h.green[0], h.green[1], h.green[2], 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (var gs = -100; gs < 100; gs += 20) ctx.fillRect(h.green[0] + gs, h.green[1] - 100, 10, 200);
    ctx.restore();
    h.sand.forEach(function (s) { R.ell(ctx, s[0], s[1] + 2, s[2] + 3, s[3] + 3, '#d4c184'); R.ell(ctx, s[0], s[1], s[2], s[3], '#f0e1a9'); });
    h.water.forEach(function (w) {
      R.ell(ctx, w[0], w[1], w[2] + 6, w[3] + 6, '#e3f2ff');
      R.ell(ctx, w[0], w[1], w[2], w[3], '#4f9fdb');
      R.ell(ctx, w[0], w[1], w[2] * 0.7, w[3] * 0.7, '#3f8ccc');
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      for (var k = 0; k < 6; k++) { var wx = w[0] + Math.sin(k * 2.1) * w[2] * 0.6, wy = w[1] + Math.cos(k * 1.7) * w[3] * 0.6, a = Math.sin(t * 2 + k); if (a > 0.2) { ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 14 * a, wy); ctx.stroke(); } }
    });
    R.rrect(ctx, h.tee[0] - 22, h.tee[1] - 16, 44, 32, 5, '#9edb6e');
    R.circ(ctx, h.tee[0] - 16, h.tee[1] - 10, 3, '#e04040'); R.circ(ctx, h.tee[0] - 16, h.tee[1] + 10, 3, '#e04040');
    // fence
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
    ctx.strokeRect(BOUNDS[0] - 6, BOUNDS[1] - 6, BOUNDS[2] - BOUNDS[0] + 12, BOUNDS[3] - BOUNDS[1] + 12); ctx.setLineDash([]);
    // cup
    R.ell(ctx, h.cup[0], h.cup[1], 7, 5, '#1b2a12');
    // aim guide
    if (!b.moving && !g.inCup) {
      var p = g.power;
      if (g.club === 'driver') {
        var air = 2 * VZ_DRIVE * p / GRAV, carry = V_DRIVE * p * air;
        var lx = b.x + Math.cos(g.aim) * carry, ly = b.y + Math.sin(g.aim) * carry;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        for (var q = 1; q <= 20; q++) { var tq = q / 20; ctx.lineTo(b.x + (lx - b.x) * tq, b.y + (ly - b.y) * tq - Math.sin(tq * Math.PI) * carry * 0.12); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 5, ly - 5); ctx.lineTo(lx + 5, ly + 5); ctx.moveTo(lx + 5, ly - 5); ctx.lineTo(lx - 5, ly + 5); ctx.stroke();
      } else {
        var roll = Math.pow(V_PUTT * p, 2) / (2 * FRICTION.green) * 0.55;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(g.aim) * roll, b.y + Math.sin(g.aim) * roll); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // golfer sasquatch next to the ball
    var gx = b.x - Math.cos(g.aim + Math.PI / 2) * 24, gy = b.y - Math.sin(g.aim + Math.PI / 2) * 24 + 12;
    if (!b.moving || g.swingT > 0) {
      var P = SS.game.player;
      R.drawSasquatch(ctx, gx, gy, { face: R.faceOf(g.aim), t: t, moving: false, hat: P.outfit.hat, top: P.outfit.top, scale: 0.9 });
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
      var ca = g.swingT > 0 ? g.aim - 1.5 + (0.35 - g.swingT) * 9 : g.aim + Math.PI * 0.75;
      ctx.beginPath(); ctx.moveTo(gx, gy - 18); ctx.lineTo(gx + Math.cos(ca) * 26, gy - 18 + Math.sin(ca) * 26); ctx.stroke();
    }
    // trees
    h.trees.forEach(function (tr) {
      R.ell(ctx, tr[0] + 8, tr[1] + 6, 24, 10, 'rgba(0,0,0,0.25)');
      R.circ(ctx, tr[0], tr[1] - 6, 22, '#2f7a33'); R.circ(ctx, tr[0] - 3, tr[1] - 9, 18, '#3f8f3a'); R.circ(ctx, tr[0] - 8, tr[1] - 14, 8, '#62ad52');
    });
    // flag
    if (!g.inCup || g.msgT > 0) {
      ctx.fillStyle = '#eee'; ctx.fillRect(h.cup[0] - 1.2, h.cup[1] - 52, 2.4, 52);
      ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.moveTo(h.cup[0] + 1, h.cup[1] - 52);
      ctx.quadraticCurveTo(h.cup[0] + 10, h.cup[1] - 49 + Math.sin(t * 5) * 2, h.cup[0] + 22, h.cup[1] - 45 + Math.sin(t * 5 + 1) * 2); ctx.lineTo(h.cup[0] + 1, h.cup[1] - 38); ctx.fill();
    }
    // ball
    if (!g.inCup) {
      R.ell(ctx, b.x + b.z * 0.25, b.y + 2, 5, 2.5, 'rgba(0,0,0,0.3)');
      R.circ(ctx, b.x, b.y - b.z, 5 + b.z * 0.012, '#ffffff');
      R.circ(ctx, b.x - 1.5, b.y - b.z - 1.5, 1.6, '#e8e8e8');
    }
    ctx.restore();

    // HUD
    var btn = Golf.buttons(cam);
    ctx.save();
    ctx.font = '600 15px Nunito, sans-serif'; ctx.textBaseline = 'middle';
    R.rrect(ctx, btn.club.x, btn.club.y, btn.club.w, btn.club.h, 8, 'rgba(59,36,20,0.9)');
    ctx.fillStyle = '#f6e7c1'; ctx.textAlign = 'center';
    ctx.fillText('Club: ' + (g.club === 'driver' ? 'Driver' : 'Putter') + ' (C)', btn.club.x + btn.club.w / 2, btn.club.y + btn.club.h / 2 + 1);
    R.rrect(ctx, btn.quit.x, btn.quit.y, btn.quit.w, btn.quit.h, 8, 'rgba(59,36,20,0.9)');
    ctx.fillStyle = '#f6e7c1'; ctx.fillText('Quit', btn.quit.x + btn.quit.w / 2, btn.quit.y + btn.quit.h / 2 + 1);
    var tt = Golf.totals();
    var info = 'Hole ' + (g.hole + 1) + '/3   Par ' + h.par + '   Strokes ' + g.strokes + '   Total ' + (tt.total + (g.inCup ? 0 : g.strokes)) + ' (par ' + tt.par + ')';
    ctx.font = '700 15px Nunito, sans-serif';
    var iw = Math.min(cam.vw - 24, ctx.measureText(info).width + 28);
    if (cam.vw > 640) { R.rrect(ctx, cam.vw / 2 - iw / 2, 12, iw, 40, 8, 'rgba(59,36,20,0.9)'); ctx.fillStyle = '#f6e7c1'; ctx.fillText(info, cam.vw / 2, 33); }
    else { R.rrect(ctx, 12, 58, cam.vw - 24, 32, 8, 'rgba(59,36,20,0.9)'); ctx.font = '700 13px Nunito, sans-serif'; ctx.fillStyle = '#f6e7c1'; ctx.fillText(info, cam.vw / 2, 75); }
    // power bar
    if (!b.moving && !g.inCup) {
      var pw = Math.min(260, cam.vw - 40), px = cam.vw / 2 - pw / 2, py = cam.vh - (input.isTouch ? 70 : 44);
      R.rrect(ctx, px - 4, py - 4, pw + 8, 22, 8, 'rgba(59,36,20,0.9)');
      var pg = ctx.createLinearGradient(px, 0, px + pw, 0); pg.addColorStop(0, '#7bc96f'); pg.addColorStop(0.7, '#f2c14e'); pg.addColorStop(1, '#e0603f');
      R.rrect(ctx, px, py, pw * g.power, 14, 5, null); ctx.fillStyle = pg; ctx.fill();
      ctx.fillStyle = '#f6e7c1'; ctx.font = '600 12px Nunito, sans-serif';
      ctx.fillText(input.isTouch ? 'Drag back from anywhere and release to swing' : 'Drag back & release, or A/D aim · W/S power · Space swing', cam.vw / 2, py - 14);
    }
    if (cam.vh > cam.vw * 1.15 && !g.done) {
      ctx.font = '700 13px Nunito, sans-serif'; ctx.fillStyle = '#f6e7c1';
      ctx.fillText('Tip: turn your phone sideways for a bigger course', cam.vw / 2, m.oy + 600 * m.sc + 26);
    }
    if (g.msgT > 0 && g.msg) {
      ctx.font = '40px "Lilita One", sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#3a2210'; ctx.fillStyle = '#ffe27a';
      ctx.strokeText(g.msg, cam.vw / 2, cam.vh / 2 - 40); ctx.fillText(g.msg, cam.vw / 2, cam.vh / 2 - 40);
    }
    if (g.done) {
      var w2 = Math.min(420, cam.vw - 32), h2 = 260, x2 = cam.vw / 2 - w2 / 2, y2 = cam.vh / 2 - h2 / 2;
      R.rrect(ctx, x2, y2, w2, h2, 14, 'rgba(59,36,20,0.96)');
      ctx.fillStyle = '#ffe27a'; ctx.font = '30px "Lilita One", sans-serif'; ctx.fillText('Scorecard', cam.vw / 2, y2 + 36);
      ctx.font = '700 17px Nunito, sans-serif'; ctx.fillStyle = '#f6e7c1';
      Golf.HOLES.forEach(function (hh, i) { ctx.fillText('Hole ' + (i + 1) + ':  ' + g.scores[i] + '  (par ' + hh.par + ')', cam.vw / 2, y2 + 80 + i * 28); });
      var win = tt.total <= tt.par;
      ctx.font = '24px "Lilita One", sans-serif'; ctx.fillStyle = win ? '#9be27a' : '#f2a07a';
      ctx.fillText((win ? 'You win! ' : 'So close! ') + tt.total + ' vs par ' + tt.par, cam.vw / 2, y2 + 182);
      ctx.font = '600 14px Nunito, sans-serif'; ctx.fillStyle = '#f6e7c1';
      ctx.fillText(input.isTouch ? 'Tap to continue' : 'Press E or click to continue', cam.vw / 2, y2 + 226);
    }
    ctx.restore();
  };
})();
