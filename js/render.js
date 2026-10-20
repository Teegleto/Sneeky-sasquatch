/* Sneeky Sasquatch - procedural art: ground, objects, characters, vehicles, icons, lighting */
'use strict';
(function () {
  var R = SS.R = {};
  var W = SS.world;
  var TAU = Math.PI * 2, PI = Math.PI;
  var SPR_K = 2.5;

  // ---------- helpers ----------
  var cache = {};
  R.sprite = function (key, w, h, ax, ay, fn) {
    var s = cache[key];
    if (!s) {
      var c = document.createElement('canvas');
      c.width = Math.ceil(w * SPR_K); c.height = Math.ceil(h * SPR_K);
      var g = c.getContext('2d');
      g.scale(SPR_K, SPR_K); g.translate(ax, ay);
      fn(g);
      s = cache[key] = { c: c, w: w, h: h, ax: ax, ay: ay };
    }
    return s;
  };
  R.blit = function (ctx, s, x, y) { ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h); };

  function ell(g, x, y, rx, ry, color, rot) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    if (color) { g.fillStyle = color; g.fill(); }
  }
  function circ(g, x, y, r, color) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); if (color) { g.fillStyle = color; g.fill(); } }
  function rrect(g, x, y, w, h, r, color) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, r);
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    if (color) { g.fillStyle = color; g.fill(); }
  }
  function shadow(g, x, y, rx, ry, a) { ell(g, x, y, rx, ry, 'rgba(20,30,10,' + (a || 0.25) + ')'); }
  function strokePath(g, pts, w, color, cap) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.lineWidth = w; g.strokeStyle = color; g.lineCap = cap || 'round'; g.lineJoin = 'round'; g.stroke();
  }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt; }
    else { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
  }
  R.shade = shade; R.ell = ell; R.circ = circ; R.rrect = rrect;

  R.faceOf = function (angle) {
    var a = ((angle % TAU) + TAU) % TAU;
    if (a < PI / 4 || a >= 7 * PI / 4) return 'right';
    if (a < 3 * PI / 4) return 'down';
    if (a < 5 * PI / 4) return 'left';
    return 'up';
  };

  // ---------- ground ----------
  var CH = R.CH = 512;
  R.buildGround = function () {
    R.chunks = {};
    var cols = Math.ceil(W.w / CH), rows = Math.ceil(W.h / CH);
    R.dirtSmooth = W.dirt.map(function (p) { return { pts: p.pts.length > 2 ? SS.smoothPath(p.pts, 6) : p.pts, w: p.w }; });
    R.treesList = W.objects.filter(function (o) { return o.type === 'tree'; });
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cv = document.createElement('canvas');
      cv.width = CH; cv.height = CH;
      drawGroundChunk(cv.getContext('2d'), c * CH, r * CH);
      R.chunks[c + ',' + r] = cv;
    }
    R.buildMiniMap();
  };

  function drawGroundChunk(g, ox, oy) {
    var rnd = SS.rng(ox * 7919 + oy * 104729 + 17);
    g.save();
    g.translate(-ox, -oy);
    g.fillStyle = '#76b350'; g.fillRect(ox, oy, CH, CH);
    var i, x, y;
    // soft color blotches
    for (i = 0; i < 18; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      var rad = 40 + rnd() * 110;
      var gr = g.createRadialGradient(x, y, 0, x, y, rad);
      var light = rnd() < 0.5;
      gr.addColorStop(0, light ? 'rgba(160,205,100,0.35)' : 'rgba(70,130,50,0.3)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // forest floor shade under trees
    R.treesList.forEach(function (t) {
      if (t.x < ox - 90 || t.x > ox + CH + 90 || t.y < oy - 90 || t.y > oy + CH + 90) return;
      var rr = 52 * t.s;
      var gr2 = g.createRadialGradient(t.x, t.y - 12, 0, t.x, t.y - 12, rr);
      gr2.addColorStop(0, 'rgba(38,85,32,0.42)'); gr2.addColorStop(1, 'rgba(38,85,32,0)');
      g.fillStyle = gr2; g.fillRect(t.x - rr, t.y - 12 - rr, rr * 2, rr * 2);
    });
    // grass tufts & flowers
    g.lineCap = 'round';
    for (i = 0; i < 340; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      var dark = rnd() < 0.6;
      g.strokeStyle = dark ? 'rgba(60,120,45,0.7)' : 'rgba(170,215,110,0.7)';
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 5); g.moveTo(x, y); g.lineTo(x + 1, y - 6); g.moveTo(x, y); g.lineTo(x + 3, y - 4); g.stroke();
    }
    for (i = 0; i < 26; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      circ(g, x, y, 1.8, rnd.pick(['#fff6d8', '#f6d743', '#c99ce6', '#f28fb0']));
    }

    // cliffs
    var rocks = W.rocks.concat(W.bearRocks);
    rocks.forEach(function (r) { circ(g, r[0], r[1] + 14, r[2] + 2, '#555960'); });
    rocks.forEach(function (r) { circ(g, r[0], r[1], r[2], '#8a8e95'); });
    rocks.forEach(function (r) {
      var gr = g.createRadialGradient(r[0] - r[2] * 0.3, r[1] - r[2] * 0.4, r[2] * 0.1, r[0], r[1], r[2]);
      gr.addColorStop(0, 'rgba(200,204,210,0.5)'); gr.addColorStop(1, 'rgba(200,204,210,0)');
      g.fillStyle = gr; circ(g, r[0], r[1], r[2]); g.fill();
    });
    for (i = 0; i < 70; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      if (W.tile(x, y) !== 2 || W.tile(x, y + 30) !== 2) continue;
      var pr = 20 + rnd() * 50;
      var pg = g.createRadialGradient(x, y, 0, x, y, pr);
      var tone = rnd();
      pg.addColorStop(0, tone < 0.4 ? 'rgba(90,128,70,0.45)' : tone < 0.7 ? 'rgba(160,164,170,0.5)' : 'rgba(95,98,106,0.45)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.fillRect(x - pr, y - pr, pr * 2, pr * 2);
    }
    for (i = 0; i < 60; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      if (W.tile(x, y) !== 2 || W.tile(x, y + 20) !== 2) continue;
      var bs = 4 + rnd() * 9;
      ell(g, x + 1.5, y + 2, bs, bs * 0.7, 'rgba(60,62,68,0.5)');
      ell(g, x, y, bs, bs * 0.7, '#9a9ea5');
      ell(g, x - bs * 0.3, y - bs * 0.25, bs * 0.45, bs * 0.3, 'rgba(255,255,255,0.3)');
    }

    // sand & banks
    W.lake.forEach(function (e) { ell(g, e[0], e[1], e[2] + 30, e[3] + 30, '#e8d398'); });
    ell(g, W.beach[0], W.beach[1], W.beach[2], W.beach[3], '#ecd9a0');
    W.ponds.forEach(function (e) { ell(g, e[0], e[1], e[2] + 12, e[3] + 10, '#e8d398'); });
    strokePath(g, W.river, W.riverW + 30, '#bea873');
    W.lake.forEach(function (e) { ell(g, e[0], e[1], e[2] + 10, e[3] + 10, '#d6bd80'); });
    // foam rings then water
    W.lake.forEach(function (e) { g.beginPath(); g.ellipse(e[0], e[1], e[2] + 2, e[3] + 2, 0, 0, TAU); g.lineWidth = 6; g.strokeStyle = 'rgba(235,248,255,0.85)'; g.stroke(); });
    strokePath(g, W.river, W.riverW + 6, 'rgba(230,245,255,0.8)');
    W.lake.forEach(function (e) { ell(g, e[0], e[1], e[2], e[3], '#4f9fdb'); });
    W.lake.forEach(function (e) { ell(g, e[0], e[1], e[2] - 40, e[3] - 40, '#3f8ccc'); });
    W.lake.forEach(function (e) { ell(g, e[0], e[1], e[2] - 110, e[3] - 110, '#2f73b4'); });
    W.ponds.forEach(function (e) { ell(g, e[0], e[1], e[2], e[3], '#4f9fdb'); });
    strokePath(g, W.river, W.riverW, '#4a98d6');
    strokePath(g, W.river, W.riverW - 40, '#3d88c8');

    // campground
    var L = W.loop;
    ell(g, L.x, L.y, L.rx - 24, L.ry - 24, 'rgba(160,210,110,0.35)');
    W.siteDefs.forEach(function (d) {
      var a = Math.atan2(L.y - d.y, L.x - d.x);
      strokePath(g, [[d.x, d.y], [d.x + Math.cos(a) * 140, d.y + Math.sin(a) * 140]], 34, '#b88f58');
      strokePath(g, [[d.x, d.y], [d.x + Math.cos(a) * 140, d.y + Math.sin(a) * 140]], 26, '#c9a06a');
    });
    g.beginPath(); g.ellipse(L.x, L.y, L.rx, L.ry, 0, 0, TAU); g.lineWidth = L.w + 8; g.strokeStyle = '#b08752'; g.stroke();
    g.lineWidth = L.w; g.strokeStyle = '#c9a06a'; g.stroke();
    W.siteDefs.forEach(function (d) {
      var gr = g.createRadialGradient(d.x, d.y, 30, d.x, d.y, 108);
      gr.addColorStop(0, 'rgba(201,160,106,0.85)'); gr.addColorStop(0.8, 'rgba(201,160,106,0.6)'); gr.addColorStop(1, 'rgba(201,160,106,0)');
      g.fillStyle = gr; circ(g, d.x, d.y, 108); g.fill();
    });
    rrect(g, 1480, 1200, 140, 90, 8, '#cdb48a');

    // dirt trails
    R.dirtSmooth.forEach(function (p) { strokePath(g, p.pts, p.w + 6, '#ad8450'); });
    R.dirtSmooth.forEach(function (p) { strokePath(g, p.pts, p.w, '#c79e68'); });
    R.dirtSmooth.forEach(function (p) { if (p.w > 26) strokePath(g, p.pts, p.w * 0.35, 'rgba(220,190,140,0.35)'); });
    ell(g, 480, 560, 130, 90, 'rgba(199,158,104,0.55)');

    // town lawns and sidewalks
    W.objects.forEach(function (o) {
      if (o.type === 'building' && o.kind === 'house') rrect(g, o.x0 - 30, o.y0 - 20, o.x1 - o.x0 + 60, o.y1 - o.y0 + 50, 10, 'rgba(150,205,100,0.5)');
    });
    strokePath(g, [[2700, 1390], [3600, 1390]], W.roads[0].w + 34, '#cfcac0', 'butt');
    strokePath(g, [[3020, 1390], [3020, 1770]], W.roads[1].w + 30, '#cfcac0', 'butt');
    circ(g, W.culdesac[0], W.culdesac[1], W.culdesac[2] + 16, '#cfcac0');
    rrect(g, 2870, 1206, 400, 26, 4, '#cfcac0');
    rrect(g, 2266, 1290, 228, 50, 4, '#cdb48a');

    // roads
    W.roads.forEach(function (r) { strokePath(g, r.pts, r.w + 6, '#8f939a'); });
    circ(g, W.culdesac[0], W.culdesac[1], W.culdesac[2] + 3, '#8f939a');
    W.lots.forEach(function (l) { rrect(g, l[0] - 3, l[1] - 3, l[2] - l[0] + 6, l[3] - l[1] + 6, 6, '#8f939a'); });
    W.roads.forEach(function (r) { strokePath(g, r.pts, r.w, '#5a5e65'); });
    circ(g, W.culdesac[0], W.culdesac[1], W.culdesac[2], '#5a5e65');
    W.lots.forEach(function (l) {
      rrect(g, l[0], l[1], l[2] - l[0], l[3] - l[1], 4, '#5a5e65');
      g.strokeStyle = 'rgba(240,240,240,0.7)'; g.lineWidth = 2;
      for (var lx = l[0] + 30; lx < l[2]; lx += 52) { g.beginPath(); g.moveTo(lx, l[1] + 4); g.lineTo(lx, l[1] + 40); g.stroke(); }
    });
    g.setLineDash([20, 18]);
    W.roads.forEach(function (r) { strokePath(g, r.pts, 3, '#f2cf4a', 'butt'); });
    g.setLineDash([]);
    // asphalt grain
    for (i = 0; i < 160; i++) {
      x = ox + rnd() * CH; y = oy + rnd() * CH;
      var on = false;
      for (var k = 0; k < W.roads.length; k++) if (SS.distToPolyline(x, y, W.roads[k].pts) < W.roads[k].w / 2 - 2) on = true;
      if (on) circ(g, x, y, 1, rnd() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)');
    }

    // golf course
    W.fairways.forEach(function (f) {
      var ang = Math.atan2(f.b[1] - f.a[1], f.b[0] - f.a[0]), len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), w = f.w;
      g.save(); g.translate(f.a[0], f.a[1]); g.rotate(ang);
      g.beginPath(); g.moveTo(0, -w / 2); g.lineTo(len, -w / 2); g.arc(len, 0, w / 2, -PI / 2, PI / 2); g.lineTo(0, w / 2); g.arc(0, 0, w / 2, PI / 2, PI * 1.5); g.closePath();
      g.fillStyle = '#8bd05d'; g.fill(); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (var s = -w; s < len + w; s += 36) g.fillRect(s, -w / 2, 18, w);
      g.restore();
      rrect(g, f.a[0] - 16, f.a[1] - 12, 32, 24, 4, '#a3df73');
      circ(g, f.green[0], f.green[1], f.green[2] + 10, '#95d867');
      circ(g, f.green[0], f.green[1], f.green[2], '#aae67e');
    });
    W.bunkers.forEach(function (b) { ell(g, b[0], b[1] + 2, b[2] + 3, b[3] + 3, '#d6c486'); ell(g, b[0], b[1], b[2], b[3], '#efe0a8'); });
    W.ponds.forEach(function (e) { ell(g, e[0] - e[2] * 0.3, e[1] - e[3] * 0.3, e[2] * 0.3, e[3] * 0.2, 'rgba(255,255,255,0.18)'); });

    // dock
    var d = W.dock;
    for (y = d.y0 + 8; y < d.y1; y += 40) { circ(g, d.x0 - 2, y, 4.5, '#5c3d1e'); circ(g, d.x1 + 2, y, 4.5, '#5c3d1e'); }
    g.fillStyle = '#a7773f'; g.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    g.strokeStyle = '#7d5529'; g.lineWidth = 1.2;
    for (y = d.y0; y < d.y1; y += 9) { g.beginPath(); g.moveTo(d.x0, y); g.lineTo(d.x1, y); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(d.x0, d.y0, 3, d.y1 - d.y0);

    g.restore();
  }

  R.drawGround = function (ctx, x0, y0, x1, y1) {
    var c0 = Math.max(0, Math.floor(x0 / CH)), c1 = Math.floor(x1 / CH), r0 = Math.max(0, Math.floor(y0 / CH)), r1 = Math.floor(y1 / CH);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var cv = R.chunks[c + ',' + r];
      if (cv) ctx.drawImage(cv, c * CH, r * CH, CH + 0.6, CH + 0.6);
    }
  };

  R.buildMiniMap = function () {
    var s = 0.1;
    var c = document.createElement('canvas');
    c.width = Math.ceil(W.w * s); c.height = Math.ceil(W.h * s);
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    for (var k in R.chunks) {
      var p = k.split(',');
      g.drawImage(R.chunks[k], p[0] * CH * s, p[1] * CH * s, CH * s + 0.5, CH * s + 0.5);
    }
    g.fillStyle = 'rgba(30,80,30,0.55)';
    R.treesList.forEach(function (t) { g.beginPath(); g.arc(t.x * s, (t.y - 30) * s, 2.6 * t.s, 0, TAU); g.fill(); });
    W.objects.forEach(function (o) {
      if (o.type === 'building') { g.fillStyle = '#7a5a3a'; g.fillRect(o.x0 * s, o.y0 * s, (o.x1 - o.x0) * s, (o.y1 - o.y0) * s); }
      if (o.type === 'tent') { g.fillStyle = o.color; g.fillRect((o.tx - 30) * s, (o.ty - 18) * s, 6, 4); }
    });
    R.mini = c; R.miniScale = s;
  };

  R.drawWater = function (ctx, x0, y0, x1, y1, t) {
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (var i = 0; i < W.sparkles.length; i++) {
      var s = W.sparkles[i];
      if (s[0] < x0 || s[0] > x1 || s[1] < y0 || s[1] > y1) continue;
      var a = Math.sin(t * 1.6 + s[2]);
      if (a < 0.2) continue;
      var dx = Math.sin(t * 0.5 + s[2]) * 4;
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.45).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(s[0] + dx, s[1]); ctx.lineTo(s[0] + dx + s[3] * a, s[1]); ctx.stroke();
    }
  };

  // ---------- static object sprites ----------
  function drawTreeSprite(g, pine, v, s) {
    shadow(g, 10 * s, 2, 30 * s, 11 * s, 0.28);
    if (pine) {
      var greens = [['#2c6b38', '#3b8045', '#4f9554'], ['#2f6a3c', '#3f7d49', '#55935a'], ['#336f34', '#447f3c', '#5a9748']][v];
      g.fillStyle = '#6b4526'; g.fillRect(-4 * s, -16 * s, 8 * s, 16 * s);
      var tiers = [[0, 36, 30], [-24, 29, 28], [-44, 21, 26], [-60, 12, 20]];
      tiers.forEach(function (t) {
        var by = (t[0] - 8) * s, hw = t[1] * s, h = t[2] * s;
        g.beginPath(); g.moveTo(-hw, by); g.quadraticCurveTo(0, by + 7 * s, hw, by); g.lineTo(0, by - h - 6 * s); g.closePath();
        g.fillStyle = greens[0]; g.fill();
        g.beginPath(); g.moveTo(-hw * 0.85, by - 2 * s); g.quadraticCurveTo(-hw * 0.2, by + 3 * s, 0, by); g.lineTo(0, by - h - 6 * s); g.closePath();
        g.fillStyle = greens[2]; g.fill();
        g.beginPath(); g.moveTo(0, by); g.quadraticCurveTo(hw * 0.5, by + 3 * s, hw * 0.85, by - 1 * s); g.lineTo(0, by - h - 6 * s); g.closePath();
        g.fillStyle = greens[1]; g.fill();
      });
    } else {
      var cols = [['#3b8a37', '#4f9d40', '#6db650'], ['#46913a', '#5aa443', '#7cc059'], ['#5a8f2f', '#6ea23a', '#8fbf52']][v];
      g.fillStyle = '#7a5230'; g.fillRect(-5 * s, -30 * s, 10 * s, 30 * s);
      g.fillStyle = '#5e3d22'; g.fillRect(2 * s, -30 * s, 3 * s, 30 * s);
      var blobs = [[0, -52, 25], [-19, -42, 18], [19, -42, 18], [-11, -66, 18], [12, -64, 18], [0, -38, 18]];
      blobs.forEach(function (b) { circ(g, b[0] * s, (b[1] + 3) * s, b[2] * s, cols[0]); });
      blobs.forEach(function (b) { circ(g, b[0] * s - 2 * s, b[1] * s - 2 * s, b[2] * s * 0.88, cols[1]); });
      blobs.forEach(function (b) { circ(g, b[0] * s - 6 * s, b[1] * s - 6 * s, b[2] * s * 0.42, cols[2]); });
    }
  }
  R.treeSprite = function (o) {
    var sq = Math.round(o.s * 10) / 10;
    return R.sprite('tree' + (o.pine ? 'p' : 'o') + o.v + sq, 100 * sq, 104 * sq, 50 * sq, 94 * sq, function (g) { drawTreeSprite(g, o.pine, o.v, sq); });
  };

  function bushSprite(r, v, berry) {
    var rq = Math.round(r);
    return R.sprite('bush' + rq + v + (berry ? 'b' : ''), rq * 2.6, rq * 2.2, rq * 1.3, rq * 1.6, function (g) {
      var c = [['#357a33', '#47923f', '#62ad52'], ['#3a7f36', '#4c9844', '#69b257'], ['#2f7536', '#3f8c43', '#5aa65a']][v];
      shadow(g, 3, 2, rq * 1.1, rq * 0.4, 0.28);
      var bl = [[-0.55, -0.4, 0.62], [0.55, -0.4, 0.62], [0, -0.75, 0.68], [0, -0.3, 0.7], [-0.3, -0.95, 0.45], [0.35, -0.95, 0.45]];
      bl.forEach(function (b) { circ(g, b[0] * rq, b[1] * rq + 2, b[2] * rq, c[0]); });
      bl.forEach(function (b) { circ(g, b[0] * rq - 1.5, b[1] * rq - 1, b[2] * rq * 0.85, c[1]); });
      bl.forEach(function (b) { circ(g, b[0] * rq - rq * 0.2, b[1] * rq - rq * 0.2, b[2] * rq * 0.35, c[2]); });
    });
  }

  function rockSprite(v, s) {
    var sq = Math.round(s * 10) / 10;
    return R.sprite('rock' + v + sq, 50 * sq, 40 * sq, 25 * sq, 32 * sq, function (g) {
      shadow(g, 3, 1, 18 * sq, 6 * sq, 0.3);
      var pts = [[[-16, 0], [-18, -10], [-8, -20], [6, -22], [16, -12], [17, 0]], [[-14, 0], [-15, -14], [-2, -24], [12, -18], [15, -4]], [[-17, 0], [-12, -16], [2, -18], [14, -14], [18, 0]]][v];
      g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0] * sq, p[1] * sq); else g.moveTo(p[0] * sq, p[1] * sq); }); g.closePath();
      g.fillStyle = '#7d8189'; g.fill();
      g.beginPath(); pts.forEach(function (p, i) { var x = p[0] * sq * 0.75 - 2, y = p[1] * sq * 0.75 - 3; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
      g.fillStyle = '#a2a6ad'; g.fill();
      ell(g, -4 * sq, -14 * sq, 4 * sq, 2.5 * sq, 'rgba(255,255,255,0.35)');
    });
  }

  function tentSprite(color) {
    return R.sprite('tent' + color, 96, 80, 48, 60, function (g) {
      shadow(g, 4, 16, 44, 12, 0.28);
      g.beginPath(); g.ellipse(0, 18, 40, 46, 0, PI, TAU); g.closePath(); g.fillStyle = shade(color, -0.25); g.fill();
      g.beginPath(); g.ellipse(-2, 18, 37, 44, 0, PI, TAU); g.closePath(); g.fillStyle = color; g.fill();
      g.beginPath(); g.ellipse(-8, 14, 18, 30, -0.2, PI, TAU); g.closePath(); g.fillStyle = shade(color, 0.22); g.fill();
      g.strokeStyle = shade(color, -0.35); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, 18, 22, 44, 0, PI * 1.05, TAU * 0.975); g.stroke();
      g.beginPath(); g.moveTo(-38, 6); g.quadraticCurveTo(0, -18, 38, 6); g.stroke();
      g.beginPath(); g.ellipse(0, 18, 13, 20, 0, PI, TAU); g.closePath(); g.fillStyle = shade(color, -0.45); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 18); g.stroke();
      g.fillStyle = '#4b3a2a'; g.fillRect(-42, 16, 4, 4); g.fillRect(38, 16, 4, 4);
    });
  }

  function tableSprite() {
    return R.sprite('table', 76, 54, 38, 44, function (g) {
      shadow(g, 3, 2, 34, 8, 0.25);
      g.fillStyle = '#6e4a26';
      g.fillRect(-26, -10, 4, 10); g.fillRect(22, -10, 4, 10);
      g.fillStyle = '#9a6a38'; g.fillRect(-30, -6, 60, 6); // front bench
      g.fillStyle = '#86592e'; g.fillRect(-30, -38, 60, 5); // back bench
      g.fillStyle = '#b07a42'; rrect(g, -30, -32, 60, 20, 2, '#b07a42');
      g.strokeStyle = '#8b5d30'; g.lineWidth = 1;
      for (var y = -27; y < -12; y += 5) { g.beginPath(); g.moveTo(-30, y); g.lineTo(30, y); g.stroke(); }
      g.fillStyle = '#7a5129'; g.fillRect(-30, -13, 60, 3);
    });
  }

  function carSprite(color, truck) {
    return R.sprite('car' + color + (truck ? 't' : ''), 90, 60, 45, 48, function (g) {
      var w = truck ? 76 : 68;
      shadow(g, 2, 2, w / 2 + 4, 8, 0.3);
      circ(g, -w / 2 + 12, -4, 7, '#1e1e22'); circ(g, w / 2 - 12, -4, 7, '#1e1e22');
      rrect(g, -w / 2, -30, w, 26, 8, color);
      rrect(g, -w / 2, -30, w, 8, 6, shade(color, 0.2));
      if (truck) {
        rrect(g, -w / 2 + 4, -46, 34, 20, 6, color);
        rrect(g, -w / 2 + 8, -43, 26, 12, 3, '#a9d6ef');
        g.fillStyle = '#2f6b3a'; g.fillRect(-w / 2, -18, w, 5);
        g.fillStyle = '#e04040'; g.fillRect(-w / 2 + 12, -50, 6, 4); g.fillStyle = '#3c6fe0'; g.fillRect(-w / 2 + 20, -50, 6, 4);
      } else {
        rrect(g, -w / 2 + 12, -46, w - 26, 20, 7, shade(color, -0.1));
        rrect(g, -w / 2 + 16, -43, w - 34, 12, 4, '#a9d6ef');
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-w / 2 + 18, -42, 6, 10);
      }
      circ(g, w / 2 - 4, -20, 3, '#fff3b0'); circ(g, -w / 2 + 4, -20, 3, '#ff6b5b');
      circ(g, -w / 2 + 12, -4, 3, '#9aa0a8'); circ(g, w / 2 - 12, -4, 3, '#9aa0a8');
    });
  }

  function buildingSprite(o) {
    var w = o.x1 - o.x0, d = o.y1 - o.y0;
    var H = { store: 70, station: 64, clubhouse: 60, house: 54, restroom: 44 }[o.kind] || 50;
    var key = 'b' + o.kind + w + d + (o.wall || '') + (o.roof || '');
    return R.sprite(key, w + 40, d + H + 50, w / 2 + 20, d + H + 30 - (H - H), function (g) {
      // origin: bottom-center of footprint
      var x0 = -w / 2, x1 = w / 2, y1 = 0, y0 = -d;
      shadow(g, 10, 6, w / 2 + 14, 12, 0.3);
      var wall = o.wall || ({ store: '#e9dcc0', station: '#9c6b3f', clubhouse: '#f3efe6', restroom: '#c9b28a' }[o.kind]);
      var roof = o.roof || ({ store: '#c0503b', station: '#4e6b3a', clubhouse: '#3f8a4f', restroom: '#6d5a44' }[o.kind]);
      // front wall
      g.fillStyle = wall; g.fillRect(x0, y1 - H, w, H);
      if (o.kind === 'station') {
        g.strokeStyle = shade(wall, -0.3); g.lineWidth = 2;
        for (var ly = y1 - H + 8; ly < y1; ly += 9) { g.beginPath(); g.moveTo(x0, ly); g.lineTo(x1, ly); g.stroke(); }
        for (ly = y1 - H + 4; ly < y1; ly += 9) { circ(g, x0 + 3, ly, 3.5, shade(wall, -0.15)); circ(g, x1 - 3, ly, 3.5, shade(wall, -0.15)); }
      } else {
        g.fillStyle = 'rgba(0,0,0,0.06)'; for (var sx = x0; sx < x1; sx += 14) g.fillRect(sx, y1 - H, 1, H);
      }
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, y1 - 6, w, 6);
      // windows
      var winY = y1 - H + 18, winH = Math.min(26, H - 32);
      var nWin = Math.max(2, Math.floor(w / 70));
      for (var i = 0; i < nWin; i++) {
        var wx = x0 + (i + 0.5) * w / nWin;
        if (Math.abs(wx) < 26) continue;
        rrect(g, wx - 15, winY, 30, winH, 2, '#5c3d22');
        rrect(g, wx - 12, winY + 3, 24, winH - 6, 1, '#9fd0ea');
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(wx - 9, winY + 5, 4, winH - 10);
        g.fillStyle = '#5c3d22'; g.fillRect(wx - 1, winY + 3, 2, winH - 6);
        if (o.kind === 'house') { g.fillStyle = shade(roof, 0.1); g.fillRect(wx - 19, winY, 4, winH); g.fillRect(wx + 15, winY, 4, winH); }
      }
      // door
      var dh = Math.min(40, H - 12);
      rrect(g, -14, y1 - dh, 28, dh, 3, o.kind === 'store' ? '#5b8fb0' : shade(wall, -0.45));
      if (o.kind === 'store') { rrect(g, -11, y1 - dh + 4, 22, dh - 14, 2, '#bfe3f5'); }
      circ(g, 8, y1 - dh / 2, 2, '#e8c35a');
      // roof
      if (o.kind === 'house') {
        // hip roof: front slope, back slope and two side triangles
        var eaveF = y1 - H + 4, eaveB = y0 - H - 6, ridgeY = (eaveF + eaveB) / 2 - 10, inset = Math.min(46, w * 0.3);
        g.beginPath(); g.moveTo(x0 - 10, eaveB); g.lineTo(x1 + 10, eaveB); g.lineTo(x1 - inset, ridgeY); g.lineTo(x0 + inset, ridgeY); g.closePath();
        g.fillStyle = shade(roof, -0.12); g.fill();
        g.beginPath(); g.moveTo(x0 - 10, eaveF); g.lineTo(x0 - 10, eaveB); g.lineTo(x0 + inset, ridgeY); g.closePath(); g.fillStyle = shade(roof, 0.1); g.fill();
        g.beginPath(); g.moveTo(x1 + 10, eaveF); g.lineTo(x1 + 10, eaveB); g.lineTo(x1 - inset, ridgeY); g.closePath(); g.fillStyle = shade(roof, -0.22); g.fill();
        g.beginPath(); g.moveTo(x0 - 10, eaveF); g.lineTo(x1 + 10, eaveF); g.lineTo(x1 - inset, ridgeY); g.lineTo(x0 + inset, ridgeY); g.closePath();
        g.fillStyle = roof; g.fill();
        g.strokeStyle = shade(roof, -0.25); g.lineWidth = 1.2;
        for (var k = 1; k < 5; k++) { var tk = k / 5, yy = eaveF + (ridgeY - eaveF) * tk, hw2 = (w / 2 + 10) + ((w / 2 - inset) - (w / 2 + 10)) * tk; g.beginPath(); g.moveTo(-hw2, yy); g.lineTo(hw2, yy); g.stroke(); }
        g.strokeStyle = shade(roof, -0.35); g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + inset, ridgeY); g.lineTo(x1 - inset, ridgeY); g.stroke();
        g.fillStyle = '#8a8a8a'; g.fillRect(w * 0.18, ridgeY - 14, 12, 20); g.fillStyle = '#6d6d6d'; g.fillRect(w * 0.18 - 2, ridgeY - 16, 16, 4);
      } else {
        rrect(g, x0 - 10, y0 - H - 8, w + 20, d + 14, 6, roof);
        g.fillStyle = shade(roof, -0.25); g.fillRect(x0 - 10, y1 - H - 4, w + 20, 8);
        g.strokeStyle = shade(roof, -0.15); g.lineWidth = 1.2;
        for (var ry = y0 - H; ry < y1 - H - 4; ry += 10) { g.beginPath(); g.moveTo(x0 - 6, ry); g.lineTo(x1 + 6, ry); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 - 10, y0 - H - 8, w + 20, 6);
      }
      // signs and details
      function signBoard(text, bg, fg, y, bw) {
        rrect(g, -bw / 2, y, bw, 18, 3, bg);
        g.fillStyle = fg; g.font = 'bold 11px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, 0, y + 9.5);
      }
      if (o.kind === 'store') {
        signBoard('GENERAL STORE', '#2f5a3a', '#f6e7b8', y1 - H - 12, 130);
        g.fillStyle = '#d64545'; for (var aw = x0 + 6; aw < x1 - 6; aw += 20) { g.beginPath(); g.moveTo(aw, y1 - H + 6); g.lineTo(aw + 20, y1 - H + 6); g.lineTo(aw + 18, y1 - H + 14); g.lineTo(aw + 2, y1 - H + 14); g.closePath(); g.fill(); g.fillStyle = g.fillStyle === '#d64545' ? '#f3efe6' : '#d64545'; }
      }
      if (o.kind === 'station') signBoard('RANGER STATION', '#5a3a1e', '#f2d27a', y1 - H - 12, 124);
      if (o.kind === 'clubhouse') { signBoard('CLUBHOUSE', '#2c6b3a', '#ffffff', y1 - H - 12, 96); g.fillStyle = '#3f8a4f'; g.fillRect(-30, y1 - dh - 8, 60, 6); }
      if (o.kind === 'restroom') { signBoard('WC', '#3c5d8a', '#ffffff', y1 - H + 4, 30); }
    });
  }

  R.drawObject = function (ctx, o, t, G) {
    var s, x = o.x, y = o.y;
    switch (o.type) {
      case 'tree':
        R.blit(ctx, R.treeSprite(o), x, y); break;
      case 'bush':
        var bx = x + (o.shake > 0 ? Math.sin(t * 50) * o.shake * 3 : 0);
        R.blit(ctx, bushSprite(o.r, o.v, o.berry), bx, y);
        if (o.berry && o.hasBerries) {
          var rnd = SS.rng(Math.floor(o.x * 13 + o.y));
          for (var i = 0; i < 9; i++) circ(ctx, bx + rnd.range(-o.r * 0.8, o.r * 0.8), y - rnd.range(o.r * 0.3, o.r * 1.2), 2.6, i % 3 ? '#d6324a' : '#4a5fd0');
        }
        if (G && G.player.hiddenIn === o) {
          var pf = G.player.dirX || 0;
          var ey = y - o.r * 0.6;
          var blink = (Math.sin(t * 1.3) > 0.97);
          [-6, 6].forEach(function (dx) {
            if (blink) { ctx.fillStyle = '#222'; ctx.fillRect(bx + dx - 3, ey, 6, 1.5); return; }
            ell(ctx, bx + dx, ey, 3.6, 3, '#fff');
            circ(ctx, bx + dx + pf * 1.4, ey + 0.4, 1.7, '#1a1a1a');
          });
        }
        break;
      case 'rock': R.blit(ctx, rockSprite(o.v, o.s), x, y); break;
      case 'tent':
        R.blit(ctx, tentSprite(o.color), o.tx, o.ty + 2);
        break;
      case 'table': R.blit(ctx, tableSprite(), x, y); break;
      case 'basket': R.drawBasket(ctx, x, y, o.items.length > 0); break;
      case 'cooler': R.drawCooler(ctx, x, y, o.color || '#3c7fd6'); break;
      case 'trash': R.drawTrash(ctx, x + (o.shake > 0 ? Math.sin(t * 60) * 2 : 0), y); break;
      case 'campfire': R.drawCampfire(ctx, x, y, t, o.lit); break;
      case 'firepit': R.drawCampfire(ctx, x, y, t, o.lit); break;
      case 'car': R.blit(ctx, carSprite(o.color), x, y); break;
      case 'truck': R.blit(ctx, carSprite('#f3f1ea', true), x, y); break;
      case 'building':
        s = buildingSprite(o);
        if (o.fade) { ctx.globalAlpha = 0.45; R.blit(ctx, s, x, y); ctx.globalAlpha = 1; }
        else R.blit(ctx, s, x, y);
        break;
      case 'logseat': drawLog(ctx, x, y, 20, true); break;
      case 'logseat2': drawLog(ctx, x, y, 40, false); break;
      case 'log': drawLog(ctx, x, y, 60, false); break;
      case 'stump':
        shadow(ctx, x + 2, y + 2, 14, 5);
        ctx.fillStyle = '#6b4526'; ctx.fillRect(x - 11, y - 12, 22, 12);
        ell(ctx, x, y - 12, 11, 5, '#c79a5e'); ctx.strokeStyle = '#9a6f3d'; ctx.lineWidth = 1; ell(ctx, x, y - 12, 6, 2.6); ctx.stroke();
        break;
      case 'sign': R.drawSign(ctx, x, y); break;
      case 'lamp': R.drawLamp(ctx, x, y, G && G.dark > 0.2); break;
      case 'clothesline': R.drawClothesline(ctx, x, y, t, !(G && G.flags.shirtTaken)); break;
      case 'cave': R.drawCave(ctx, x, y, t); break;
      case 'pump':
        shadow(ctx, x, y + 1, 8, 3); ctx.fillStyle = '#3d6e8f'; ctx.fillRect(x - 4, y - 22, 8, 22); ctx.fillRect(x - 4, y - 22, 14, 4); ctx.fillRect(x - 10, y - 18, 6, 3); break;
      case 'flagpole':
        shadow(ctx, x + 2, y + 1, 5, 2); ctx.fillStyle = '#ddd'; ctx.fillRect(x - 1.5, y - 70, 3, 70);
        ctx.fillStyle = '#3f8a4f'; ctx.beginPath(); ctx.moveTo(x + 1.5, y - 70);
        for (var f = 0; f <= 4; f++) ctx.lineTo(x + 1.5 + f * 7, y - 70 + Math.sin(t * 4 + f) * 2);
        for (f = 4; f >= 0; f--) ctx.lineTo(x + 1.5 + f * 7, y - 56 + Math.sin(t * 4 + f) * 2);
        ctx.fill(); break;
      case 'outhouse':
        shadow(ctx, x + 3, y + 2, 22, 6); ctx.fillStyle = '#8a5c33'; ctx.fillRect(x - 18, y - 46, 36, 46);
        ctx.fillStyle = '#6b4526'; ctx.fillRect(x - 21, y - 52, 42, 8);
        ctx.fillStyle = '#5a391d'; ctx.fillRect(x - 10, y - 36, 20, 36);
        ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.arc(x, y - 30, 3, 0.3, PI - 0.3); ctx.fill(); break;
      case 'woodpile':
        shadow(ctx, x, y + 1, 22, 5);
        for (var w = 0; w < 3; w++) for (var c = 0; c < 4 - w; c++) { circ(ctx, x - 15 + c * 10 + w * 5, y - 5 - w * 8, 5, '#8a5c33'); circ(ctx, x - 15 + c * 10 + w * 5, y - 5 - w * 8, 3, '#c79a5e'); }
        break;
      case 'vending': R.drawMachine(ctx, x, y, '#d23c3c', 'SODA'); break;
      case 'recycler': R.drawMachine(ctx, x, y, '#2f9a5a', 'CANS'); break;
      case 'umbrella':
        ctx.fillStyle = '#ddd'; ctx.fillRect(x - 1, y - 44, 2, 44);
        ell(ctx, x, y - 46, 30, 12, o.color); ell(ctx, x, y - 48, 22, 7, shade(o.color, 0.3));
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        for (var u = 0; u < 6; u++) { var a = u / 6 * TAU; ctx.beginPath(); ctx.moveTo(x, y - 48); ctx.lineTo(x + Math.cos(a) * 30, y - 46 + Math.sin(a) * 12); ctx.stroke(); }
        break;
      case 'towel':
        ctx.fillStyle = o.color; ctx.fillRect(x - 14, y - 24, 28, 44);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (var tw = 0; tw < 4; tw++) ctx.fillRect(x - 14, y - 20 + tw * 11, 28, 4);
        break;
      case 'partytable': R.drawPartyTable(ctx, x, y, o.active && o.hasCake, t); break;
      case 'balloons':
        if (!(G && G.party.active)) break;
        ['#e85d75', '#3fa7d6', '#f2c14e', '#7bc950'].forEach(function (col, k) {
          var bx2 = x + (k - 1.5) * 9 + Math.sin(t * 1.5 + k) * 2, by2 = y - 56 - (k % 2) * 10;
          ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx2, by2 + 9); ctx.stroke();
          ell(ctx, bx2, by2, 7, 9, col); ell(ctx, bx2 - 2, by2 - 3, 2, 3, 'rgba(255,255,255,0.5)');
        });
        break;
      case 'flag':
        circ(ctx, x, y, 4, '#2b3a1f');
        ctx.fillStyle = '#eee'; ctx.fillRect(x - 1, y - 46, 2, 46);
        ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.moveTo(x + 1, y - 46);
        ctx.quadraticCurveTo(x + 9, y - 44 + Math.sin(t * 5) * 2, x + 18, y - 40 + Math.sin(t * 5 + 1) * 2);
        ctx.lineTo(x + 1, y - 34); ctx.fill();
        break;
    }
  };

  function drawLog(ctx, x, y, len, vertical) {
    shadow(ctx, x + 2, y + 2, len / 2 + 2, 5);
    rrect(ctx, x - len / 2, y - 12, len, 12, 6, '#7a4f2a');
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x - len / 2 + 4, y - 10, len - 8, 3);
    ell(ctx, x + len / 2 - 2, y - 6, 3.5, 6, '#c79a5e');
  }

  R.drawBasket = function (ctx, x, y, full) {
    shadow(ctx, x, y + 1, 12, 3, 0.2);
    ctx.strokeStyle = '#7a5129'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y - 12, 9, PI, TAU); ctx.stroke();
    rrect(ctx, x - 11, y - 13, 22, 13, 3, '#c08a4a');
    ctx.strokeStyle = 'rgba(110,70,30,0.6)'; ctx.lineWidth = 1;
    for (var i = -8; i <= 8; i += 4) { ctx.beginPath(); ctx.moveTo(x + i, y - 12); ctx.lineTo(x + i, y - 1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - 11, y - 7); ctx.lineTo(x + 11, y - 7); ctx.stroke();
    if (full) {
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 10, y - 16, 20, 5);
      ctx.fillStyle = '#d64545'; for (var k = 0; k < 5; k++) ctx.fillRect(x - 10 + k * 4, y - 16 + (k % 2) * 2.5, 2, 2.5);
    }
  };
  R.drawCooler = function (ctx, x, y, color) {
    shadow(ctx, x + 1, y + 2, 15, 4);
    rrect(ctx, x - 13, y - 16, 26, 16, 3, color);
    rrect(ctx, x - 14, y - 20, 28, 7, 3, '#f4f4f0');
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 13, y - 4, 26, 4);
    ctx.fillStyle = '#ddd'; ctx.fillRect(x - 5, y - 23, 10, 3);
  };
  R.drawTrash = function (ctx, x, y) {
    shadow(ctx, x + 1, y + 1, 11, 4);
    rrect(ctx, x - 9, y - 24, 18, 24, 3, '#3f6e4a');
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x - 6, y - 22, 3, 20);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 9, y - 14); ctx.lineTo(x + 9, y - 14); ctx.stroke();
    ell(ctx, x, y - 25, 11, 4, '#2f5a3a'); ell(ctx, x, y - 27, 3, 1.5, '#555');
  };
  R.drawCampfire = function (ctx, x, y, t, lit) {
    for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; circ(ctx, x + Math.cos(a) * 13, y - 3 + Math.sin(a) * 6, 4.5, i % 2 ? '#8b8f96' : '#a3a7ad'); }
    ctx.save(); ctx.translate(x, y - 4);
    ctx.fillStyle = '#5c3d1e'; ctx.rotate(0.5); ctx.fillRect(-10, -2, 20, 4); ctx.rotate(-1); ctx.fillRect(-10, -2, 20, 4);
    ctx.restore();
    if (lit) {
      var f = Math.sin(t * 13) * 2, f2 = Math.cos(t * 17) * 2;
      ctx.fillStyle = 'rgba(255,120,30,0.95)'; ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.quadraticCurveTo(x - 6 + f, y - 22, x + f2 * 0.5, y - 28 - f); ctx.quadraticCurveTo(x + 7 + f2, y - 18, x + 9, y - 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,60,0.95)'; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.quadraticCurveTo(x - 3 - f2, y - 15, x + f * 0.4, y - 20 + f2); ctx.quadraticCurveTo(x + 4, y - 12, x + 5, y - 4); ctx.fill();
      for (var s = 0; s < 3; s++) {
        var p = ((t * 0.8 + s * 0.33) % 1);
        circ(ctx, x + Math.sin(t * 3 + s * 2) * 6, y - 26 - p * 30, 1.3 * (1 - p), 'rgba(255,200,80,' + (1 - p) + ')');
      }
    }
  };
  R.drawSign = function (ctx, x, y) {
    shadow(ctx, x + 2, y + 1, 12, 3);
    ctx.fillStyle = '#6b4526'; ctx.fillRect(x - 2, y - 26, 4, 26);
    rrect(ctx, x - 18, y - 38, 36, 18, 3, '#8a5c33');
    rrect(ctx, x - 16, y - 36, 32, 14, 2, '#a7773f');
    ctx.fillStyle = '#f2e3b8'; ctx.fillRect(x - 11, y - 32, 22, 2); ctx.fillRect(x - 11, y - 27, 16, 2);
  };
  R.drawLamp = function (ctx, x, y, on) {
    shadow(ctx, x + 2, y + 1, 6, 2);
    ctx.fillStyle = '#3a3d42'; ctx.fillRect(x - 2, y - 60, 4, 60);
    ctx.fillRect(x - 6, y - 4, 12, 4);
    rrect(ctx, x - 7, y - 70, 14, 12, 3, '#3a3d42');
    rrect(ctx, x - 5, y - 67, 10, 7, 2, on ? '#fff2b0' : '#c9d3dc');
  };
  R.drawMachine = function (ctx, x, y, color, label) {
    shadow(ctx, x + 2, y + 2, 16, 4);
    rrect(ctx, x - 14, y - 42, 28, 42, 3, color);
    rrect(ctx, x - 11, y - 38, 15, 22, 2, '#cfe8f5');
    for (var i = 0; i < 3; i++) { ctx.fillStyle = ['#f2c14e', '#e85d75', '#7bc950'][i]; ctx.fillRect(x - 9 + i * 4, y - 34, 3, 16); }
    ctx.fillStyle = '#222'; ctx.fillRect(x + 6, y - 36, 5, 8); ctx.fillRect(x - 11, y - 12, 22, 6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 2);
  };
  R.drawClothesline = function (ctx, x, y, t, hasShirt) {
    var x0 = x - 45, x1 = x + 45;
    shadow(ctx, x, y + 2, 48, 4, 0.15);
    ctx.fillStyle = '#7a5129'; ctx.fillRect(x0 - 2, y - 46, 4, 46); ctx.fillRect(x1 - 2, y - 46, 4, 46);
    ctx.fillRect(x0 - 7, y - 46, 14, 3); ctx.fillRect(x1 - 7, y - 46, 14, 3);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y - 44); ctx.quadraticCurveTo(x, y - 38, x1, y - 44); ctx.stroke();
    var sw = Math.sin(t * 2) * 1.5;
    // socks & towel
    ctx.fillStyle = '#f3efe6'; ctx.fillRect(x0 + 6 + sw, y - 43, 6, 12); ctx.fillRect(x0 + 6 + sw, y - 33, 9, 4);
    ctx.fillStyle = '#4fa3d8'; ctx.fillRect(x1 - 26 + sw, y - 42, 18, 24);
    if (hasShirt) R.drawShirtIcon(ctx, x - 4 + sw, y - 28, 26, 'plaid');
  };
  R.drawCave = function (ctx, x, y, t) {
    ctx.save();
    var gr = ctx.createRadialGradient(x, y - 10, 4, x, y - 10, 46);
    gr.addColorStop(0, '#0d0907'); gr.addColorStop(0.7, '#1f1712'); gr.addColorStop(1, '#3b3129');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x - 38, y + 6); ctx.quadraticCurveTo(x - 40, y - 48, x, y - 52); ctx.quadraticCurveTo(x + 40, y - 48, x + 38, y + 6); ctx.closePath(); ctx.fill();
    [[-40, -8, 12], [-36, -34, 11], [-18, -52, 11], [6, -56, 12], [28, -46, 11], [40, -20, 12], [42, 2, 10], [-44, 4, 10]].forEach(function (r) {
      circ(ctx, x + r[0], y + r[1] + 3, r[2], '#5b5e65'); circ(ctx, x + r[0], y + r[1], r[2], '#8d9198'); circ(ctx, x + r[0] - 3, y + r[1] - 3, r[2] * 0.4, '#a9adb3');
    });
    ctx.strokeStyle = '#4c8a3c'; ctx.lineWidth = 2;
    for (var i = 0; i < 5; i++) { var mx = x - 20 + i * 10; ctx.beginPath(); ctx.moveTo(mx, y - 50); ctx.quadraticCurveTo(mx + Math.sin(t + i) * 2, y - 40, mx + 1, y - 34 - (i % 2) * 6); ctx.stroke(); }
    // little bed of leaves visible inside
    ell(ctx, x + 10, y - 2, 16, 5, '#8a6a2a');
    ctx.restore();
  };
  R.drawPartyTable = function (ctx, x, y, cake, t) {
    shadow(ctx, x + 2, y + 2, 40, 8);
    ctx.fillStyle = '#ddd'; ctx.fillRect(x - 32, y - 12, 3, 12); ctx.fillRect(x + 29, y - 12, 3, 12);
    rrect(ctx, x - 36, y - 30, 72, 22, 3, '#f7f3ea');
    ctx.fillStyle = '#e85d75'; for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(x - 36 + i * 8, y - 10); ctx.lineTo(x - 32 + i * 8, y - 4); ctx.lineTo(x - 28 + i * 8, y - 10); ctx.fill(); }
    if (cake) R.drawGiantCake(ctx, x, y - 22, t);
    else { ell(ctx, x, y - 20, 20, 6, '#fff'); ctx.fillStyle = '#e8b4c8'; ell(ctx, x - 4, y - 21, 5, 2); ctx.fill(); }
  };
  R.drawGiantCake = function (ctx, x, y, t) {
    ell(ctx, x, y + 1, 22, 6, '#fff');
    rrect(ctx, x - 18, y - 16, 36, 16, 3, '#f6c6d6'); ctx.fillStyle = '#fff'; ctx.fillRect(x - 18, y - 16, 36, 3);
    rrect(ctx, x - 13, y - 30, 26, 14, 3, '#fbe0ea'); ctx.fillStyle = '#fff'; ctx.fillRect(x - 13, y - 30, 26, 3);
    rrect(ctx, x - 8, y - 41, 16, 11, 3, '#f6c6d6'); ctx.fillStyle = '#fff'; ctx.fillRect(x - 8, y - 41, 16, 3);
    ['#e85d75', '#3fa7d6', '#7bc950'].forEach(function (c, i) {
      var cx = x - 5 + i * 5;
      ctx.fillStyle = c; ctx.fillRect(cx - 1, y - 49, 2, 8);
      circ(ctx, cx, y - 51 + Math.sin(t * 12 + i) * 0.5, 1.8, '#ffcf4a');
    });
    for (var k = 0; k < 6; k++) circ(ctx, x - 15 + k * 6, y - 8, 1.6, '#e85d75');
  };

  // ---------- pickups ----------
  R.drawPickup = function (ctx, p, t) {
    var bob = Math.sin(t * 3 + p.x) * 1.5;
    shadow(ctx, p.x, p.y + 1, 9, 3, 0.2);
    if (p.item === 'stick') {
      ctx.save(); ctx.translate(p.x, p.y - 3 + bob); ctx.rotate(-0.35);
      ctx.fillStyle = '#7a4f2a'; rrect(ctx, -12, -2, 24, 4, 2, '#7a4f2a');
      ctx.fillRect(2, -6, 2, 5); ctx.fillStyle = '#5aa24a'; ell(ctx, 4, -7, 3, 2);
      ctx.restore();
    } else if (p.item === 'mushroom') {
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(p.x - 2.5, p.y - 8 + bob, 5, 8);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 8 + bob, 8, 6, 0, PI, TAU); ctx.fillStyle = '#d6324a'; ctx.fill();
      circ(ctx, p.x - 3, p.y - 10 + bob, 1.4, '#fff'); circ(ctx, p.x + 3, p.y - 11 + bob, 1.2, '#fff'); circ(ctx, p.x, p.y - 12.5 + bob, 1, '#fff');
    } else if (p.item === 'can') {
      ctx.save(); ctx.translate(p.x, p.y - 4 + bob); ctx.rotate(0.3);
      rrect(ctx, -7, -4, 14, 8, 2, '#c7ccd2'); ctx.fillStyle = '#d64545'; ctx.fillRect(-3, -4, 6, 8);
      ell(ctx, 7, 0, 1.6, 4, '#9aa0a8');
      ctx.restore();
    }
    var sp = (Math.sin(t * 4 + p.y) + 1) / 2;
    if (sp > 0.85) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(p.x + 6, p.y - 14, 2, 6); ctx.fillRect(p.x + 4, p.y - 12, 6, 2); }
  };

  R.drawBridge = function (ctx, fixed, t) {
    var b = W.bridge;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    if (fixed) ctx.fillRect(b.x0 + 4, b.y0 + 6, b.x1 - b.x0, b.y1 - b.y0);
    else { ctx.fillRect(b.x0 + 4, b.y0 + 6, b.x1 - b.x0, b.gap0 - b.y0 - 6); ctx.fillRect(b.x0 + 4, b.gap1 + 6, b.x1 - b.x0, b.y1 - b.gap1 - 6); }
    for (var y = b.y0; y < b.y1; y += 8) {
      if (!fixed && y + 8 > b.gap0 && y < b.gap1) {
        if ((y / 8) % 3 === 0) { ctx.save(); ctx.translate((b.x0 + b.x1) / 2 + 8, y + 4 + Math.sin(t * 2 + y) * 1.5); ctx.rotate(0.4); ctx.fillStyle = '#8a6236'; ctx.fillRect(-14, -3, 22, 6); ctx.restore(); }
        continue;
      }
      ctx.fillStyle = (y / 8) % 2 ? '#a7773f' : '#9a6b37';
      ctx.fillRect(b.x0, y, b.x1 - b.x0, 7);
    }
    ctx.fillStyle = '#6b4526';
    function rail(x) {
      if (fixed) ctx.fillRect(x - 2, b.y0 - 10, 4, b.y1 - b.y0 + 10);
      else { ctx.fillRect(x - 2, b.y0 - 10, 4, b.gap0 - b.y0 + 10); ctx.fillRect(x - 2, b.gap1, 4, b.y1 - b.gap1); }
      for (var py = b.y0; py <= b.y1; py += 24) if (fixed || py < b.gap0 || py > b.gap1) ctx.fillRect(x - 3, py - 12, 6, 14);
    }
    rail(b.x0 + 2); rail(b.x1 - 2);
    if (fixed) { ctx.fillStyle = '#c99a5e'; ctx.fillRect(b.x0 + 6, b.gap0, b.x1 - b.x0 - 12, 3); }
  };
  R.drawDam = function (ctx, x, y) {
    for (var i = 0; i < 7; i++) {
      ctx.save(); ctx.translate(x - 30 + i * 9, y - 30 + i * 9); ctx.rotate(1.1 + (i % 2) * 0.3);
      rrect(ctx, -18, -4, 36, 8, 4, i % 2 ? '#7a4f2a' : '#8a5c33'); ell(ctx, 17, 0, 3, 4, '#c79a5e');
      ctx.restore();
    }
  };

  // ---------- characters ----------
  R.drawSasquatch = function (ctx, x, y, o) {
    var face = o.face || 'down', t = o.t || 0;
    var fur = '#7b4b2a', furD = '#57331a', furL = '#a46e44', skin = '#d8b28a';
    var moving = o.moving, p = moving ? Math.sin(t * (o.run ? 15 : 10)) : 0;
    var bob = moving ? Math.abs(p) * 2 : Math.sin(t * 2) * 0.6;
    var top = o.top && o.top !== 'none' ? SS.TOPS[o.top] : null;
    var hatId = o.hat && o.hat !== 'none' ? o.hat : null;
    ctx.save(); ctx.translate(x, y);
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (!o.seated) {
      shadow(ctx, 0, 0, 17, 6, 0.28);
      if (face === 'left' || face === 'right') {
        ell(ctx, p * 6, -2, 7, 4, furD); ell(ctx, -p * 6, -2, 7, 4, '#4a2a14');
      } else {
        ell(ctx, -7, -2 + p * 2.5, 6.5, 4.5, furD); ell(ctx, 7, -2 - p * 2.5, 6.5, 4.5, furD);
      }
    }
    var by = -21 - bob;
    var carry = o.carry;
    // arms behind for up-facing
    function arm(side, swing) {
      ctx.save();
      var ax = side * 14, ay = by - 2;
      ctx.translate(ax, ay - 6);
      ctx.rotate(carry ? side * -2.6 : swing * 0.5 * side);
      ell(ctx, 0, 8, 5.5, 10, fur);
      if (top) { ctx.beginPath(); ctx.ellipse(0, 3, 6, 6, 0, PI, TAU); ctx.fillStyle = top.color; ctx.fill(); ctx.fillRect(-6, 3, 12, 3); }
      ell(ctx, 0, 16, 4.5, 4, furD);
      ctx.restore();
    }
    if (face === 'up') { arm(-1, p); arm(1, -p); }
    if (face === 'right') arm(-1, -p);
    if (face === 'left') arm(1, p);
    // body
    ell(ctx, 0, by, 15, 17, furD);
    ell(ctx, 0, by - 0.5, 14, 16, fur);
    if (top) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, by - 0.5, 14, 16, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = top.color; ctx.fillRect(-16, by - 17, 32, 26);
      R.shirtPattern(ctx, o.top, -16, by - 17, 32, 26, face);
      ctx.restore();
    } else if (face !== 'up') {
      ell(ctx, face === 'left' ? -4 : face === 'right' ? 4 : 0, by + 3, 8.5, 10, furL);
    }
    // fur strokes
    ctx.strokeStyle = 'rgba(60,35,15,0.45)'; ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) { var fx = -9 + i * 6; ctx.beginPath(); ctx.moveTo(fx, by + 12); ctx.lineTo(fx + 1.5, by + 16); ctx.stroke(); }
    if (face === 'down') { arm(-1, p); arm(1, -p); }
    if (face === 'right') arm(1, p);
    if (face === 'left') arm(-1, -p);
    // head
    var hy = by - 19;
    if (top && o.top === 'hoodie') ell(ctx, 0, hy + 7, 14, 7, shade(top.color, -0.15));
    if (face !== 'left') circ(ctx, -11, hy - 2, 4, furD);
    if (face !== 'right') circ(ctx, 11, hy - 2, 4, furD);
    circ(ctx, 0, hy, 12.5, furD);
    circ(ctx, 0, hy - 0.5, 12, fur);
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.moveTo(-5, hy - 10); ctx.lineTo(-2, hy - 16); ctx.lineTo(1, hy - 11); ctx.lineTo(4, hy - 15); ctx.lineTo(6, hy - 9); ctx.fill();
    if (face === 'down') {
      ell(ctx, 0, hy + 3, 8.5, 7.5, skin);
      circ(ctx, -3.6, hy + 0.5, 1.9, '#1a1008'); circ(ctx, 3.6, hy + 0.5, 1.9, '#1a1008');
      circ(ctx, -3.1, hy, 0.6, '#fff'); circ(ctx, 4.1, hy, 0.6, '#fff');
      ctx.strokeStyle = furD; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-6, hy - 3); ctx.lineTo(-2, hy - 2.2); ctx.moveTo(6, hy - 3); ctx.lineTo(2, hy - 2.2); ctx.stroke();
      ell(ctx, 0, hy + 4, 2.4, 1.7, '#3b2312');
      ctx.strokeStyle = '#5a3519'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, hy + 5.5, 2.5, 0.3, PI - 0.3); ctx.stroke();
    } else if (face === 'left' || face === 'right') {
      var sd = face === 'left' ? -1 : 1;
      ell(ctx, sd * 5.5, hy + 3, 6.5, 7, skin);
      circ(ctx, sd * 6, hy + 0.5, 1.9, '#1a1008'); circ(ctx, sd * 6.5, hy, 0.6, '#fff');
      ctx.strokeStyle = furD; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sd * 3, hy - 2.5); ctx.lineTo(sd * 8.5, hy - 2); ctx.stroke();
      ell(ctx, sd * 11, hy + 4, 2, 1.7, '#3b2312');
    } else {
      ctx.strokeStyle = 'rgba(60,35,15,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-4, hy + 2); ctx.lineTo(-3, hy + 8); ctx.moveTo(3, hy + 2); ctx.lineTo(4, hy + 8); ctx.stroke();
    }
    if (top && o.top === 'tux' && face === 'down') {
      ctx.fillStyle = '#d23c3c'; ctx.beginPath(); ctx.moveTo(-5, hy + 12); ctx.lineTo(0, hy + 14); ctx.lineTo(5, hy + 12); ctx.lineTo(5, hy + 17); ctx.lineTo(0, hy + 15); ctx.lineTo(-5, hy + 17); ctx.fill();
    }
    if (hatId) R.drawHat(ctx, hatId, 0, hy, face);
    if (carry === 'giantcake') R.drawGiantCake(ctx, 0, hy - 14, t);
    ctx.restore();
  };

  R.shirtPattern = function (ctx, id, x, y, w, h, face) {
    var t = SS.TOPS[id];
    if (id === 'plaid') {
      ctx.fillStyle = 'rgba(40,10,10,0.45)';
      for (var i = 0; i < w; i += 7) ctx.fillRect(x + i, y, 2.5, h);
      for (var j = 0; j < h; j += 7) ctx.fillRect(x, y + j, w, 2.5);
      ctx.fillStyle = 'rgba(255,220,200,0.25)';
      for (i = 3; i < w; i += 7) ctx.fillRect(x + i, y, 1, h);
    } else if (id === 'hawaiian') {
      var rnd = SS.rng(7);
      for (var k = 0; k < 14; k++) { var fx = x + rnd() * w, fy = y + rnd() * h; for (var p = 0; p < 5; p++) circ(ctx, fx + Math.cos(p * 1.26) * 2.2, fy + Math.sin(p * 1.26) * 2.2, 1.5, t.dots); circ(ctx, fx, fy, 1, '#e85d75'); }
    } else if (id === 'polo') {
      if (face !== 'up') { ctx.fillStyle = t.stripe; ctx.beginPath(); ctx.moveTo(x + w / 2 - 7, y); ctx.lineTo(x + w / 2, y + 7); ctx.lineTo(x + w / 2 + 7, y); ctx.fill(); circ(ctx, x + w / 2 + 6, y + 12, 1.8, t.stripe); }
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, y + h - 6, w, 6);
    } else if (id === 'tux') {
      if (face === 'down') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + w / 2 - 6, y); ctx.lineTo(x + w / 2, y + 16); ctx.lineTo(x + w / 2 + 6, y); ctx.fill(); circ(ctx, x + w / 2, y + 10, 0.8, '#222'); circ(ctx, x + w / 2, y + 13, 0.8, '#222'); }
    } else if (id === 'hoodie') {
      if (face === 'down') { ctx.fillStyle = 'rgba(0,0,0,0.15)'; rrect(ctx, x + w / 2 - 7, y + h - 10, 14, 7, 2, 'rgba(0,0,0,0.15)'); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w / 2 - 3, y + 1); ctx.lineTo(x + w / 2 - 3, y + 8); ctx.moveTo(x + w / 2 + 3, y + 1); ctx.lineTo(x + w / 2 + 3, y + 8); ctx.stroke(); }
    }
  };

  R.drawHat = function (ctx, id, x, hy, face) {
    var h = SS.HATS[id], c = h.color;
    if (id === 'bucket') {
      ell(ctx, x, hy - 6, 16, 5.5, shade(c, -0.15));
      ctx.beginPath(); ctx.moveTo(x - 10, hy - 6); ctx.lineTo(x - 8, hy - 17); ctx.quadraticCurveTo(x, hy - 20, x + 8, hy - 17); ctx.lineTo(x + 10, hy - 6); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = shade(c, -0.3); ctx.fillRect(x - 10, hy - 9, 20, 3);
    } else if (id === 'cap') {
      if (face === 'up') ell(ctx, x, hy - 3, 7, 3, shade(c, -0.2));
      ctx.beginPath(); ctx.arc(x, hy - 4, 12.5, PI, TAU); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      circ(ctx, x, hy - 16, 1.8, shade(c, -0.3));
      if (face === 'down') ell(ctx, x, hy - 3, 10, 3.5, shade(c, -0.2));
      if (face === 'left') ell(ctx, x - 12, hy - 4, 7, 2.5, shade(c, -0.2));
      if (face === 'right') ell(ctx, x + 12, hy - 4, 7, 2.5, shade(c, -0.2));
      ctx.fillStyle = '#fff'; if (face === 'down') ctx.fillRect(x - 2.5, hy - 12, 5, 4);
    } else if (id === 'toque') {
      ctx.beginPath(); ctx.arc(x, hy - 3, 12.5, PI, TAU); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = shade(c, -0.25); ctx.fillRect(x - 12.5, hy - 6, 25, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
      for (var i = -9; i <= 9; i += 3) { ctx.beginPath(); ctx.moveTo(x + i, hy - 6); ctx.lineTo(x + i, hy - 1); ctx.stroke(); }
      circ(ctx, x, hy - 16, 4, '#f4f4f0');
    } else if (id === 'cowboy') {
      ell(ctx, x, hy - 6, 21, 6.5, shade(c, -0.15));
      ctx.beginPath(); ctx.moveTo(x - 10, hy - 6); ctx.lineTo(x - 9, hy - 19); ctx.quadraticCurveTo(x - 4, hy - 22, x, hy - 18); ctx.quadraticCurveTo(x + 4, hy - 22, x + 9, hy - 19); ctx.lineTo(x + 10, hy - 6); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = '#3b2312'; ctx.fillRect(x - 10, hy - 10, 20, 3);
    } else if (id === 'tophat') {
      ell(ctx, x, hy - 8, 15, 4.5, c);
      ctx.fillStyle = c; ctx.fillRect(x - 9, hy - 30, 18, 22);
      ell(ctx, x, hy - 30, 9, 2.5, '#3a3a44');
      ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 9, hy - 13, 18, 4);
    }
  };

  // Humans: look = {skin, hair, hairStyle, shirt, pants, ranger}
  R.drawHuman = function (ctx, x, y, o) {
    var look = o.look, face = o.face || 'down', t = o.t || 0;
    var p = o.moving ? Math.sin(t * (o.run ? 16 : 10)) : 0;
    var bob = o.moving ? Math.abs(p) * 1.5 : 0;
    var scared = o.scared;
    var shake = scared ? Math.sin(t * 40) * 1 : 0;
    ctx.save(); ctx.translate(x + shake, y);
    shadow(ctx, 0, 0, 11, 4, 0.25);
    var sit = o.sitting;
    var legY = sit ? -6 : -12;
    if (!sit) {
      if (face === 'left' || face === 'right') {
        ctx.fillStyle = look.pants; ctx.fillRect(-3 + p * 3, -12, 5, 11); ctx.fillRect(-3 - p * 3, -12, 5, 11);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-3 + p * 3 + (face === 'right' ? 1 : -1), -2, 6, 2.5); ctx.fillRect(-3 - p * 3 + (face === 'right' ? 1 : -1), -2, 6, 2.5);
      } else {
        ctx.fillStyle = look.pants; ctx.fillRect(-6, -12 + p * 1.5, 5, 11); ctx.fillRect(1, -12 - p * 1.5, 5, 11);
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-6, -2 + p * 1.5, 5, 2.5); ctx.fillRect(1, -2 - p * 1.5, 5, 2.5);
      }
    } else {
      ctx.fillStyle = look.pants; ctx.fillRect(-7, -7, 14, 6);
    }
    var ty = legY - 14 - bob;
    function arm(side, sw) {
      ctx.save(); ctx.translate(side * 8.5, ty + 2);
      ctx.rotate(scared ? side * -2.5 : sw * 0.6 * side);
      ctx.fillStyle = look.shirt; ctx.fillRect(-2.5, 0, 5, 6);
      ctx.fillStyle = look.skin; ctx.fillRect(-2, 6, 4, 5);
      ctx.restore();
    }
    if (face === 'up') { arm(-1, p); arm(1, -p); }
    rrect(ctx, -8, ty, 16, 15, 4, look.shirt);
    if (look.ranger) {
      ctx.fillStyle = '#56693f'; ctx.fillRect(-8, ty + 11, 16, 4);
      if (face === 'down') { circ(ctx, -4, ty + 5, 1.8, '#f2c14e'); ctx.fillStyle = '#7a6a45'; ctx.fillRect(2, ty + 3, 4, 3); }
    }
    if (face !== 'up') { if (face === 'down') { arm(-1, p); arm(1, -p); } else arm(face === 'left' ? -1 : 1, p); }
    var hy = ty - 7;
    circ(ctx, 0, hy, 7.5, look.skin);
    ctx.fillStyle = look.hair;
    if (face === 'up') { circ(ctx, 0, hy - 0.5, 7.6, look.hair); }
    else {
      ctx.beginPath(); ctx.arc(0, hy - 1, 7.8, PI * 1.02, TAU * 0.99); ctx.fill();
      if (look.hairStyle === 1) { ctx.fillRect(-8, hy - 2, 3, 9); ctx.fillRect(5, hy - 2, 3, 9); }
      if (look.hairStyle === 2) circ(ctx, face === 'left' ? 6 : -6, hy - 4, 3.5, look.hair);
    }
    if (look.hairStyle === 1 && face === 'up') { ctx.fillRect(-7, hy, 14, 8); }
    if (face === 'down') {
      circ(ctx, -2.6, hy + 1, 1.1, '#222'); circ(ctx, 2.6, hy + 1, 1.1, '#222');
      if (scared) { ell(ctx, 0, hy + 4.5, 1.8, 2.2, '#5a1a1a'); }
      else { ctx.strokeStyle = 'rgba(90,40,30,0.7)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, hy + 3.2, 1.8, 0.4, PI - 0.4); ctx.stroke(); }
    } else if (face !== 'up') {
      var sd = face === 'left' ? -1 : 1;
      circ(ctx, sd * 4, hy + 1, 1.1, '#222');
      if (scared) ell(ctx, sd * 5, hy + 4, 1.2, 1.8, '#5a1a1a');
    }
    if (look.ranger) {
      ell(ctx, 0, hy - 5, 12.5, 4, '#a88f58');
      ctx.fillStyle = '#c4a96c'; ctx.beginPath(); ctx.moveTo(-6, hy - 5); ctx.lineTo(-4, hy - 13); ctx.lineTo(0, hy - 11); ctx.lineTo(4, hy - 13); ctx.lineTo(6, hy - 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-6, hy - 7, 12, 2);
    } else if (look.hat) {
      ctx.beginPath(); ctx.arc(0, hy - 2, 8, PI, TAU); ctx.fillStyle = look.hat; ctx.fill();
      if (face === 'down') ell(ctx, 0, hy - 2, 7, 2.5, shade(look.hat, -0.2));
      if (face === 'left') ell(ctx, -8, hy - 2, 5, 2, shade(look.hat, -0.2));
      if (face === 'right') ell(ctx, 8, hy - 2, 5, 2, shade(look.hat, -0.2));
    }
    if (o.flashlight) {
      var fd = face === 'left' ? -1 : face === 'right' ? 1 : 0;
      ctx.fillStyle = '#333'; ctx.fillRect(fd * 9 - 2 + (fd === 0 ? 8 : 0), ty + 8, 5, 4);
    }
    ctx.restore();
  };

  R.drawRaccoon = function (ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    shadow(ctx, 0, 0, 14, 4.5);
    var sw = Math.sin(t * 3) * 0.3;
    ctx.save(); ctx.translate(9, -6); ctx.rotate(-0.6 + sw);
    for (var i = 0; i < 5; i++) ell(ctx, i * 3.4, -i * 1.2, 4.5, 4, i % 2 ? '#3a3a3e' : '#9a9aa2');
    ctx.restore();
    var br = Math.sin(t * 2.2) * 0.6;
    ell(ctx, 0, -10, 10, 10 + br, '#8d8d95');
    ell(ctx, 0, -7, 6, 6, '#b5b5bd');
    circ(ctx, -7, -26, 3.5, '#6f6f77'); circ(ctx, 7, -26, 3.5, '#6f6f77');
    circ(ctx, -7, -26, 1.6, '#e8c8c8'); circ(ctx, 7, -26, 1.6, '#e8c8c8');
    circ(ctx, 0, -21, 9, '#9d9da5');
    ell(ctx, 0, -18, 6, 4.5, '#f2f2f2');
    ell(ctx, -3.6, -21.5, 3.6, 2.4, '#2a2a2e'); ell(ctx, 3.6, -21.5, 3.6, 2.4, '#2a2a2e');
    circ(ctx, -3.4, -21.6, 1.2, '#fff'); circ(ctx, 3.8, -21.6, 1.2, '#fff');
    circ(ctx, 0, -17, 1.6, '#222');
    ell(ctx, -5, -2, 3, 2, '#3a3a3e'); ell(ctx, 5, -2, 3, 2, '#3a3a3e');
    ctx.restore();
  };
  R.drawBear = function (ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    shadow(ctx, 0, 0, 26, 7);
    var br = Math.sin(t * 1.6) * 1;
    ell(ctx, -12, -4, 8, 6, '#5a3519'); ell(ctx, 12, -4, 8, 6, '#5a3519');
    ell(ctx, 0, -20, 22, 20 + br, '#6b4022');
    ell(ctx, 0, -16, 13, 13, '#8a5a34');
    circ(ctx, -13, -48, 6, '#5a3519'); circ(ctx, 13, -48, 6, '#5a3519');
    circ(ctx, -13, -48, 3, '#8a5a34'); circ(ctx, 13, -48, 3, '#8a5a34');
    circ(ctx, 0, -40, 15, '#6b4022');
    ell(ctx, 0, -35, 8, 6.5, '#b88a5c');
    ell(ctx, 0, -38, 3, 2.2, '#2a1a0e');
    var blink = Math.sin(t * 0.9) > 0.96;
    if (blink) { ctx.fillStyle = '#2a1a0e'; ctx.fillRect(-8, -44, 5, 1.5); ctx.fillRect(3, -44, 5, 1.5); }
    else { circ(ctx, -5.5, -44, 1.9, '#1a1008'); circ(ctx, 5.5, -44, 1.9, '#1a1008'); }
    ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -34, 2.5, 0.3, PI - 0.3); ctx.stroke();
    ell(ctx, -16, -24, 6, 10, '#5a3519', 0.4); ell(ctx, 16, -24, 6, 10, '#5a3519', -0.4);
    ctx.restore();
  };
  R.drawBeaver = function (ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y);
    shadow(ctx, 0, 0, 14, 4.5);
    var tl = Math.sin(t * 4) * 0.15;
    ctx.save(); ctx.translate(6, -2); ctx.rotate(0.3 + tl);
    ell(ctx, 8, 0, 10, 5, '#3e2c22');
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.8;
    for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 4, -4); ctx.lineTo(4 + i * 4, 4); ctx.stroke(); }
    ctx.restore();
    ell(ctx, 0, -10, 10, 11, '#8a5a34');
    ell(ctx, 0, -7, 6, 6, '#b88a5c');
    circ(ctx, -6, -27, 2.6, '#6b4022'); circ(ctx, 6, -27, 2.6, '#6b4022');
    circ(ctx, 0, -21, 9, '#8a5a34');
    ell(ctx, 0, -17, 5.5, 4, '#b88a5c');
    circ(ctx, -3.6, -23, 1.6, '#1a1008'); circ(ctx, 3.6, -23, 1.6, '#1a1008');
    circ(ctx, 0, -19, 1.8, '#2a1a0e');
    ctx.fillStyle = '#fff8e0'; ctx.fillRect(-2.2, -16.5, 2, 3.5); ctx.fillRect(0.2, -16.5, 2, 3.5);
    ell(ctx, -5, -2, 3, 2, '#5a3519'); ell(ctx, 5, -2, 3, 2, '#5a3519');
    ctx.restore();
  };

  // ---------- vehicles (top-down, rotated) ----------
  R.drawVehicle = function (ctx, v, t, rider) {
    ctx.save(); ctx.translate(v.x, v.y);
    if (v.type === 'boat') {
      ell(ctx, 3, 4, 34, 16, 'rgba(0,30,60,0.25)', v.angle);
      ctx.rotate(v.angle);
      ctx.beginPath(); ctx.moveTo(34, 0); ctx.quadraticCurveTo(20, -15, -26, -13); ctx.lineTo(-30, 0); ctx.lineTo(-26, 13); ctx.quadraticCurveTo(20, 15, 34, 0); ctx.closePath();
      ctx.fillStyle = '#8a5c33'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(29, 0); ctx.quadraticCurveTo(18, -11, -23, -9.5); ctx.lineTo(-26, 0); ctx.lineTo(-23, 9.5); ctx.quadraticCurveTo(18, 11, 29, 0); ctx.closePath();
      ctx.fillStyle = '#c4935a'; ctx.fill();
      ctx.fillStyle = '#8a5c33'; ctx.fillRect(-14, -10, 5, 20); ctx.fillRect(8, -10, 5, 20);
      var oa = rider ? Math.sin(t * 6) * 0.5 : 0.2;
      ctx.strokeStyle = '#6b4526'; ctx.lineWidth = 2.5;
      [-1, 1].forEach(function (s) { ctx.save(); ctx.translate(-2, s * 11); ctx.rotate(s * (1.4 + oa)); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.stroke(); ell(ctx, 24, 0, 5, 2.5, '#6b4526'); ctx.restore(); });
    } else if (v.type === 'kart') {
      ell(ctx, 2, 4, 26, 16, 'rgba(0,0,0,0.25)', v.angle);
      ctx.rotate(v.angle);
      [[-14, -14], [-14, 14], [14, -15], [14, 15]].forEach(function (w) { rrect(ctx, w[0] - 6, w[1] - 4, 12, 8, 2, '#1e1e22'); });
      rrect(ctx, -20, -11, 42, 22, 7, '#e0412f');
      rrect(ctx, 14, -9, 10, 18, 4, '#f2c14e');
      rrect(ctx, -12, -8, 14, 16, 4, '#2b2b30');
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(6, 0, 5, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.translate(-16, 0); ctx.rotate(PI / 2); ctx.fillText('7', 0, 0); ctx.restore();
    } else if (v.type === 'golfcart') {
      ell(ctx, 2, 4, 28, 18, 'rgba(0,0,0,0.25)', v.angle);
      ctx.rotate(v.angle);
      [[-14, -15], [-14, 15], [16, -15], [16, 15]].forEach(function (w) { rrect(ctx, w[0] - 6, w[1] - 4, 12, 8, 2, '#1e1e22'); });
      rrect(ctx, -24, -14, 50, 28, 6, '#f2f2ec');
      rrect(ctx, -22, -10, 12, 20, 3, '#c9b48a');
      if (!rider) { rrect(ctx, -12, -15, 30, 30, 4, 'rgba(47,122,64,0.92)'); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-10, -13, 26, 4); }
      else { rrect(ctx, -2, -9, 12, 18, 3, '#2b2b30'); }
    }
    ctx.restore();
    if (rider) {
      R.drawSasquatch(ctx, v.x, v.y + 6, { face: R.faceOf(v.angle), t: t, moving: false, hat: rider.hat, top: rider.top, seated: true, scale: 0.85 });
      if (v.type === 'golfcart') { ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle); rrect(ctx, -12, -15, 30, 30, 4, 'rgba(47,122,64,0.55)'); ctx.restore(); }
    }
  };

  // ---------- icons for the UI ----------
  var iconCache = {};
  R.iconURL = function (id, size) {
    size = size || 64;
    var key = id + '@' + size;
    if (iconCache[key]) return iconCache[key];
    var c = document.createElement('canvas'); c.width = size; c.height = size;
    var g = c.getContext('2d');
    g.scale(size / 64, size / 64);
    R.drawIcon(g, id);
    iconCache[key] = c.toDataURL();
    return iconCache[key];
  };
  R.drawShirtIcon = function (g, x, y, s, id) {
    var t = SS.TOPS[id];
    g.save(); g.translate(x, y); g.scale(s / 40, s / 40);
    g.beginPath(); g.moveTo(-10, -18); g.lineTo(-20, -12); g.lineTo(-17, -2); g.lineTo(-12, -4); g.lineTo(-12, 18); g.lineTo(12, 18); g.lineTo(12, -4); g.lineTo(17, -2); g.lineTo(20, -12); g.lineTo(10, -18); g.quadraticCurveTo(0, -12, -10, -18); g.closePath();
    g.fillStyle = t.color; g.fill();
    g.save(); g.clip(); R.shirtPattern(g, id, -20, -18, 40, 36, 'down'); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.stroke();
    g.restore();
  };
  function fishShape(g, color, gold) {
    g.save(); g.translate(32, 34);
    g.beginPath(); g.moveTo(-18, 0); g.lineTo(-28, -10); g.lineTo(-26, 0); g.lineTo(-28, 10); g.closePath(); g.fillStyle = shade(color, -0.2); g.fill();
    ell(g, 2, 0, 22, 11, color);
    ell(g, 4, 4, 16, 5, shade(color, 0.35));
    g.beginPath(); g.moveTo(-2, -10); g.quadraticCurveTo(6, -18, 12, -9); g.closePath(); g.fillStyle = shade(color, -0.2); g.fill();
    circ(g, 15, -2, 3, '#fff'); circ(g, 16, -2, 1.6, '#111');
    if (gold) { g.fillStyle = '#fff8c0'; [[-6, -14], [20, -14], [8, 16]].forEach(function (p) { g.fillRect(p[0] - 1, p[1] - 4, 2, 8); g.fillRect(p[0] - 4, p[1] - 1, 8, 2); }); }
    g.restore();
  }
  R.drawIcon = function (g, id) {
    var it = SS.ITEMS[id];
    if (it && it.type === 'fish') { fishShape(g, it.color, id === 'golden'); return; }
    if (id.indexOf('hat_') === 0) {
      var hid = id.slice(4);
      if (hid === 'none') { g.strokeStyle = '#b9a98a'; g.lineWidth = 3; g.setLineDash([5, 4]); circ(g, 32, 34, 16); g.stroke(); g.setLineDash([]); return; }
      R.drawHat(g, hid, 32, 52, 'down'); return;
    }
    if (id.indexOf('top_') === 0) {
      var tid = id.slice(4);
      if (tid === 'none') { circ(g, 32, 34, 18, '#7b4b2a'); ell(g, 32, 38, 10, 11, '#a46e44'); return; }
      R.drawShirtIcon(g, 32, 34, 44, tid); return;
    }
    g.save();
    switch (id) {
      case 'sandwich':
        g.beginPath(); g.moveTo(10, 44); g.lineTo(54, 44); g.lineTo(32, 16); g.closePath(); g.fillStyle = '#e9c88a'; g.fill();
        g.fillStyle = '#7cc04a'; g.fillRect(14, 40, 36, 4); g.fillStyle = '#e85d5d'; g.fillRect(16, 37, 32, 3);
        g.beginPath(); g.moveTo(10, 50); g.lineTo(54, 50); g.lineTo(54, 44); g.lineTo(10, 44); g.closePath(); g.fillStyle = '#d9ae6a'; g.fill();
        g.strokeStyle = '#a77a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 44); g.lineTo(32, 16); g.lineTo(54, 44); g.stroke();
        break;
      case 'apple': circ(g, 32, 36, 16, '#d63a3a'); ell(g, 26, 30, 4, 6, 'rgba(255,255,255,0.4)'); g.fillStyle = '#5a3519'; g.fillRect(31, 14, 3, 9); ell(g, 39, 17, 6, 3, '#5aa24a', -0.4); break;
      case 'hotdog':
        ell(g, 32, 36, 24, 10, '#e2b06a'); ell(g, 32, 33, 24, 6, '#c0503b'); g.strokeStyle = '#f2d04b'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(12, 33);
        for (var i = 0; i < 6; i++) g.lineTo(16 + i * 7, i % 2 ? 31 : 35); g.stroke(); break;
      case 'chips': rrect(g, 16, 12, 32, 42, 6, '#f2c14e'); rrect(g, 16, 12, 32, 8, 3, '#e0412f'); circ(g, 32, 36, 9, '#e8a33a'); g.fillStyle = '#c0503b'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('CHIPS', 32, 51); break;
      case 'soda': rrect(g, 20, 12, 24, 42, 5, '#d64545'); ell(g, 32, 13, 12, 3, '#c9ced4'); g.fillStyle = '#fff'; g.fillRect(20, 28, 24, 8); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(24, 16, 4, 34); break;
      case 'burger': ell(g, 32, 26, 20, 12, '#e2a24e'); g.fillStyle = '#7cc04a'; g.fillRect(12, 32, 40, 4); g.fillStyle = '#6b3a1e'; rrect(g, 12, 35, 40, 7, 3, '#6b3a1e'); g.fillStyle = '#f2c14e'; g.fillRect(14, 33, 36, 3); rrect(g, 13, 42, 38, 8, 4, '#e2a24e'); circ(g, 26, 22, 1, '#fff'); circ(g, 34, 20, 1, '#fff'); circ(g, 38, 25, 1, '#fff'); break;
      case 'pie': g.beginPath(); g.moveTo(10, 42); g.lineTo(54, 42); g.lineTo(50, 50); g.lineTo(14, 50); g.closePath(); g.fillStyle = '#c98a4a'; g.fill(); ell(g, 32, 40, 22, 9, '#7a3a6a'); g.strokeStyle = '#e9c08a'; g.lineWidth = 3; for (var j = 0; j < 4; j++) { g.beginPath(); g.moveTo(16 + j * 10, 33); g.lineTo(20 + j * 10, 47); g.stroke(); } g.beginPath(); g.ellipse(32, 40, 22, 9, 0, 0, TAU); g.stroke(); break;
      case 'cake': rrect(g, 12, 28, 40, 22, 4, '#f6c6d6'); g.fillStyle = '#fff'; g.fillRect(12, 28, 40, 5); ell(g, 32, 28, 20, 5, '#fff'); g.fillStyle = '#e85d75'; g.fillRect(31, 14, 3, 12); circ(g, 32.5, 12, 3, '#ffcf4a'); circ(g, 22, 40, 2, '#e85d75'); circ(g, 42, 40, 2, '#e85d75'); break;
      case 'cookie': circ(g, 32, 34, 18, '#d9a45a'); [[24, 28], [38, 30], [30, 40], [40, 42], [22, 40]].forEach(function (p) { circ(g, p[0], p[1], 2.6, '#5a3519'); }); break;
      case 'cheese': g.beginPath(); g.moveTo(10, 46); g.lineTo(54, 46); g.lineTo(54, 30); g.lineTo(10, 38); g.closePath(); g.fillStyle = '#f6d55c'; g.fill(); g.beginPath(); g.moveTo(10, 38); g.lineTo(54, 30); g.lineTo(40, 22); g.closePath(); g.fillStyle = '#fbe58a'; g.fill(); circ(g, 22, 41, 3, '#e3b93a'); circ(g, 40, 38, 2.5, '#e3b93a'); break;
      case 'watermelon': g.beginPath(); g.arc(32, 26, 22, 0.1, PI - 0.1); g.closePath(); g.fillStyle = '#3f8a3a'; g.fill(); g.beginPath(); g.arc(32, 26, 18, 0.1, PI - 0.1); g.closePath(); g.fillStyle = '#ef5a5a'; g.fill(); [[24, 34], [32, 38], [40, 34], [28, 30], [36, 30]].forEach(function (p) { ell(g, p[0], p[1], 1.2, 2, '#222'); }); break;
      case 'pizza': g.beginPath(); g.moveTo(12, 16); g.lineTo(52, 16); g.lineTo(32, 54); g.closePath(); g.fillStyle = '#f2c14e'; g.fill(); g.fillStyle = '#d9a45a'; g.fillRect(12, 12, 40, 6); [[24, 24], [38, 24], [32, 36]].forEach(function (p) { circ(g, p[0], p[1], 4, '#c0392b'); }); break;
      case 'marshmallow': [[22, 36], [36, 30], [40, 44]].forEach(function (p) { rrect(g, p[0] - 8, p[1] - 8, 16, 16, 5, '#f8f4ee'); ell(g, p[0], p[1] - 6, 8, 3, '#fff'); }); break;
      case 'berries': [[24, 36], [34, 30], [40, 40], [30, 44], [20, 46]].forEach(function (p, k) { circ(g, p[0], p[1], 7, k % 2 ? '#4a5fd0' : '#d6324a'); circ(g, p[0] - 2, p[1] - 2, 2, 'rgba(255,255,255,0.5)'); }); ell(g, 36, 20, 8, 4, '#5aa24a', -0.5); break;
      case 'mushroom': g.fillStyle = '#f2ead8'; g.fillRect(27, 30, 10, 20); g.beginPath(); g.ellipse(32, 30, 20, 15, 0, PI, TAU); g.fillStyle = '#d6324a'; g.fill(); circ(g, 24, 24, 3, '#fff'); circ(g, 36, 21, 3.5, '#fff'); circ(g, 42, 27, 2, '#fff'); break;
      case 'honey': rrect(g, 16, 22, 32, 30, 8, '#e8a422'); rrect(g, 14, 16, 36, 8, 3, '#8a5c33'); g.fillStyle = '#fff3c0'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('HONEY', 32, 41); break;
      case 'coffee': rrect(g, 18, 18, 26, 34, 4, '#f4f0e6'); g.fillStyle = '#8a5c33'; g.fillRect(18, 28, 26, 10); g.strokeStyle = '#f4f0e6'; g.lineWidth = 4; g.beginPath(); g.arc(46, 34, 6, -PI / 2, PI / 2); g.stroke(); g.strokeStyle = 'rgba(200,200,200,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(26, 14); g.quadraticCurveTo(30, 8, 26, 4); g.moveTo(34, 14); g.quadraticCurveTo(38, 8, 34, 4); g.stroke(); break;
      case 'leftovers': rrect(g, 12, 28, 40, 20, 4, '#f4f0e6'); ell(g, 26, 30, 8, 4, '#c98a4a'); ell(g, 38, 31, 7, 4, '#7cc04a'); ell(g, 32, 28, 5, 3, '#d64545'); break;
      case 'stick': g.translate(32, 32); g.rotate(-0.6); rrect(g, -24, -3, 48, 6, 3, '#7a4f2a'); g.fillStyle = '#7a4f2a'; g.fillRect(6, -12, 3, 10); ell(g, 8, -14, 5, 3, '#5aa24a'); break;
      case 'can': rrect(g, 20, 14, 24, 38, 5, '#c7ccd2'); g.fillStyle = '#d64545'; g.fillRect(20, 24, 24, 16); ell(g, 32, 14, 12, 3, '#9aa0a8'); g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText('POP', 32, 35); break;
      case 'rod': case 'prorod':
        g.strokeStyle = id === 'rod' ? '#8a5c33' : '#2c3e50'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(12, 54); g.lineTo(52, 10); g.stroke();
        g.strokeStyle = '#ddd'; g.lineWidth = 1; g.beginPath(); g.moveTo(52, 10); g.quadraticCurveTo(58, 30, 50, 46); g.stroke();
        circ(g, 22, 44, 6, id === 'rod' ? '#555' : '#d4a017'); circ(g, 50, 48, 3, '#e04040'); break;
      case 'bait': rrect(g, 16, 20, 32, 30, 5, '#8a6a4a'); g.strokeStyle = '#e88a9a'; g.lineWidth = 4; g.beginPath(); g.moveTo(22, 26); g.quadraticCurveTo(32, 14, 40, 24); g.stroke(); break;
      case 'flashlight': g.translate(32, 32); g.rotate(-0.6); rrect(g, -20, -6, 30, 12, 3, '#3a3d42'); rrect(g, 8, -9, 12, 18, 3, '#555a60'); ell(g, 20, 0, 3, 8, '#fff2b0'); break;
      case 'bigpack': rrect(g, 16, 14, 32, 40, 8, '#c0503b'); rrect(g, 20, 30, 24, 16, 4, '#a0402e'); g.strokeStyle = '#6b2a1e'; g.lineWidth = 3; g.beginPath(); g.arc(32, 16, 8, PI, TAU); g.stroke(); break;
      case 'kart': g.translate(32, 34); g.scale(1.1, 1.1); [[-14, -12], [-14, 12], [14, -12], [14, 12]].forEach(function (w) { rrect(g, w[0] - 6, w[1] - 4, 12, 8, 2, '#1e1e22'); }); rrect(g, -18, -9, 38, 18, 6, '#e0412f'); rrect(g, -8, -6, 12, 12, 3, '#2b2b30'); break;
      case 'money': rrect(g, 8, 20, 48, 26, 4, '#7bc96f'); circ(g, 32, 33, 8, '#5aa24a'); g.fillStyle = '#e8f5e0'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 32, 34); break;
      case 'giantcake': R.drawGiantCake(g, 32, 56, 0); break;
      default: circ(g, 32, 32, 14, '#999');
    }
    g.restore();
  };

  // Portraits for dialogue
  R.drawPortrait = function (g, who, t) {
    g.save();
    g.fillStyle = '#e8dcb8'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#d4c49a'; g.beginPath(); g.arc(48, 110, 60, 0, TAU); g.fill();
    if (who === 'raccoon') { g.translate(48, 92); g.scale(2.6, 2.6); R.drawRaccoon(g, 0, 0, t); }
    else if (who === 'bear') { g.translate(48, 110); g.scale(1.6, 1.6); R.drawBear(g, 0, 0, t); }
    else if (who === 'beaver') { g.translate(48, 92); g.scale(2.6, 2.6); R.drawBeaver(g, 0, 0, t); }
    else if (who === 'shop' || who === 'golf') {
      g.translate(48, 120); g.scale(2.6, 2.6);
      R.drawHuman(g, 0, 0, { face: 'down', t: t, look: who === 'shop' ? { skin: '#e9c09a', hair: '#8a8a8a', shirt: '#2f6b3a', pants: '#333', hairStyle: 0 } : { skin: '#c68e62', hair: '#2b1a10', shirt: '#f4f4ee', pants: '#2c3e50', hairStyle: 0, hat: '#3f8a4f' } });
    } else if (who === 'sasquatch') { g.translate(48, 120); g.scale(2.2, 2.2); R.drawSasquatch(g, 0, 0, { face: 'down', t: t, hat: SS.game && SS.game.player.outfit.hat, top: SS.game && SS.game.player.outfit.top }); }
    g.restore();
  };

  // ---------- lighting ----------
  var lc = null, lg = null;
  R.drawLighting = function (ctx, cam, dark, lights, tint) {
    var w = Math.ceil(cam.vw / 2), h = Math.ceil(cam.vh / 2);
    if (!lc) { lc = document.createElement('canvas'); lg = lc.getContext('2d'); }
    if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, w, h);
    lg.fillStyle = 'rgba(10,14,40,' + dark.toFixed(3) + ')';
    lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'destination-out';
    var s = cam.scale / 2;
    lights.forEach(function (l) {
      var x = (l.x - cam.x) * s, y = (l.y - cam.y) * s, r = l.r * s * (l.flicker || 1);
      if (x < -r || y < -r || x > w + r || y > h + r) return;
      if (l.cone) {
        lg.save(); lg.translate(x, y); lg.rotate(l.angle);
        var gr = lg.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = gr; lg.beginPath(); lg.moveTo(0, 0); lg.arc(0, 0, r, -l.cone, l.cone); lg.closePath(); lg.fill();
        lg.restore();
      } else {
        var g2 = lg.createRadialGradient(x, y, 0, x, y, r);
        g2.addColorStop(0, 'rgba(0,0,0,' + (l.strength || 1) + ')'); g2.addColorStop(0.5, 'rgba(0,0,0,' + ((l.strength || 1) * 0.6) + ')'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        lg.fillStyle = g2; lg.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lc, 0, 0, w, h, 0, 0, cam.vw * cam.dpr, cam.vh * cam.dpr);
    // warm glow
    ctx.globalCompositeOperation = 'lighter';
    var sd = cam.scale * cam.dpr;
    lights.forEach(function (l) {
      if (!l.color || l.cone) return;
      var x = (l.x - cam.x) * sd, y = (l.y - cam.y) * sd, r = l.r * sd * 0.6 * (l.flicker || 1);
      if (x < -r || y < -r || x > cam.vw * cam.dpr + r || y > cam.vh * cam.dpr + r) return;
      var g3 = ctx.createRadialGradient(x, y, 0, x, y, r);
      g3.addColorStop(0, l.color + (0.28 * dark).toFixed(3) + ')'); g3.addColorStop(1, l.color + '0)');
      ctx.fillStyle = g3; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.globalCompositeOperation = 'source-over';
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, cam.vw * cam.dpr, cam.vh * cam.dpr); }
    ctx.restore();
  };
})();
