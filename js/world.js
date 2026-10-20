/* Sneeky Sasquatch - world layout, terrain, collision, line of sight, pathfinding */
'use strict';
(function () {
  var W = SS.world = {};
  var clamp = SS.clamp;

  W.w = 3520; W.h = 2720;
  W.T = 16;           // terrain grid cell size
  W.N = 32;           // navigation grid cell size
  W.HC = 128;         // collider hash cell size
  W.DC = 256;         // drawable hash cell size

  // ---------- terrain shapes ----------
  W.lake = [[2450, 470, 470, 250], [2830, 520, 300, 210], [2120, 420, 240, 160]];
  W.beach = [2450, 742, 390, 64];
  W.ponds = [[2730, 2462, 82, 44]];
  W.riverRaw = [[-60, 1990], [400, 2030], [800, 1960], [1200, 1990], [1500, 2000], [1800, 1995], [2100, 2060], [2500, 2030], [2900, 2070], [3300, 2010], [3600, 2030]];
  W.river = SS.smoothPath(W.riverRaw, 10);
  W.riverW = 96;
  W.rocks = [[0, 0, 420], [300, 80, 300], [560, 120, 260], [780, 60, 220], [960, 0, 200], [1120, 0, 150],
    [120, 380, 200], [280, 330, 140], [470, 300, 130], [650, 330, 140], [800, 260, 120], [0, 600, 180], [60, 520, 150], [0, 760, 120]];
  W.bearRocks = [[250, 1722, 64], [328, 1694, 46], [182, 1778, 48]];
  W.dock = { x0: 2430, y0: 572, x1: 2470, y1: 752 };
  W.bridge = { x0: 1772, y0: 1922, x1: 1828, y1: 2070, gap0: 1966, gap1: 2024 };
  W.bridgeFixed = false;

  W.roads = [
    { pts: [[2090, 1390], [2600, 1390], [3020, 1390], [3600, 1390]], w: 64 },
    { pts: [[3020, 1390], [3020, 1760]], w: 56 },
    { pts: [[2250, 2340], [2250, 2780]], w: 56 }
  ];
  W.culdesac = [3020, 1770, 70];
  W.lots = [[2880, 1226, 3180, 1358], [2150, 2280, 2360, 2400]];
  W.dirt = [
    { pts: [[470, 470], [540, 600], [690, 750], [870, 880], [1010, 960], [1080, 1010]], w: 30 },
    { pts: [[620, 730], [545, 960], [470, 1300], [430, 1600], [405, 1790]], w: 24 },
    { pts: [[1550, 1600], [1585, 1740], [1700, 1860], [1800, 1928]], w: 30 },
    { pts: [[1800, 2066], [1800, 2200], [1830, 2330], [1990, 2336]], w: 30 },
    { pts: [[1550, 880], [1700, 830], [1950, 795], [2200, 770], [2450, 760]], w: 30 },
    { pts: [[1880, 1250], [1990, 1305], [2100, 1390]], w: 44 },
    { pts: [[2380, 1292], [2380, 1362]], w: 26 },
    { pts: [[3020, 1210], [3020, 1236]], w: 34 }
  ];
  W.loop = { x: 1550, y: 1250, rx: 330, ry: 200, w: 44 };
  W.fairways = [
    { a: [1000, 2300], b: [1490, 2244], w: 110, green: [1520, 2240, 50] },
    { a: [1000, 2560], b: [1650, 2610], w: 110, green: [1690, 2610, 52] },
    { a: [2450, 2520], b: [3050, 2380], w: 120, green: [3080, 2372, 50] },
    { a: [2420, 2210], b: [3080, 2190], w: 100, green: [3120, 2190, 48] }
  ];
  W.bunkers = [[1400, 2292, 40, 18], [1600, 2572, 44, 20], [2960, 2424, 40, 18], [3010, 2230, 44, 18], [1180, 2610, 36, 16]];

  function inEllipse(x, y, e, grow) {
    var dx = (x - e[0]) / (e[2] + grow), dy = (y - e[1]) / (e[3] + grow);
    return dx * dx + dy * dy <= 1;
  }
  W.inEllipse = inEllipse;
  W.inLake = function (x, y, grow) {
    grow = grow || 0;
    for (var i = 0; i < W.lake.length; i++) if (inEllipse(x, y, W.lake[i], grow)) return true;
    return false;
  };
  W.riverDist = function (x, y) {
    if (y < 1850 || y > 2250) return 999;
    return SS.distToPolyline(x, y, W.river);
  };
  function inRock(x, y) {
    var i, r;
    for (i = 0; i < W.rocks.length; i++) { r = W.rocks[i]; if ((x - r[0]) * (x - r[0]) + (y - r[1]) * (y - r[1]) < (r[2] + 4) * (r[2] + 4)) return true; }
    for (i = 0; i < W.bearRocks.length; i++) { r = W.bearRocks[i]; if ((x - r[0]) * (x - r[0]) + (y - r[1]) * (y - r[1]) < r[2] * r[2]) return true; }
    return false;
  }

  // 0 land, 1 water, 2 rock/blocked, 3 wood (dock/bridge), 5 deep water
  W.terrainAt = function (x, y) {
    if (x < 0 || y < 0 || x >= W.w || y >= W.h) return 2;
    var d = W.dock;
    if (x >= d.x0 && x <= d.x1 && y >= d.y0 && y <= d.y1) return 3;
    var b = W.bridge;
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) {
      if (W.bridgeFixed || y < b.gap0 || y > b.gap1) return 3;
      return 1;
    }
    if (W.inLake(x, y, 0)) return W.inLake(x, y, -110) ? 5 : 1;
    for (var i = 0; i < W.ponds.length; i++) if (inEllipse(x, y, W.ponds[i], 0)) return 1;
    if (W.riverDist(x, y) < W.riverW / 2) return 1;
    if (inRock(x, y)) return 2;
    return 0;
  };

  W.buildTerrain = function () {
    W.cols = Math.ceil(W.w / W.T); W.rows = Math.ceil(W.h / W.T);
    W.grid = new Uint8Array(W.cols * W.rows);
    for (var r = 0; r < W.rows; r++) for (var c = 0; c < W.cols; c++)
      W.grid[r * W.cols + c] = W.terrainAt(c * W.T + W.T / 2, r * W.T + W.T / 2);
  };
  W.rasterBridge = function () {
    var b = W.bridge;
    for (var y = b.y0; y <= b.y1; y += W.T / 2) for (var x = b.x0; x <= b.x1; x += W.T / 2) {
      var c = Math.floor(x / W.T), r = Math.floor(y / W.T);
      W.grid[r * W.cols + c] = W.terrainAt(c * W.T + W.T / 2, r * W.T + W.T / 2);
    }
  };
  W.tile = function (x, y) {
    if (x < 0 || y < 0 || x >= W.w || y >= W.h) return 2;
    return W.grid[Math.floor(y / W.T) * W.cols + Math.floor(x / W.T)];
  };
  W.footOK = function (x, y) { var t = W.tile(x, y); return t === 0 || t === 3; };
  W.boatOK = function (x, y) { var t = W.tile(x, y); return t === 1 || t === 5; };
  W.isWater = function (x, y) { var t = W.tile(x, y); return t === 1 || t === 5; };
  W.waterKind = function (x, y) {
    var t = W.tile(x, y);
    if (t !== 1 && t !== 5) return null;
    if (W.inLake(x, y, 0)) return t === 5 ? 'deep' : 'lake';
    return 'river';
  };

  // ---------- objects & spatial hashes ----------
  W.objects = []; W.colliders = []; W.interactables = [];
  W.lights = []; W.containers = []; W.pickups = []; W.bushes = []; W.sites = [];
  // Spatial hashes are flat arrays of buckets indexed by cell number, so queries build no strings.
  W.hcols = Math.ceil(W.w / W.HC) + 1; W.hrows = Math.ceil(W.h / W.HC) + 1;
  W.dcols = Math.ceil(W.w / W.DC) + 1; W.drows = Math.ceil(W.h / W.DC) + 1;
  W.chash = new Array(W.hcols * W.hrows); W.dhash = new Array(W.dcols * W.drows);

  function addToHash(hash, size, cols, rows, o, x0, y0, x1, y1) {
    var c0 = clamp(Math.floor(x0 / size), 0, cols - 1), c1 = clamp(Math.floor(x1 / size), 0, cols - 1);
    var r0 = clamp(Math.floor(y0 / size), 0, rows - 1), r1 = clamp(Math.floor(y1 / size), 0, rows - 1);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var k = r * cols + c;
      (hash[k] || (hash[k] = [])).push(o);
    }
  }
  function colBounds(o) {
    var c = o.col;
    if (c.r !== undefined) return [o.x - c.r, o.y - c.r, o.x + c.r, o.y + c.r];
    return [c.x0, c.y0, c.x1, c.y1];
  }
  function add(o) {
    if (o.sortY === undefined) o.sortY = o.y;
    W.objects.push(o);
    if (o.col) { W.colliders.push(o); var bb = colBounds(o); addToHash(W.chash, W.HC, W.hcols, W.hrows, o, bb[0], bb[1], bb[2], bb[3]); }
    if (o.act) W.interactables.push(o);
    if (!o.noDraw) addToHash(W.dhash, W.DC, W.dcols, W.drows, o, o.x, o.y, o.x, o.y);
    return o;
  }
  W.add = add;

  // Objects spanning several cells are reported once, using a per-query stamp instead of a Set.
  var qstamp = 0;
  W.queryCol = function (x0, y0, x1, y1) {
    var out = [], stamp = ++qstamp, cols = W.hcols;
    var c0 = Math.max(0, Math.floor(x0 / W.HC)), c1 = Math.min(cols - 1, Math.floor(x1 / W.HC));
    var r0 = Math.max(0, Math.floor(y0 / W.HC)), r1 = Math.min(W.hrows - 1, Math.floor(y1 / W.HC));
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var list = W.chash[r * cols + c];
      if (!list) continue;
      for (var i = 0; i < list.length; i++) { var o = list[i]; if (o._qs !== stamp) { o._qs = stamp; out.push(o); } }
    }
    return out;
  };
  W.queryDraw = function (x0, y0, x1, y1) {
    var out = [], cols = W.dcols;
    var c0 = Math.max(0, Math.floor(x0 / W.DC)), c1 = Math.min(cols - 1, Math.floor(x1 / W.DC));
    var r0 = Math.max(0, Math.floor(y0 / W.DC)), r1 = Math.min(W.drows - 1, Math.floor(y1 / W.DC));
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var list = W.dhash[r * cols + c];
      if (list) for (var i = 0; i < list.length; i++) out.push(list[i]);
    }
    return out;
  };

  function colOverlap(o, x, y, r) {
    var c = o.col;
    if (c.off) return false;
    if (c.r !== undefined) {
      var dx = x - o.x, dy = y - o.y, rr = r + c.r;
      return dx * dx + dy * dy < rr * rr;
    }
    var nx = clamp(x, c.x0, c.x1), ny = clamp(y, c.y0, c.y1);
    return (x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r;
  }
  W.colOverlap = colOverlap;

  function terrainFree(x, y, r, mode) {
    var ok = mode === 'boat' ? W.boatOK : W.footOK;
    if (!ok(x, y)) return false;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      if (!ok(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
    }
    return true;
  }
  W.terrainFree = terrainFree;

  W.circleFree = function (x, y, r, mode) {
    if (!terrainFree(x, y, r, mode)) return false;
    var list = W.queryCol(x - r, y - r, x + r, y + r);
    for (var i = 0; i < list.length; i++) if (colOverlap(list[i], x, y, r)) return false;
    return true;
  };

  function pushOut(e, r, mode) {
    var list = W.queryCol(e.x - r - 2, e.y - r - 2, e.x + r + 2, e.y + r + 2);
    for (var i = 0; i < list.length; i++) {
      var o = list[i], c = o.col;
      if (c.off || !colOverlap(o, e.x, e.y, r)) continue;
      var nx, ny, px, py;
      if (c.r !== undefined) {
        var dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01;
        var pen = r + c.r - d;
        px = e.x + dx / d * pen; py = e.y + dy / d * pen;
      } else {
        nx = clamp(e.x, c.x0, c.x1); ny = clamp(e.y, c.y0, c.y1);
        if (nx === e.x && ny === e.y) {
          // center inside rect: push out along smallest axis
          var l = e.x - c.x0, rr = c.x1 - e.x, t = e.y - c.y0, b = c.y1 - e.y;
          var m = Math.min(l, rr, t, b);
          px = e.x; py = e.y;
          if (m === l) px = c.x0 - r; else if (m === rr) px = c.x1 + r; else if (m === t) py = c.y0 - r; else py = c.y1 + r;
        } else {
          var ddx = e.x - nx, ddy = e.y - ny, dd = Math.hypot(ddx, ddy) || 0.01;
          px = nx + ddx / dd * r; py = ny + ddy / dd * r;
        }
      }
      if (terrainFree(px, py, r * 0.8, mode)) { e.x = px; e.y = py; }
    }
  }

  // Move a circle-shaped entity with sliding collision. Returns true if it moved freely.
  W.move = function (e, dx, dy, r, mode) {
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
    var sx = dx / steps, sy = dy / steps, blocked = false;
    for (var s = 0; s < steps; s++) {
      if (sx) { if (terrainFree(e.x + sx, e.y, r, mode)) e.x += sx; else blocked = true; }
      if (sy) { if (terrainFree(e.x, e.y + sy, r, mode)) e.y += sy; else blocked = true; }
      pushOut(e, r, mode);
    }
    e.x = clamp(e.x, r, W.w - r); e.y = clamp(e.y, r, W.h - r);
    return !blocked;
  };

  // Line of sight: blocked by occluding objects (buildings, tents, trunks, rocks, cars)
  W.losClear = function (ax, ay, bx, by) {
    var list = W.queryCol(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by));
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (!o.occ || o.col.off) continue;
      var c = o.col;
      if (c.r !== undefined) { if (SS.segCircle(ax, ay, bx, by, o.x, o.y, o.occR || c.r)) return false; }
      else if (SS.segRect(ax, ay, bx, by, c.x0, c.y0, c.x1, c.y1)) return false;
    }
    return true;
  };

  // ---------- navigation (A*) ----------
  W.buildNav = function () {
    W.ncols = Math.ceil(W.w / W.N); W.nrows = Math.ceil(W.h / W.N);
    W.nav = new Uint8Array(W.ncols * W.nrows);
    for (var r = 0; r < W.nrows; r++) for (var c = 0; c < W.ncols; c++) W.nav[r * W.ncols + c] = navBlockedCell(c, r) ? 1 : 0;
  };
  function navBlockedCell(c, r) {
    var x = c * W.N + W.N / 2, y = r * W.N + W.N / 2;
    if (!W.footOK(x, y)) return true;
    var list = W.queryCol(x - 16, y - 16, x + 16, y + 16);
    for (var i = 0; i < list.length; i++) if (colOverlap(list[i], x, y, 9)) return true;
    return false;
  }
  W.refreshNavRect = function (x0, y0, x1, y1) {
    for (var r = Math.floor(y0 / W.N); r <= Math.floor(y1 / W.N); r++)
      for (var c = Math.floor(x0 / W.N); c <= Math.floor(x1 / W.N); c++)
        if (c >= 0 && r >= 0 && c < W.ncols && r < W.nrows) W.nav[r * W.ncols + c] = navBlockedCell(c, r) ? 1 : 0;
  };
  W.navFree = function (x, y) {
    var c = Math.floor(x / W.N), r = Math.floor(y / W.N);
    if (c < 0 || r < 0 || c >= W.ncols || r >= W.nrows) return false;
    return W.nav[r * W.ncols + c] === 0;
  };
  W.walkLine = function (ax, ay, bx, by, r) {
    var d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 10);
    for (var i = 1; i <= n; i++) {
      var t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (!W.circleFree(x, y, r || 9, 'foot')) return false;
    }
    return true;
  };
  function nearestFree(c, r) {
    if (W.nav[r * W.ncols + c] === 0) return [c, r];
    for (var rad = 1; rad < 6; rad++)
      for (var dr = -rad; dr <= rad; dr++) for (var dc = -rad; dc <= rad; dc++) {
        var cc = c + dc, rr = r + dr;
        if (cc >= 0 && rr >= 0 && cc < W.ncols && rr < W.nrows && W.nav[rr * W.ncols + cc] === 0) return [cc, rr];
      }
    return null;
  }
  // Cheap straight-line test on the navigation grid, used to smooth A* paths.
  W.navLine = function (ax, ay, bx, by) {
    var d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 12);
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      if (!W.navFree(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  };
  // A* search buffers are allocated once and reused; a generation counter marks what this search touched.
  var pf = null;
  function pfBuffers(n) {
    if (!pf || pf.n !== n) {
      pf = { n: n, gen: 0, g: new Float32Array(n), came: new Int32Array(n), seen: new Uint32Array(n), closed: new Uint32Array(n), cap: n * 8, heap: new Int32Array(n * 8), hf: new Float32Array(n * 8) };
    }
    pf.gen++;
    return pf;
  }
  W.findPath = function (sx, sy, tx, ty) {
    var C = W.ncols, R = W.nrows, N = W.N;
    var tc = clamp(Math.floor(tx / N), 0, C - 1), tr = clamp(Math.floor(ty / N), 0, R - 1);
    var s = nearestFree(clamp(Math.floor(sx / N), 0, C - 1), clamp(Math.floor(sy / N), 0, R - 1));
    var t = nearestFree(tc, tr);
    if (!s || !t) return null;
    // if the target itself is blocked, stop at the nearest free cell instead of walking into the obstacle
    var end = (t[0] === tc && t[1] === tr) ? [tx, ty] : [t[0] * N + N / 2, t[1] * N + N / 2];
    var start = s[1] * C + s[0], goal = t[1] * C + t[0];
    if (start === goal) return [end];
    var B = pfBuffers(C * R), gen = B.gen, g = B.g, came = B.came, seen = B.seen, closed = B.closed, heap = B.heap, hf = B.hf, cap = B.cap;
    var size = 0, nav = W.nav;
    function push(node, f) {
      if (size >= cap) return;
      var i = size++;
      heap[i] = node; hf[i] = f;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (hf[p] <= hf[i]) break;
        var tn = heap[p]; heap[p] = heap[i]; heap[i] = tn; var tf = hf[p]; hf[p] = hf[i]; hf[i] = tf;
        i = p;
      }
    }
    function pop() {
      var top = heap[0];
      size--;
      if (size > 0) {
        heap[0] = heap[size]; hf[0] = hf[size];
        var i = 0;
        for (;;) {
          var l = i * 2 + 1, r2 = l + 1, m = i;
          if (l < size && hf[l] < hf[m]) m = l;
          if (r2 < size && hf[r2] < hf[m]) m = r2;
          if (m === i) break;
          var tn = heap[m]; heap[m] = heap[i]; heap[i] = tn; var tf = hf[m]; hf[m] = hf[i]; hf[i] = tf;
          i = m;
        }
      }
      return top;
    }
    var gx = t[0], gy = t[1];
    function h(cx, cy) { var dx = Math.abs(cx - gx), dy = Math.abs(cy - gy); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); }
    seen[start] = gen; g[start] = 0; came[start] = -1;
    push(start, h(s[0], s[1]));
    var iter = 0, found = false;
    while (size > 0 && iter++ < 9000) {
      var cur = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      var cx = cur % C, cy = (cur - cx) / C, gc = g[cur];
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
        var n = ny * C + nx;
        if (nav[n] || closed[n] === gen) continue;
        if (dx && dy && (nav[cy * C + nx] || nav[ny * C + cx])) continue;
        var ng = gc + (dx && dy ? 1.414 : 1);
        if (seen[n] !== gen || ng < g[n]) { seen[n] = gen; g[n] = ng; came[n] = cur; push(n, ng + h(nx, ny)); }
      }
    }
    if (!found) return null;
    var path = [], node = goal;
    while (node !== -1 && node !== start) { var nc = node % C; path.push([nc * N + N / 2, (node - nc) / C * N + N / 2]); node = came[node]; }
    path.reverse();
    path[path.length - 1] = end;
    // string-pulling: skip ahead to the furthest waypoint that is still in a straight, clear line
    var out = [], ax = sx, ay = sy, i = 0;
    while (i < path.length) {
      var j = i;
      while (j + 1 < path.length && W.navLine(ax, ay, path[j + 1][0], path[j + 1][1])) j++;
      out.push(path[j]); ax = path[j][0]; ay = path[j][1]; i = j + 1;
    }
    return out;
  };

  // ---------- world construction ----------
  function distToPath(x, y, list, extra) {
    for (var i = 0; i < list.length; i++) if (SS.distToPolyline(x, y, list[i].pts) < list[i].w / 2 + extra) return true;
    return false;
  }
  function inLoopArea(x, y, grow) {
    var l = W.loop;
    var dx = (x - l.x) / (l.rx + grow), dy = (y - l.y) / (l.ry + grow);
    return dx * dx + dy * dy <= 1;
  }
  var keepRects = [[2140, 1060, 2770, 1470], [2780, 1000, 3520, 1890], [1840, 2150, 2400, 2420], [2380, 540, 2520, 800]];
  var keepCircles = [[480, 560, 160], [1720, 1915, 80], [1800, 1950, 90], [400, 1835, 90], [3020, 1770, 110]];

  W.isClear = function (x, y, m) {
    m = m || 0;
    if (W.terrainAt(x, y) !== 0 || W.terrainAt(x, y + 24) !== 0 || W.terrainAt(x, y - 30) === 2) return false;
    if (W.inLake(x, y, 60 + m) || inEllipse(x, y, W.beach, 40 + m)) return false;
    if (W.riverDist(x, y) < W.riverW / 2 + 34 + m) return false;
    if (distToPath(x, y, W.roads, 34 + m) || distToPath(x, y, W.dirt, 16 + m)) return false;
    if (inLoopArea(x, y, 70 + m)) return false;
    var i, k;
    for (i = 0; i < W.siteDefs.length; i++) { k = W.siteDefs[i]; if (Math.hypot(x - k.x, y - (k.y + 25)) < 165 + m) return false; }
    for (i = 0; i < W.meadows.length; i++) { k = W.meadows[i]; if (Math.hypot(x - k[0], y - k[1]) < k[2] + m) return false; }
    for (i = 0; i < keepRects.length; i++) { k = keepRects[i]; if (x > k[0] - m && x < k[2] + m && y > k[1] - m && y < k[3] + m) return false; }
    for (i = 0; i < keepCircles.length; i++) { k = keepCircles[i]; if (Math.hypot(x - k[0], y - k[1]) < k[2] + m) return false; }
    for (i = 0; i < W.lots.length; i++) { k = W.lots[i]; if (x > k[0] - 20 && x < k[2] + 20 && y > k[1] - 20 && y < k[3] + 20) return false; }
    for (i = 0; i < W.fairways.length; i++) {
      k = W.fairways[i];
      if (SS.distToSeg(x, y, k.a[0], k.a[1], k.b[0], k.b[1]) < k.w / 2 + 24 + m) return false;
      if (Math.hypot(x - k.green[0], y - k.green[1]) < k.green[2] + 40 + m) return false;
    }
    for (i = 0; i < W.ponds.length; i++) if (inEllipse(x, y, W.ponds[i], 30)) return false;
    return true;
  };

  W.meadows = [[900, 1550, 120], [700, 1100, 110], [1250, 650, 130], [2900, 850, 140], [3250, 2350, 130], [600, 2300, 150], [1200, 1800, 100], [3300, 600, 120]];

  W.siteDefs = [
    { x: 1080, y: 1010, tent: '#e8743b', car: '#3d7bd9', campers: 2 },
    { x: 1550, y: 880, tent: '#3a8fd9', car: null, campers: 1 },
    { x: 2020, y: 1010, tent: '#5aa83c', car: '#d9473d', campers: 2 },
    { x: 2020, y: 1490, tent: '#d9c23a', car: null, campers: 1, clothesline: true },
    { x: 1550, y: 1610, tent: '#c1495f', car: '#e8e2d0', campers: 2 },
    { x: 1080, y: 1490, tent: '#7b5cc4', car: null, campers: 1 }
  ];

  function tree(x, y, rnd, kind) {
    var pine = kind ? kind === 'pine' : rnd() < 0.55;
    var s = 0.8 + rnd() * 0.5;
    return add({ type: 'tree', x: x, y: y, pine: pine, s: s, v: Math.floor(rnd() * 3), col: { r: 9 * s }, occ: true, occR: 11 * s });
  }
  function bush(x, y, rnd, big) {
    var r = big ? 30 : 24 + rnd() * 6;
    var b = add({ type: 'bush', x: x, y: y, r: r, v: Math.floor(rnd() * 3), shake: 0, berry: false });
    W.bushes.push(b);
    return b;
  }
  function container(kind, x, y, extra) {
    var o = { type: kind, x: x, y: y, act: 'container', kind: kind, items: [], label: kind === 'basket' ? 'Open Picnic Basket' : kind === 'cooler' ? 'Open Cooler' : 'Rummage in Trash' };
    if (kind === 'cooler') o.col = { x0: x - 13, y0: y - 8, x1: x + 13, y1: y + 6 };
    if (kind === 'trash') o.col = { r: 10 };
    for (var k in extra) o[k] = extra[k];
    add(o); W.containers.push(o);
    return o;
  }
  function building(kind, x0, y0, x1, y1, opt) {
    var o = { type: 'building', kind: kind, x: (x0 + x1) / 2, y: y1, x0: x0, y0: y0, x1: x1, y1: y1, col: { x0: x0, y0: y0, x1: x1, y1: y1 }, occ: true };
    for (var k in opt) o[k] = opt[k];
    return add(o);
  }
  function light(x, y, r, color, kind, extra) {
    var l = { x: x, y: y, r: r, color: color || 'rgba(255,190,110,', kind: kind || 'lamp' };
    for (var k in extra) l[k] = extra[k];
    W.lights.push(l);
    return l;
  }
  function sign(x, y, key) { return add({ type: 'sign', x: x, y: y, act: 'sign', key: key, label: 'Read Sign', col: { r: 6 } }); }

  W.build = function () {
    var rnd = SS.rng(20240611);
    W.buildTerrain();

    // --- cave & home ---
    W.cave = add({ type: 'cave', x: 470, y: 436, act: 'cave', label: 'Enter Your Cave', ix: 470, iy: 470, sortY: 400 });
    W.home = { x: 492, y: 548 };
    sign(560, 470, 'cave');
    add({ type: 'stump', x: 640, y: 560, col: { r: 12 } });
    add({ type: 'log', x: 400, y: 580, col: { x0: 370, y0: 572, x1: 430, y1: 588 } });
    add({ type: 'firepit', x: 470, y: 590, col: { r: 14 } });
    W.homeFire = light(470, 586, 150, 'rgba(255,170,80,', 'fire', { fire: true });

    // --- friends ---
    W.friends = {
      raccoon: { id: 'raccoon', name: 'Raccoon', x: 676, y: 556 },
      bear: { id: 'bear', name: 'Bear', x: 400, y: 1840 },
      beaver: { id: 'beaver', name: 'Beaver', x: 1712, y: 1912 }
    };

    // --- campground ---
    building('restroom', 1495, 1212, 1605, 1268, { label: 'Restrooms', act: 'house', ix: 1550, iy: 1278 });
    add({ type: 'pump', x: 1650, y: 1300, col: { r: 8 } });
    sign(1450, 1300, 'camp');
    container('trash', 1440, 1240);
    container('trash', 1250, 1085);
    container('trash', 1850, 1085);
    container('trash', 1250, 1420);
    container('trash', 1860, 1420);
    sign(1965, 1330, 'camp');
    light(1550, 1290, 170, 'rgba(255,220,150,', 'lamp');
    add({ type: 'lamp', x: 1600, y: 1290, col: { r: 5 } });

    W.siteDefs.forEach(function (d, i) {
      var cx = d.x, cy = d.y;
      var site = { i: i, x: cx, y: cy, campers: [] };
      site.tent = add({ type: 'tent', x: cx - 42, y: cy - 30 + 23, tx: cx - 42, ty: cy - 30, color: d.tent, col: { x0: cx - 78, y0: cy - 53, x1: cx - 6, y1: cy - 7 }, occ: true });
      site.door = { x: cx - 42, y: cy - 1 };
      site.table = add({ type: 'table', x: cx + 38, y: cy + 27, col: { x0: cx + 9, y0: cy - 3, x1: cx + 67, y1: cy + 27 } });
      site.basket = container('basket', cx + 34, cy + 10, { sortY: cy + 28, site: i });
      site.cooler = container('cooler', cx + 86, cy + 30, { site: i, color: rnd.pick(['#d64545', '#3c7fd6', '#2fa36b']) });
      site.fire = add({ type: 'campfire', x: cx - 30, y: cy + 50, col: { r: 14 } });
      site.light = light(cx - 30, cy + 46, 170, 'rgba(255,170,80,', 'fire', { fire: true, site: i });
      add({ type: 'logseat', x: cx - 70, y: cy + 50, col: { x0: cx - 80, y0: cy + 40, x1: cx - 60, y1: cy + 58 } });
      add({ type: 'logseat2', x: cx - 30, y: cy + 86, col: { x0: cx - 50, y0: cy + 80, x1: cx - 10, y1: cy + 92 } });
      if (d.car) add({ type: 'car', x: cx + 58, y: cy - 42, color: d.car, col: { x0: cx + 24, y0: cy - 72, x1: cx + 92, y1: cy - 42 }, occ: true });
      if (d.clothesline) {
        site.line = add({ type: 'clothesline', x: cx + 10, y: cy + 112, act: 'clothesline', label: 'Take the Plaid Shirt', ix: cx + 10, iy: cy + 112 });
        W.clothesline = site.line;
      }
      site.sit = [[cx - 70, cy + 68], [cx - 4, cy + 70], [cx + 40, cy + 40]];
      // hiding bushes around the site
      var a = Math.atan2(cy - W.loop.y, cx - W.loop.x);
      [-1.25, 0, 1.25].forEach(function (o, j) {
        var r = 150 + rnd() * 20;
        var bx = cx + Math.cos(a + o) * r, by = cy + Math.sin(a + o) * r;
        if (W.terrainAt(bx, by) === 0) bush(bx, by, rnd, j === 1);
      });
      W.sites.push(site);
    });
    // bushes inside the loop
    [[1340, 1180], [1760, 1180], [1370, 1330], [1740, 1340], [1550, 1350]].forEach(function (p) { bush(p[0], p[1], rnd); });

    // --- ranger station ---
    W.station = building('station', 2280, 1150, 2480, 1290, { act: 'door', door: 'station', label: 'Ranger Station', ix: 2380, iy: 1302 });
    W.rangerPost = { x: 2380, y: 1326 };
    add({ type: 'truck', x: 2550, y: 1338, col: { x0: 2512, y0: 1306, x1: 2588, y1: 1340 }, occ: true });
    add({ type: 'flagpole', x: 2300, y: 1318, col: { r: 4 } });
    sign(2210, 1312, 'station');
    container('trash', 2240, 1336);
    add({ type: 'table', x: 2190, y: 1222, col: { x0: 2161, y0: 1192, x1: 2219, y1: 1222 } });
    container('basket', 2186, 1205, { sortY: 1223 });
    W.party = add({ type: 'partytable', x: 2620, y: 1240, col: { x0: 2584, y0: 1212, x1: 2656, y1: 1240 }, act: 'cake', label: 'Grab the Giant Cake', ix: 2620, iy: 1258, active: false, hasCake: true });
    add({ type: 'balloons', x: 2668, y: 1232, noCol: true });
    light(2290, 1330, 150, 'rgba(255,220,150,', 'lamp'); add({ type: 'lamp', x: 2276, y: 1340, col: { r: 5 } });
    light(2470, 1330, 150, 'rgba(255,220,150,', 'lamp'); add({ type: 'lamp', x: 2484, y: 1340, col: { r: 5 } });
    light(2380, 1296, 80, 'rgba(255,210,120,', 'window');
    bush(2140, 1250, rnd, true); bush(2540, 1180, rnd); bush(2700, 1290, rnd); bush(2210, 1440, rnd); bush(2700, 1180, rnd, true);

    // --- town ---
    W.store = building('store', 2880, 1060, 3160, 1210, { act: 'door', door: 'store', label: 'Enter General Store', ix: 3020, iy: 1222 });
    light(2950, 1214, 90, 'rgba(255,215,130,', 'window'); light(3090, 1214, 90, 'rgba(255,215,130,', 'window');
    add({ type: 'vending', x: 3196, y: 1204, act: 'vending', label: 'Use Vending Machine', col: { x0: 3182, y0: 1190, x1: 3210, y1: 1206 }, ix: 3196, iy: 1222 });
    add({ type: 'recycler', x: 3234, y: 1204, act: 'recycler', label: 'Recycle Cans', col: { x0: 3220, y0: 1190, x1: 3248, y1: 1206 }, ix: 3234, iy: 1222 });
    light(3215, 1210, 70, 'rgba(150,220,255,', 'window');
    var houses = [[3260, 1070, 3420, 1200, '#e8c86a', '#b5523b'], [3110, 1480, 3250, 1600, '#9ec3e6', '#4a5f80'], [2790, 1500, 2930, 1620, '#f0b8b0', '#6d4c41'], [3300, 1500, 3440, 1620, '#c8e0a8', '#7a4b8c']];
    houses.forEach(function (h) {
      building('house', h[0], h[1], h[2], h[3], { wall: h[4], roof: h[5], act: 'house', label: 'Knock on Door', ix: (h[0] + h[2]) / 2, iy: h[3] + 12 });
      light((h[0] + h[2]) / 2 - 36, h[3] + 4, 70, 'rgba(255,215,130,', 'window');
    });
    add({ type: 'car', x: 2960, y: 1318, color: '#c0392b', col: { x0: 2926, y0: 1288, x1: 2994, y1: 1318 }, occ: true });
    add({ type: 'car', x: 3112, y: 1318, color: '#2e86c1', col: { x0: 3078, y0: 1288, x1: 3146, y1: 1318 }, occ: true });
    container('trash', 2860, 1214);
    container('trash', 3080, 1660);
    sign(2740, 1350, 'town');
    [2270, 2700, 2920, 3140, 3360].forEach(function (x) { add({ type: 'lamp', x: x, y: 1350, col: { r: 5 } }); light(x, 1340, 170, 'rgba(255,220,150,', 'lamp'); });
    [1500, 1690].forEach(function (y) { add({ type: 'lamp', x: 3062, y: y, col: { r: 5 } }); light(3062, y - 10, 170, 'rgba(255,220,150,', 'lamp'); });
    [[2820, 1100], [3200, 1280], [3460, 1300], [2840, 1700], [3200, 1700], [3460, 1720]].forEach(function (p) { tree(p[0], p[1], rnd, 'oak'); });
    bush(2830, 1250, rnd); bush(3250, 1440, rnd); bush(2960, 1460, rnd, true); bush(3180, 1760, rnd); bush(3420, 1250, rnd);

    // --- lake & beach ---
    W.boatDock = { x: 2506, y: 610 };
    add({ type: 'towel', x: 2262, y: 744, color: '#e85d75', noCol: true, sortY: 700 });
    add({ type: 'towel', x: 2640, y: 752, color: '#3fa7d6', noCol: true, sortY: 700 });
    add({ type: 'umbrella', x: 2300, y: 734, color: '#f2c14e', col: { r: 4 } });
    add({ type: 'umbrella', x: 2680, y: 740, color: '#e8743b', col: { r: 4 } });
    container('cooler', 2330, 760, { color: '#3c7fd6' });
    container('trash', 2150, 800);
    sign(2050, 820, 'lake');
    bush(2120, 860, rnd, true); bush(2560, 840, rnd); bush(2780, 820, rnd); bush(1960, 720, rnd);

    // --- river & bridge ---
    W.bridgeObj = add({ type: 'bridge', x: 1800, y: 1922, sortY: -1, flat: true, noDraw: true });
    sign(1752, 1880, 'bridge');
    add({ type: 'dam', x: 1260, y: 1990, sortY: -1, flat: true, noDraw: true });
    bush(1640, 1840, rnd, true); bush(1920, 1880, rnd);

    // --- bear den ---
    bush(520, 1760, rnd); bush(300, 1880, rnd, true);

    // --- golf course ---
    W.clubhouse = building('clubhouse', 1880, 2180, 2100, 2290, { act: 'door', door: 'golf', label: 'Golf Clubhouse', ix: 1990, iy: 2302 });
    light(1940, 2294, 80, 'rgba(255,215,130,', 'window'); light(2040, 2294, 80, 'rgba(255,215,130,', 'window');
    add({ type: 'table', x: 1900, y: 2350, col: { x0: 1871, y0: 2320, x1: 1929, y1: 2350 } });
    container('basket', 1896, 2333, { sortY: 2351 });
    container('cooler', 2110, 2310, { color: '#2fa36b' });
    container('trash', 1860, 2306);
    sign(1856, 2110, 'golf');
    W.fairways.forEach(function (f) { add({ type: 'flag', x: f.green[0], y: f.green[1], col: null }); });
    bush(1700, 2160, rnd); bush(2150, 2180, rnd); bush(1300, 2400, rnd, true); bush(2400, 2360, rnd); bush(2850, 2300, rnd); bush(1800, 2500, rnd, true); bush(2600, 2620, rnd);

    // --- berry bushes ---
    [[560, 660], [372, 640], [740, 600], [520, 1700], [610, 1840], [290, 1960], [470, 1620], [900, 1310], [1200, 720], [700, 1210]].forEach(function (p) {
      var b = bush(p[0], p[1], rnd); b.berry = true; b.hasBerries = true; b.act = 'berry'; b.label = 'Pick Berries';
      W.interactables.push(b);
    });

    // --- forest ---
    var step = 58;
    for (var gy = 30; gy < W.h; gy += step) {
      for (var gx = 30; gx < W.w; gx += step) {
        var x = gx + rnd.range(-22, 22), y = gy + rnd.range(-22, 22);
        var edge = Math.min(x, y, W.w - x, W.h - y);
        var dens = 0.5;
        var cdx = (x - 1550) / 720, cdy = (y - 1250) / 520;
        if (cdx * cdx + cdy * cdy < 1) dens = 0.3;
        if (edge < 170) dens = 1;
        if (y > 2110 && x > 820 && x < 3250) dens = 0.14;
        if (x > 1680 && x < 2350 && y > 650 && y < 1000) dens = 0.42;
        if (rnd() > dens) continue;
        if (!W.isClear(x, y, 0)) continue;
        var near = W.queryCol(x - 34, y - 34, x + 34, y + 34), ok = true;
        for (var i = 0; i < near.length; i++) if (near[i].type === 'tree' && Math.hypot(near[i].x - x, near[i].y - y) < 40) { ok = false; break; }
        if (ok) tree(x, y, rnd);
      }
    }
    for (var by = 60; by < W.h; by += 115) for (var bx = 60; bx < W.w; bx += 115) {
      var px = bx + rnd.range(-40, 40), py = by + rnd.range(-40, 40);
      if (rnd() > 0.24) continue;
      if (!W.isClear(px, py, -10)) continue;
      if (!W.circleFree(px, py, 14, 'foot')) continue;
      bush(px, py, rnd);
    }
    for (var k = 0; k < 70; k++) {
      var rx = rnd.range(80, W.w - 80), ry = rnd.range(80, W.h - 80);
      if (W.isClear(rx, ry, 0) && W.circleFree(rx, ry, 16, 'foot')) add({ type: 'rock', x: rx, y: ry, s: 0.7 + rnd() * 0.7, v: Math.floor(rnd() * 3), col: { r: 11 }, occ: true });
    }

    // pines growing on top of the cliffs (scenery only, unreachable)
    for (var cy2 = 10; cy2 < 900; cy2 += 50) for (var cx2 = 10; cx2 < 1320; cx2 += 50) {
      var tx2 = cx2 + rnd.range(-18, 18), ty2 = cy2 + rnd.range(-18, 18);
      if (rnd() > 0.62) continue;
      if (W.terrainAt(tx2, ty2) !== 2 || W.terrainAt(tx2, ty2 + 34) !== 2) continue;
      if (Math.hypot(tx2 - 470, ty2 - 420) < 120) continue;
      add({ type: 'tree', x: tx2, y: ty2, pine: rnd() < 0.8, s: 0.7 + rnd() * 0.45, v: Math.floor(rnd() * 3), cliff: true });
    }

    // pickup spawn spots
    W.stickSpots = []; W.shroomSpots = [];
    var tries = 0;
    while ((W.stickSpots.length < 26 || W.shroomSpots.length < 20) && tries++ < 6000) {
      var sx = rnd.range(150, W.w - 150), sy = rnd.range(150, 2000);
      if (!W.isClear(sx, sy, -14) || !W.circleFree(sx, sy, 12, 'foot')) continue;
      if (Math.hypot(sx - 1550, sy - 1250) < 450) continue;
      if (W.stickSpots.length < 26) W.stickSpots.push([sx, sy]); else W.shroomSpots.push([sx, sy]);
    }
    W.canSpots = [[1300, 1180], [1810, 1310], [1160, 1120], [1950, 1130], [1660, 1520], [2200, 790], [2560, 790], [2400, 1420],
      [2860, 1380], [3200, 1380], [3080, 1560], [1950, 2380], [2300, 2220], [1700, 1050], [1420, 1530], [2730, 1310]];
    for (var p = 0; p < 30; p++) {
      var pk = { type: 'pickup', item: 'stick', x: 0, y: 0, act: 'pickup', label: '', active: false, noDraw: true };
      W.pickups.push(pk); W.interactables.push(pk);
    }

    // decorative extras
    add({ type: 'woodpile', x: 1180, y: 1300, col: { x0: 1160, y0: 1290, x1: 1200, y1: 1306 } });
    add({ type: 'outhouse', x: 1000, y: 1250, col: { x0: 982, y0: 1226, x1: 1018, y1: 1250 }, occ: true });

    W.buildNav();
    W.sparkles = [];
    for (var s = 0; s < 900 && W.sparkles.length < 260; s++) {
      var wx = rnd.range(0, W.w), wy = rnd.range(0, W.h);
      if (W.isWater(wx, wy) && W.isWater(wx + 10, wy) && W.isWater(wx - 10, wy)) W.sparkles.push([wx, wy, rnd() * 6.28, 6 + rnd() * 10]);
    }
  };

  W.setBridge = function (fixed) {
    W.bridgeFixed = fixed;
    W.rasterBridge();
    W.refreshNavRect(W.bridge.x0 - 32, W.bridge.y0 - 32, W.bridge.x1 + 32, W.bridge.y1 + 32);
  };

  W.landmarks = [
    { name: 'Your Cave', x: 470, y: 470 },
    { name: 'Campground', x: 1550, y: 1250 },
    { name: 'Ranger Station', x: 2380, y: 1150 },
    { name: 'General Store', x: 3020, y: 1060 },
    { name: 'Mirror Lake', x: 2500, y: 400 },
    { name: 'Golf Course', x: 2300, y: 2450 },
    { name: 'Bear', x: 400, y: 1800 },
    { name: 'Beaver', x: 1712, y: 1880 }
  ];
})();
