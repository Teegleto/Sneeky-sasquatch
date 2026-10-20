/* Sneeky Sasquatch - main game: state, loop, camera, interactions, quests, rendering, saving */
'use strict';
(function () {
  var W = SS.world, R = SS.R, input = SS.input, UI = SS.ui;
  var clamp = SS.clamp;
  var SAVE_KEY = 'sneeky-sasquatch-save-v1', SET_KEY = 'sneeky-sasquatch-settings-v1';
  var TIME_SCALE = 2.4; // game minutes per real second (a full day is 10 minutes)

  var G = SS.game = { mode: 'boot', paused: false, t: 0, time: 450, hour: 7.5, day: 1, dark: 0, sel: 0 };

  // ---------------- boot ----------------
  G.boot = function () {
    W.build();
    R.buildGround();
    W.homePit = W.objects.filter(function (o) { return o.type === 'firepit'; })[0];
    G.canvas = document.getElementById('c');
    G.ctx = G.canvas.getContext('2d');
    G.cam = { x: 1200, y: 1000, scale: 1, vw: 800, vh: 600, dpr: 1 };
    UI.init();
    resize();
    window.addEventListener('resize', resize);
    loadSettings();
    G.reset();
    G.dailyRefresh(true);
    G.toTitle();
    var loading = document.getElementById('loading');
    if (loading) loading.hidden = true;
    var last = performance.now();
    function frame(ts) {
      var raw = ts - last;
      var dt = Math.min(0.05, Math.max(0, raw / 1000));
      last = ts;
      step(dt);
      adaptQuality(raw);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener('pagehide', function () { if (G.mode === 'play') G.save(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && G.mode === 'play') G.save(); });
  };

  // Adaptive resolution: if frames stay slow, render fewer pixels per CSS pixel (never below 0.75).
  // After a long smooth stretch it tries one step back up, but never returns to a level that was too slow.
  // The threshold sits above 33ms so phones capped at 30fps in battery-saver mode aren't mistaken for slow ones.
  var quality = { cap: 2, acc: 0, n: 0, slow: 0, fast: 0, tooSlow: 9 };
  function adaptQuality(rawMs) {
    if (document.hidden || rawMs <= 0 || rawMs > 250) return;
    quality.acc += rawMs; quality.n++;
    if (quality.acc < 1500) return;
    var avg = quality.acc / quality.n, dpr = G.cam.dpr;
    quality.acc = 0; quality.n = 0;
    if (avg > 35 && dpr > 0.75) {
      quality.fast = 0;
      if (++quality.slow >= 2) { quality.slow = 0; quality.tooSlow = Math.min(quality.tooSlow, dpr); quality.cap = Math.max(0.75, dpr - 0.25); resize(); }
    } else {
      quality.slow = 0;
      var up = dpr + 0.25;
      if (avg < 18 && up < quality.tooSlow && up <= Math.min(window.devicePixelRatio || 1, 2)) {
        if (++quality.fast >= 8) { quality.fast = 0; quality.cap = up; resize(); }
      } else quality.fast = 0;
    }
  }
  G.quality = quality;

  function resize() {
    var cv = G.canvas, r = cv.parentElement.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2, quality.cap);
    var cam = G.cam;
    cam.vw = Math.max(320, r.width); cam.vh = Math.max(240, r.height); cam.dpr = dpr;
    cv.width = Math.round(cam.vw * dpr); cv.height = Math.round(cam.vh * dpr);
    cv.style.width = cam.vw + 'px'; cv.style.height = cam.vh + 'px';
    var s = Math.min(cam.vh / 600, cam.vw / 470);
    cam.scale = clamp(s, 0.7, 2.4);
  }

  G.reset = function () {
    G.player = new SS.Player();
    G.humans = SS.spawnHumans(G);
    G.ranger = new SS.Ranger();
    G.vehicles = [new SS.Vehicle('boat', W.boatDock.x, W.boatDock.y, -Math.PI / 2), new SS.Vehicle('golfcart', 2160, 2345, 0)];
    G.flags = { bridge: false, shirtTaken: false, golfWon: false, ending: false };
    G.quests = {}; SS.QUESTS.forEach(function (q) { G.quests[q.id] = 'locked'; });
    G.stash = [];
    G.stats = { stolen: 0, fish: 0, caught: 0 };
    G.hints = {};
    G.time = 450; G.lastMorning = Math.floor((G.time - 360) / 1440); G.sel = 0; G.trackId = null;
    G.fishing = null; G.rummage = null; G.focus = null; G.lightsNow = [];
    G.party = { active: false };
    W.party.hasCake = true; W.party.active = false;
    W.setBridge(false);
    G.refreshQuests();
  };
  G.addKart = function () {
    if (G.vehicles.some(function (v) { return v.type === 'kart'; })) return;
    G.vehicles.push(new SS.Vehicle('kart', 610, 640, 0));
  };

  // ---------------- title / new / continue ----------------
  G.toTitle = function () {
    G.mode = 'title'; G.paused = false;
    G.reset(); G.dailyRefresh(true);
    G.player.x = -500; G.player.y = -500;
    UI.closeLoot();
    UI.showTitle(G.hasSave());
    SS.audio.setMusic('title');
  };
  G.newGame = function () {
    G.reset();
    G.dailyRefresh(true);
    startPlay();
    var act = input.isTouch ? 'tap the hand button' : 'press E';
    UI.dialog('narrator', 'Sasquatch', [
      'Deep in the woods beside Whispering Pines Campground lives a big, hairy, very sneaky Sasquatch. That\'s you!',
      'The campers are back for the season, and they brought snacks. Lots and lots of snacks.',
      'Your tummy is rumbling. Raccoon is waving at you from outside your cave. Walk over and ' + act + ' to talk.'
    ]);
  };
  G.continueGame = function () {
    if (!G.load()) { G.newGame(); return; }
    startPlay();
    UI.toast('Welcome back! Day ' + G.day + ', ' + SS.fmtTime(G.time) + '.');
  };
  function startPlay() {
    G.mode = 'play'; G.paused = false;
    UI.hideTitle(); UI.refresh();
    var cam = G.cam;
    cam.x = G.player.x - cam.vw / cam.scale / 2; cam.y = G.player.y - cam.vh / cam.scale / 2;
    computeTime();
  }

  // ---------------- main step ----------------
  function step(dt) {
    G.t += dt;
    if (G.mode === 'play') {
      if (!G.paused) update(dt);
      else pausedKeys();
    } else if (G.mode === 'golf') {
      SS.Golf.update(dt, G, G.cam);
    } else if (G.mode === 'title') {
      titleUpdate(dt);
      if (UI.modalOpen && input.hit('Escape')) UI.closeModal();
    }
    updateCamera(dt);
    render();
    UI.update(dt);
    input.endFrame();
  }
  function pausedKeys() {
    if (UI.dialogOpen && UI.dialogNext && input.hit('Space', 'Enter', 'KeyE')) UI.dialogNext();
    else if (UI.modalOpen && UI.modalClosable && input.hit('Escape', 'KeyM', 'KeyJ', 'KeyC', 'KeyP')) UI.closeModal();
  }
  function titleUpdate(dt) {
    G.time = 1440 * 0 + 17.3 * 60;
    computeTime();
    G.playerVisible = false;
    computeLights();
    G.humans.forEach(function (h) { h.update(dt, G); });
    G.ranger.update(dt, G);
  }

  function computeTime() {
    G.hour = (G.time % 1440) / 60;
    G.day = Math.floor(G.time / 1440) + 1;
    var h = G.hour, max = 0.8, d;
    if (h >= 7 && h < 18.5) d = 0;
    else if (h >= 18.5 && h < 21) d = (h - 18.5) / 2.5 * max;
    else if (h >= 21 || h < 5) d = max;
    else d = (1 - (h - 5) / 2) * max;
    G.dark = d;
    G.tint = null;
    if (h >= 17.3 && h < 20.8) G.tint = 'rgba(255,130,50,' + (0.13 * Math.sin((h - 17.3) / 3.5 * Math.PI)).toFixed(3) + ')';
    else if (h >= 5 && h < 7.6) G.tint = 'rgba(255,160,200,' + (0.09 * Math.sin((h - 5) / 2.6 * Math.PI)).toFixed(3) + ')';
  }

  function update(dt) {
    var P = G.player;
    var wasNight = G.dark > 0.5;
    G.time += dt * TIME_SCALE;
    computeTime();
    var morning = Math.floor((G.time - 360) / 1440);
    if (morning !== G.lastMorning) { G.lastMorning = morning; G.dailyRefresh(false); }
    if (!wasNight && G.dark > 0.5) G.hint('night', 'Night falls. Campers sleep in their tents, but the Ranger patrols with a flashlight.');
    G.party.active = G.quests.heist === 'active';
    W.party.active = G.party.active;
    G.playerVisible = true;

    var fishingAtStart = !!G.fishing || !!G.rummage;
    updatePlayer(dt);
    SS.Fishing.update(dt, G);
    updateRummage(dt);
    updateFires();
    computeLights();
    G.humans.forEach(function (h) { h.update(dt, G); });
    G.ranger.update(dt, G);
    W.bushes.forEach(function (b) { if (b.shake > 0) b.shake = Math.max(0, b.shake - dt); });
    W.containers.forEach(function (c) { if (c.shake > 0) c.shake = Math.max(0, c.shake - dt); });
    if (P.wanted > 0) P.wanted = Math.max(0, P.wanted - dt);

    G.focus = findFocus();
    if (!fishingAtStart && !G.fishing && input.actionPressed() && G.focus && P.busy <= 0) { G.focus.run(); P.busy = 0.2; }
    if (input.pointer.pressed && G.focus && !fishingAtStart && !G.fishing && P.busy <= 0) {
      var cam = G.cam, wx = cam.x + input.pointer.x / cam.scale, wy = cam.y + input.pointer.y / cam.scale;
      if (Math.hypot(wx - G.focus.mx, wy - (G.focus.my + 20)) < 50) { G.focus.run(); P.busy = 0.2; }
    }
    hotkeys();

    // music
    var mm = G.ranger.state === 'chase' ? 'chase' : (G.dark > 0.45 ? 'night' : 'day');
    SS.audio.setMusic(mm);
    // hints
    if (Math.hypot(P.x - 1550, P.y - 1250) < 650) G.hint('camp', 'Sneak up on picnic baskets when campers look away. A "?" means someone is getting suspicious!');
    if (P.hunger < 20) G.hint('hungry', 'Your tummy is rumbling! Eat something: press F, or click a food item in your backpack.');
    if (P.energy < 20) G.hint('tired', 'You\'re getting sleepy. Head home and sleep in your cave.');
  }

  function hotkeys() {
    if (input.hit('Escape', 'KeyP')) { UI.openPause(); return; }
    if (input.hit('KeyM')) { UI.openMap(); return; }
    if (input.hit('KeyJ')) { UI.openQuests(); return; }
    if (input.hit('KeyC')) { UI.openWardrobe(); return; }
    if (input.hit('KeyF')) { G.eatSelected(); }
    for (var i = 1; i <= 9; i++) if (input.hit('Digit' + i)) UI.selectSlot(i - 1, false);
  }

  // ---------------- player ----------------
  function updatePlayer(dt) {
    var P = G.player;
    P.t += dt;
    if (P.busy > 0) P.busy -= dt;
    var ax = input.axis();
    if (G.fishing || G.rummage) {
      if (G.rummage && (ax.x || ax.y)) { G.rummage = null; UI.toast('You stopped rummaging.'); }
      ax = { x: 0, y: 0 };
    }
    var running = false;
    if (P.vehicle) driveVehicle(dt, ax);
    else {
      running = input.running() && P.energy > 0 && !P.carrying && (ax.x || ax.y);
      var speed = 150 * (running ? 1.62 : 1) * (P.carrying ? 0.62 : 1) * (P.energy <= 0 ? 0.72 : 1) * (ax.mag || 1);
      if (ax.x || ax.y) {
        W.move(P, ax.x * speed * dt, ax.y * speed * dt, P.r, 'foot');
        P.dir = Math.atan2(ax.y, ax.x); P.moving = true; P.dirX = ax.x;
      } else P.moving = false;
      // hide in bushes
      var bush = null;
      if (!P.carrying) {
        for (var i = 0; i < W.bushes.length; i++) {
          var b = W.bushes[i];
          if (Math.abs(b.x - P.x) > 40 || Math.abs(b.y - P.y) > 40) continue;
          if (Math.hypot(b.x - P.x, (b.y - 6) - P.y) < b.r * 0.78) { bush = b; break; }
        }
      }
      if (bush) {
        if (P.hiddenIn !== bush) {
          var Rg = G.ranger;
          var seenDiving = Rg.state === 'chase' && Rg.seesPlayer && Math.hypot(Rg.x - P.x, Rg.y - P.y) < 60;
          if (!seenDiving) { P.hiddenIn = bush; bush.shake = 0.5; SS.audio.play('rustle'); G.hint('hide', 'You\'re hidden! Nobody can see you while you\'re in a bush.'); }
          else bush.shake = 0.3;
        } else if (P.moving) bush.shake = Math.max(bush.shake, 0.12);
      } else P.hiddenIn = null;
    }
    P.run = running;
    // stats
    var hd = 0.22 + (running ? 0.12 : 0);
    P.hunger = Math.max(0, P.hunger - hd * dt);
    var ed = 0.17 + (running ? 2.4 : 0) + (P.hunger <= 0 ? 0.9 : 0);
    P.energy = clamp(P.energy - ed * dt, 0, 100);
    if (P.energy <= 0) {
      P.exhaustT += dt;
      if (P.exhaustT > 0.1 && P.exhaustT - dt <= 0.1) UI.toast('You\'re exhausted! Eat something with energy or get to your cave and sleep.', null, 4000);
      if (P.exhaustT > 30) G.faint();
    } else P.exhaustT = 0;
  }

  function driveVehicle(dt, ax) {
    var P = G.player, v = P.vehicle, d = v.def;
    var mag = ax.mag || 1;
    var tx = ax.x * d.speed * mag, ty = ax.y * d.speed * mag;
    var a = d.accel * dt;
    v.vx += clamp(tx - v.vx, -a, a); v.vy += clamp(ty - v.vy, -a, a);
    var sp = Math.hypot(v.vx, v.vy);
    v.speed = sp;
    if (sp > 6) v.angle = SS.approachAngle(v.angle, Math.atan2(v.vy, v.vx), dt * 7);
    var ok = W.move(v, v.vx * dt, v.vy * dt, d.r, d.mode);
    if (!ok) { v.vx *= 0.6; v.vy *= 0.6; }
    P.x = v.x; P.y = v.y; P.dir = v.angle; P.moving = sp > 10; P.hiddenIn = null;
    if (v.type !== 'boat' && sp > 80 && Math.random() < dt * 1.5) SS.audio.tone(60 + sp * 0.2, 0.25, { type: 'sawtooth', vol: 0.03 });
  }

  // ---------------- fires & lights ----------------
  function updateFires() {
    var h = G.hour;
    var fireTime = h >= 18 || h < 1 || (h >= 6 && h < 9);
    W.sites.forEach(function (s) {
      s.fire.lit = fireTime && s.campers.some(function (c) { return !c.asleep; });
    });
    if (W.homePit) W.homePit.lit = G.dark > 0.1;
  }
  function computeLights() {
    var L = G.lightsNow = [], d = G.dark, P = G.player;
    G.playerLit = false;
    if (d <= 0.02) return;
    W.lights.forEach(function (l) {
      var on = l.kind === 'fire' ? (l.site !== undefined ? W.sites[l.site].fire.lit : true) : d > 0.2;
      if (!on) return;
      var fl = l.fire ? 1 + Math.sin(G.t * 11 + l.x) * 0.04 + Math.sin(G.t * 23 + l.y) * 0.03 : 1;
      L.push({ x: l.x, y: l.y, r: l.r, color: l.color, flicker: fl, strength: l.kind === 'window' ? 0.7 : 1 });
      if (l.kind !== 'window' && Math.hypot(P.x - l.x, P.y - l.y) < l.r * 0.6) G.playerLit = true;
    });
    if (G.mode === 'play') L.push({ x: P.x, y: P.y - 20, r: 125, strength: 0.55 });
    if (G.mode === 'play' && P.gear.flashlight && !P.hiddenIn && !P.vehicle) { L.push({ x: P.x, y: P.y - 24, r: 280, cone: 0.5, angle: P.dir }); G.playerLit = true; }
    var Rg = G.ranger;
    if (Rg.flashOn) { L.push({ x: Rg.x, y: Rg.y - 22, r: 265, cone: 0.55, angle: Rg.dir }); L.push({ x: Rg.x, y: Rg.y - 20, r: 55, strength: 0.6 }); }
    G.vehicles.forEach(function (v) {
      if (v.type !== 'boat' && P.vehicle === v) { L.push({ x: v.x, y: v.y, r: 240, cone: 0.45, angle: v.angle }); G.playerLit = true; }
    });
  }

  // ---------------- interactions ----------------
  function focusObj(label, mx, my, run) { return { label: label, mx: mx, my: my, run: run }; }
  function findFocus() {
    var P = G.player;
    if (G.fishing || G.rummage) return null;
    if (P.vehicle) {
      var v = P.vehicle;
      // out on the open water the action button fishes; near land it lets you climb out
      if (v.type !== 'boat' || landingSpot(v)) return focusObj('Get out of ' + v.def.name, v.x, v.y - 40, function () { G.exitVehicle(); });
      return fishFocus(P);
    }
    if (P.hiddenIn) {
      // from inside a bush you can only pick its own berries
      var hb = P.hiddenIn;
      return hb.berry && hb.hasBerries ? focusObj('Pick Berries', hb.x, hb.y - hb.r * 1.4, actBerry(hb)) : null;
    }
    var best = null, bd = 62;
    function consider(d, f) { if (d < bd) { bd = d; best = f; } }
    // friends
    Object.keys(W.friends).forEach(function (k) {
      var f = W.friends[k], d = Math.hypot(f.x - P.x, f.y - P.y);
      if (P.carrying && k === 'raccoon') consider(d - 30, focusObj('Give the Giant Cake to Raccoon', f.x, f.y - 50, function () { G.talk('raccoon'); }));
      else consider(d, focusObj('Talk to ' + f.name, f.x, f.y - (k === 'bear' ? 70 : 44), function () { G.talk(k); }));
    });
    // vehicles
    G.vehicles.forEach(function (v) {
      var d = Math.hypot(v.x - P.x, v.y - P.y);
      if (v.type === 'boat' && d > 58) return;
      if (d > 50 && v.type !== 'boat') return;
      if (v.type === 'kart' && !P.gear.kart) return;
      consider(d - 4, focusObj((v.type === 'boat' ? 'Row the ' : 'Drive the ') + v.def.name, v.x, v.y - 34, function () { G.enterVehicle(v); }));
    });
    if (P.carrying) return best;
    // world interactables
    var list = W.interactables;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var ix = o.ix !== undefined ? o.ix : o.x, iy = o.iy !== undefined ? o.iy : o.y;
      if (Math.abs(ix - P.x) > 70 || Math.abs(iy - P.y) > 70) continue;
      var d = Math.hypot(ix - P.x, iy - P.y);
      switch (o.act) {
        case 'container': consider(d, focusObj(o.label, o.x, o.y - 30, actContainer(o))); break;
        case 'pickup': if (o.active) consider(d - 6, focusObj(o.label, o.x, o.y - 18, actPickup(o))); break;
        case 'berry': if (o.hasBerries) consider(d + 4, focusObj('Pick Berries', o.x, o.y - o.r * 1.4, actBerry(o))); break;
        case 'clothesline': if (!G.flags.shirtTaken) consider(d, focusObj('Take the Plaid Shirt', o.x, o.y - 50, actShirt)); break;
        case 'cave': consider(d, focusObj('Enter Your Cave', o.x, o.y - 60, function () {
          if (G.ranger.state === 'chase') { UI.toast('Not with the Ranger right behind you! Lose him first.'); SS.audio.play('deny'); return; }
          UI.openHome();
        })); break;
        case 'door': consider(d, focusObj(o.label, ix, iy - 56, actDoor(o))); break;
        case 'house': consider(d + 6, focusObj(o.label, ix, iy - 50, actHouse(o))); break;
        case 'vending': consider(d, focusObj(o.label, o.x, o.y - 50, function () { UI.openShop('vending'); })); break;
        case 'recycler': consider(d, focusObj(o.label, o.x, o.y - 50, actRecycle)); break;
        case 'sign': consider(d + 8, focusObj('Read Sign', o.x, o.y - 44, function () { UI.toast(SS.SIGNS[o.key], null, 4500); })); break;
        case 'cake': if (G.party.active && W.party.hasCake) consider(d, focusObj('Grab the Giant Cake', o.x, o.y - 70, actCake)); break;
      }
    }
    if (best) return best;
    return fishFocus(P);
  }
  function fishFocus(P) {
    if (!P.gear.rod) return null;
    var cos = Math.cos(P.dir), sin = Math.sin(P.dir);
    for (var dd = 36; dd <= 96; dd += 15) {
      var fx = P.x + cos * dd, fy = P.y + sin * dd;
      var wk = W.waterKind(fx, fy);
      if (wk && W.waterKind(fx + cos * 20, fy + sin * 20)) {
        G.hint('fish', 'Press E while facing water to cast your line. When the bobber dips and "!" appears, press E fast!');
        var bx = P.x + cos * (dd + 26), by = P.y + sin * (dd + 26);
        if (!W.isWater(bx, by)) { bx = fx; by = fy; }
        var kind = W.waterKind(bx, by) || wk;
        if (kind === 'deep' && !P.vehicle) kind = 'lake';
        return focusObj('Fish' + (P.bait ? ' (bait: ' + P.bait + ')' : ''), P.x, P.y - 60, (function (x, y, k) { return function () { SS.Fishing.start(G, x, y, k); }; })(bx, by, kind));
      }
    }
    return null;
  }
  // a dry spot next to the vehicle where the sasquatch can step out, or null
  function landingSpot(v) {
    var P = G.player;
    for (var r = 30; r <= 80; r += 10) for (var k = 0; k < 16; k++) {
      var a = v.angle + Math.PI / 2 + k * Math.PI / 8;
      var x = v.x + Math.cos(a) * r, y = v.y + Math.sin(a) * r;
      if (W.footOK(x, y) && W.circleFree(x, y, P.r, 'foot')) return [x, y];
    }
    return null;
  }

  function actContainer(c) {
    return function () {
      if (c.kind === 'trash') {
        G.rummage = { c: c, t: 0 };
        c.shake = 1.2;
        SS.audio.play('trash');
        G.noise(c.x, c.y, 300);
      } else { UI.openLoot(c); SS.audio.play('grab'); }
    };
  }
  function updateRummage(dt) {
    var r = G.rummage;
    if (!r) return;
    r.t += dt; r.c.shake = 0.3;
    if (r.t >= 1.1) { G.rummage = null; UI.openLoot(r.c); }
  }
  function actPickup(p) {
    return function () {
      var P = G.player;
      if (!P.add(p.item, 1)) { UI.toast('Your backpack is full!'); SS.audio.play('deny'); return; }
      p.active = false;
      SS.audio.play('pickup');
      UI.toast('Picked up ' + SS.ITEMS[p.item].name + (p.item === 'stick' ? ' (' + P.count('stick') + ')' : ''), p.item, 1600);
      UI.refresh();
    };
  }
  function actBerry(b) {
    return function () {
      var P = G.player;
      if (!P.add('berries', 2)) { UI.toast('Your backpack is full!'); return; }
      b.hasBerries = false; b.shake = 0.4;
      SS.audio.play('pickup'); UI.toast('Picked some berries.', 'berries', 1600); UI.refresh();
    };
  }
  function actShirt() {
    var P = G.player;
    G.flags.shirtTaken = true;
    if (P.ward.tops.indexOf('plaid') < 0) P.ward.tops.push('plaid');
    SS.audio.play('pickup');
    UI.toast('You got the Plaid Shirt! Press C to open your wardrobe.', 'top_plaid', 4000);
    G.stats.stolen++;
    G.witnessCheck();
  }
  function actDoor(o) {
    return function () {
      var P = G.player;
      if (o.door === 'store') {
        if (!P.disguised() || P.wanted > 0) return shriek(o, 'The shopkeeper screams! You need a disguise (a hat AND a shirt) to go in.');
        if (G.hour < 7 || G.hour >= 22) { UI.toast('The store is closed. Open 7 AM to 10 PM.'); return; }
        SS.audio.play('door'); UI.openShop();
      } else if (o.door === 'golf') golfDoor(o);
      else if (o.door === 'station') UI.toast(G.party.active ? 'Locked. Everyone is at the birthday party out front.' : 'The Ranger Station door is locked.');
    };
  }
  function actHouse(o) {
    return function () {
      if (o.kind === 'restroom') { UI.toast('You wash your paws. Very hygienic for a sasquatch.'); return; }
      UI.toast(G.dark > 0.4 ? 'The lights are off. Better not wake anyone.' : SS.rand.pick(['Nobody answers.', 'You hear a TV inside. Nobody comes to the door.', 'A dog barks inside. Time to go!']));
    };
  }
  function shriek(o, msg) {
    var P = G.player;
    UI.toast(msg, null, 4000);
    SS.audio.play('scream');
    G.alertRanger(P.x, P.y);
    G.hint('disguise', 'Humans scream at sasquatches. Find a hat and a shirt to blend in.');
  }
  function actRecycle() {
    var P = G.player, n = P.count('can');
    if (!n) { UI.toast('The machine pays $1 for every empty can. Look for cans near trash cans and picnic spots.'); return; }
    P.remove('can', n); P.money += n;
    SS.audio.play('coin');
    UI.toast('Recycled ' + n + ' can' + (n > 1 ? 's' : '') + ' for $' + n + '.', 'money');
    UI.refresh();
  }
  function actCake() {
    var P = G.player;
    P.carrying = 'giantcake'; W.party.hasCake = false;
    P.hiddenIn = null;
    SS.audio.play('grab');
    UI.toast('You grabbed the Giant Cake! Get it back to Raccoon. You can\'t run or hide while carrying it, but you can drive.', 'giantcake', 5000);
    G.witnessCheck();
  }
  function golfDoor() {
    var P = G.player;
    if (!P.disguised() || P.wanted > 0) return shriek(null, 'The golf pro screams! You need a disguise to go in.');
    if (G.hour < 8 || G.hour >= 19) { UI.toast('The clubhouse is closed. Open 8 AM to 7 PM.'); return; }
    SS.audio.play('door');
    var st = G.quests.golf;
    if (st === 'available') { G.quests.golf = 'active'; G.trackId = 'golf'; }
    var lines = st === 'done' ? ['Back for another round? Same deal: $10 to play, and $50 if you finish at or under par.'] :
      ['Welcome to Pinecone Golf Club! You look like a... natural athlete.', 'The Golf Challenge is 3 holes. Finish at or under par (10 strokes) and you win $100 plus our famous Golf Polo. Entry is $10.'];
    UI.dialog('golf', 'Golf Pro', lines, null, [
      { label: 'Play ($10)', fn: function () { if (P.money < 10) { UI.toast('You need $10 to play.'); SS.audio.play('deny'); return; } P.money -= 10; SS.Golf.start(G); } },
      { label: 'Not now', cls: 'ghost' }
    ]);
  }
  G.golfFinished = function (total, par) {
    var P = G.player;
    UI.refresh();
    if (total <= par) {
      if (G.quests.golf !== 'done') {
        G.quests.golf = 'done'; G.flags.golfWon = true;
        P.money += 100; if (P.ward.tops.indexOf('polo') < 0) P.ward.tops.push('polo');
        UI.dialog('golf', 'Golf Pro', ['Incredible! ' + total + ' strokes! You\'re a natural. Here\'s your $100 and the famous Golf Polo.', 'Feel free to take a golf cart for a spin. Just bring it back... eventually.'], function () {
          SS.audio.play('quest'); UI.toast('Quest complete: Fore!', null, 3500); G.refreshQuests(); G.trackId = null; G.save();
        });
      } else { P.money += 50; SS.audio.play('coin'); UI.toast('You won $50! (' + total + ' strokes, par ' + par + ')', 'money', 3500); }
    } else UI.dialog('golf', 'Golf Pro', ['Tough luck! You finished with ' + total + ' strokes and par is ' + par + '. Come back and try again anytime.']);
  };

  G.enterVehicle = function (v) {
    var P = G.player;
    if (v.type === 'boat' && P.carrying) { UI.toast('The cake won\'t fit in the rowboat.'); return; }
    P.vehicle = v; P.hiddenIn = null; G.fishing = null;
    P.x = v.x; P.y = v.y; v.vx = v.vy = 0;
    SS.audio.play(v.type === 'boat' ? 'splash' : 'engine');
    if (v.type === 'boat') G.hint('boat', 'Row out to the middle of the lake. Deep water has bigger fish. Press E near land to get out.');
  };
  G.exitVehicle = function () {
    var P = G.player, v = P.vehicle;
    var spot = landingSpot(v);
    if (spot) {
      P.vehicle = null; v.vx = v.vy = 0; v.speed = 0;
      P.x = spot[0]; P.y = spot[1];
      return;
    }
    UI.toast(v.type === 'boat' ? 'Row closer to the shore or dock to get out.' : 'There\'s no room to get out here.');
  };

  // ---------------- theft, alarms, noise ----------------
  G.anyoneSees = function () {
    var all = G.humans.concat([G.ranger]);
    for (var i = 0; i < all.length; i++) {
      var h = all[i];
      if (!h.present || h.asleep || h.state === 'nap') continue;
      if (SS.seePlayer(h, G, false) > 0) return true;
    }
    return false;
  };
  G.witnessCheck = function () {
    var P = G.player, seen = false;
    G.humans.forEach(function (h) {
      if (!h.present || h.asleep || h.state === 'tobed' || h.state === 'leaving') return;
      if (SS.seePlayer(h, G, false) <= 0) return;
      seen = true;
      if (h.state !== 'alarm' && h.state !== 'cower') h.panic(G, 'thief');
    });
    var Rg = G.ranger;
    if (Rg.state !== 'nap' && Rg.state !== 'tonap' && SS.seePlayer(Rg, G, false) > 0) { seen = true; Rg.startChase(G); }
    if (seen) { P.wanted = 45; UI.closeLoot(); }
    return seen;
  };
  G.alertRanger = function (x, y) { G.ranger.alert(x, y, G); };
  G.onSpotted = function () {
    UI.closeLoot();
    if (G.fishing) SS.Fishing.cancel(G);
    G.rummage = null;
    G.hint('spotted', 'You\'ve been spotted! Run (hold Shift) and hide in a bush before the Ranger arrives.');
  };
  G.onChase = function () {
    UI.closeLoot();
    if (G.fishing) SS.Fishing.cancel(G);
    G.rummage = null;
    G.hint('chase', 'The Ranger is chasing you! Break line of sight, then dive into a bush.');
  };
  G.noise = function (x, y, r) {
    G.humans.forEach(function (h) { if (Math.hypot(h.x - x, h.y - y) < r) h.hearNoise(x, y); });
    if (Math.hypot(G.ranger.x - x, G.ranger.y - y) < 650) G.ranger.hearNoise(x, y);
  };

  G.takeFromContainer = function (c, i) {
    var P = G.player, id = c.items[i];
    if (id === undefined) return;
    if (!P.add(id, 1)) { UI.toast('Your backpack is full! Eat something or store items in your cave.'); SS.audio.play('deny'); return; }
    c.items.splice(i, 1);
    if (c.kind !== 'trash') G.stats.stolen++;
    SS.audio.play('grab');
    UI.toast('+1 ' + SS.ITEMS[id].name, id, 1300);
    UI.refresh();
    if (c.kind !== 'trash') G.witnessCheck();
  };
  G.takeAll = function (c) {
    var P = G.player, took = 0;
    for (var i = c.items.length - 1; i >= 0; i--) {
      if (P.add(c.items[i], 1)) { took++; c.items.splice(i, 1); } else break;
    }
    if (took) { SS.audio.play('grab'); UI.toast('Grabbed ' + took + ' item' + (took > 1 ? 's' : '') + '.', null, 1300); if (c.kind !== 'trash') { G.stats.stolen += took; G.witnessCheck(); } }
    if (c.items.length) UI.toast('Your backpack is full!');
    UI.refresh();
  };

  // the ranger heads back to his post and everyone calms down
  function resetPursuit() {
    var P = G.player, Rg = G.ranger;
    Rg.x = W.rangerPost.x; Rg.y = W.rangerPost.y; Rg.state = 'patrol'; Rg.path = null; Rg.sus = 0; Rg.route = 0; Rg.pause = 0;
    G.humans.forEach(function (h) { h.sus = 0; if (h.state === 'alarm' || h.state === 'cower' || h.state === 'investigate') { h.state = 'idle'; h.timer = 1; } });
    G.fishing = null; G.rummage = null; UI.closeLoot();
    P.wanted = 0; P.hiddenIn = null; P.exhaustT = 0;
  }
  G.caught = function () {
    if (G.caughtLock) return;
    G.caughtLock = true;
    var P = G.player;
    SS.audio.play('caught');
    UI.closeLoot(); G.fishing = null; G.rummage = null;
    G.stats.caught++;
    UI.fade(function () {
      var lost = P.inv.length;
      P.inv = [];
      if (P.carrying) { P.carrying = null; W.party.hasCake = true; }
      if (P.vehicle) { P.vehicle.vx = P.vehicle.vy = 0; P.vehicle = null; }
      P.x = W.home.x; P.y = W.home.y;
      G.time += 120; computeTime();
      resetPursuit();
      UI.refresh();
      G.caughtLock = false;
      UI.dialog('narrator', 'Caught!', ['The Ranger caught you and dragged you all the way back to your cave.' + (lost ? ' Everything in your backpack was confiscated!' : ''), 'Tip: keep valuables in your cave stash, and stay out of sight.']);
    });
  };
  G.faint = function () {
    var P = G.player;
    if (G.caughtLock) return;
    G.caughtLock = true;
    UI.closeLoot(); G.fishing = null; G.rummage = null;
    UI.fade(function () {
      P.inv = [];
      if (P.carrying) { P.carrying = null; W.party.hasCake = true; }
      if (P.vehicle) { P.vehicle.vx = P.vehicle.vy = 0; P.vehicle = null; }
      P.x = W.home.x; P.y = W.home.y;
      resetPursuit();
      var day = Math.floor(G.time / 1440);
      G.time = (G.hour >= 7 ? day + 1 : day) * 1440 + 7 * 60;
      P.energy = 60; P.hunger = Math.max(P.hunger, 30); P.exhaustT = 0;
      computeTime();
      G.caughtLock = false;
      UI.refresh();
      UI.dialog('narrator', 'Zzz...', ['You collapsed from exhaustion! A kind moose carried you home. You lost what was in your backpack.', 'Remember to eat and to sleep in your cave each night.']);
    });
  };
  G.sleep = function () {
    var P = G.player, h = G.hour;
    if (h >= 7 && h < 18 && P.energy > 60) { UI.toast('You\'re not sleepy yet. Come back after 6 PM, or when you\'re tired.'); return; }
    SS.audio.play('sleep');
    UI.fade(function () {
      var day = Math.floor(G.time / 1440);
      G.time = (h >= 7 ? day + 1 : day) * 1440 + 7 * 60;
      computeTime();
      P.energy = 100; P.hunger = Math.max(8, P.hunger - 18);
      P.x = W.home.x; P.y = W.home.y;
      resetPursuit();
      var saved = G.save();
      UI.toast('Good morning! Day ' + G.day + '.' + (saved ? ' Game saved.' : ''), null, 3500);
    });
  };

  // ---------------- food & shop ----------------
  G.eat = function (i) {
    var P = G.player, s = P.inv[i];
    if (!s) return;
    var it = SS.ITEMS[s.id];
    if (!it.food) { UI.toast('You can\'t eat that.'); return; }
    if (P.hunger >= 99 && !it.energy) { UI.toast('You\'re too full to eat.'); return; }
    P.hunger = Math.min(100, P.hunger + it.food);
    P.energy = Math.min(100, P.energy + (it.energy || 0));
    s.n--; if (s.n <= 0) P.inv.splice(i, 1);
    SS.audio.play(it.drink ? 'drink' : 'eat');
    UI.toast((it.drink ? 'Slurp! ' : 'Yum! ') + it.name + ': hunger +' + it.food + (it.energy ? ', energy +' + it.energy : ''), s.id, 1800);
    UI.refresh();
  };
  G.eatSelected = function () {
    var P = G.player, s = P.inv[G.sel];
    if (s && SS.ITEMS[s.id].food) { G.eat(G.sel); return; }
    for (var i = 0; i < P.inv.length; i++) if (SS.ITEMS[P.inv[i].id].type === 'food') { G.eat(i); return; }
    UI.toast('You have no food. Go raid a picnic basket!');
  };
  G.buy = function (e) {
    var P = G.player;
    if (P.money < e.price) { UI.toast('Not enough money. Sell fish or recycle cans to earn more.'); SS.audio.play('deny'); return; }
    if (e.item) {
      if (!P.add(e.item, 1)) { UI.toast('Your backpack is full.'); SS.audio.play('deny'); return; }
      UI.toast('Bought ' + SS.ITEMS[e.item].name + '.', e.item, 1500);
    } else if (e.gear) {
      if (e.gear === 'rod') P.gear.rod = true;
      if (e.gear === 'prorod') P.gear.prorod = true;
      if (e.gear === 'bait') P.bait += 5;
      if (e.gear === 'flashlight') P.gear.flashlight = true;
      if (e.gear === 'bigpack') { P.gear.bigpack = true; P.slots = 16; }
      if (e.gear === 'kart') { P.gear.kart = true; G.addKart(); UI.toast('Your Go-Kart is parked outside your cave!', 'kart', 3500); }
      else UI.toast('Bought ' + e.name + '.', e.gear === 'bait' ? 'bait' : e.gear, 1800);
    } else if (e.hat) { P.ward.hats.push(e.hat); UI.toast('Bought a ' + SS.HATS[e.hat].name + '. Press C to wear it.', 'hat_' + e.hat, 2500); }
    else if (e.top) { P.ward.tops.push(e.top); UI.toast('Bought a ' + SS.TOPS[e.top].name + '. Press C to wear it.', 'top_' + e.top, 2500); }
    P.money -= e.price;
    SS.audio.play('coin');
    UI.refresh();
  };
  G.sell = function (id, n) {
    var P = G.player, v = SS.ITEMS[id].value * n;
    if (!P.remove(id, n)) return;
    P.money += v;
    SS.audio.play('coin');
    UI.refresh();
  };

  // ---------------- quests ----------------
  G.refreshQuests = function () {
    SS.QUESTS.forEach(function (q) {
      if (G.quests[q.id] === 'locked' && q.requires.every(function (r) { return G.quests[r] === 'done'; })) G.quests[q.id] = 'available';
    });
  };
  function needMet(q) {
    var n = q.need, P = G.player;
    if (n.item) return P.count(n.item) >= n.n;
    if (n.fish) return P.countType('fish') >= n.fish;
    if (n.top) return P.ward.tops.indexOf(n.top) >= 0;
    if (n.flag) return !!G.flags[n.flag];
    if (n.carry) return P.carrying === n.carry;
    return false;
  }
  G.needMet = needMet;
  function giverName(g) { return { raccoon: 'Raccoon', bear: 'Bear', beaver: 'Beaver', golf: 'the Golf Pro' }[g]; }
  var CHATTER = {
    raccoon: ['Trash cans are noisy. Rummage in one and everybody nearby comes to look. Handy for distractions!', 'Campers go to bed late and wake up early. The best snacking is in the middle of the night.', 'If you\'re ever caught, the Ranger takes everything in your backpack. Keep the good stuff in your cave stash.', 'Changing clothes where nobody can see you makes people forget they saw a thief.'],
    bear: ['Hrrmm. Catfish come out at night in the river.', 'The deeper the water, the bigger the fish. The rowboat at the dock goes out to the deep part of the lake.', 'Honey is the best food. Gives you energy for days. Well, minutes.'],
    beaver: ['Chomp chomp! Oh, sorry, habit.', 'Golf balls make terrible dam material. Trust me, I tried.', 'Have you seen the golf course? The grass is so short! Who chews it?']
  };
  G.talk = function (fid) {
    var f = W.friends[fid], P = G.player;
    var qs = SS.QUESTS.filter(function (q) { return q.giver === fid; });
    var act = qs.filter(function (q) { return G.quests[q.id] === 'active'; })[0];
    if (act) {
      if (needMet(act)) completeQuest(act, f);
      else UI.dialog(fid, f.name, [act.waiting + progressText(act)]);
      return;
    }
    var av = qs.filter(function (q) { return G.quests[q.id] === 'available'; })[0];
    if (av) {
      UI.dialog(fid, f.name, av.intro, function () {
        G.quests[av.id] = 'active'; G.trackId = av.id;
        if (av.id === 'pie' || av.id === 'heist') { /* reminders are in the quest text */ }
        SS.audio.play('alert');
        UI.toast('New quest: ' + av.title, null, 3000);
        if (needMet(av)) UI.toast('You already have what ' + f.name + ' wants! Talk again.', null, 3000);
      });
      return;
    }
    if (fid === 'raccoon' && G.quests.fish === 'available') { UI.dialog(fid, f.name, ['Bear by the river, west of the campground, has been grumbling about fish. Go say hi.']); return; }
    if (fid === 'raccoon' && G.quests.sticks === 'available') { UI.dialog(fid, f.name, [SS.rand.pick(CHATTER.raccoon), 'Oh, and Beaver down by the broken bridge was asking for help.']); return; }
    UI.dialog(fid, f.name, [SS.rand.pick(CHATTER[fid])]);
  };
  function progressText(q) {
    var P = G.player, n = q.need;
    if (n.item && n.n > 1) return ' (' + Math.min(P.count(n.item), n.n) + '/' + n.n + ')';
    if (n.fish) return ' (' + Math.min(P.countType('fish'), n.fish) + '/' + n.fish + ')';
    return '';
  }
  function completeQuest(q, f) {
    var P = G.player, n = q.need;
    if (n.item) P.remove(n.item, n.n);
    if (n.fish) P.removeType('fish', n.fish);
    if (n.carry) P.carrying = null;
    UI.refresh();
    UI.dialog(q.giver, f.name, q.done, function () {
      G.quests[q.id] = 'done';
      giveReward(q.reward);
      SS.audio.play('quest');
      UI.toast('Quest complete: ' + q.title, null, 3500);
      G.refreshQuests();
      G.trackId = null;
      UI.refresh();
      G.save();
      if (q.reward.ending) setTimeout(UI.ending, 400);
    });
  }
  function giveReward(r) {
    var P = G.player;
    if (r.money) { P.money += r.money; UI.toast('+$' + r.money, 'money', 2500); }
    if (r.hat && P.ward.hats.indexOf(r.hat) < 0) { P.ward.hats.push(r.hat); if (P.outfit.hat === 'none') P.outfit.hat = r.hat; UI.toast('New hat: ' + SS.HATS[r.hat].name + '!', 'hat_' + r.hat, 3500); }
    if (r.top && P.ward.tops.indexOf(r.top) < 0) { P.ward.tops.push(r.top); UI.toast('New shirt: ' + SS.TOPS[r.top].name + '!', 'top_' + r.top, 3500); }
    if (r.gear === 'rod') {
      if (P.gear.rod) { P.money += 40; UI.toast('You already have a rod, so Raccoon paid you $40 instead.', 'money', 3500); }
      else { P.gear.rod = true; UI.toast('You got a Fishing Rod! Face water and press E to fish.', 'rod', 4000); }
    }
    if (r.gear === 'kart') {
      if (P.gear.kart) { P.money += 150; UI.toast('You already own a kart, so Raccoon gave you $150 instead.', 'money', 3500); }
      else { P.gear.kart = true; G.addKart(); UI.toast('Your Go-Kart is parked by the cave!', 'kart', 3500); }
    }
    if (r.items) r.items.forEach(function (it) { var got = P.add(it[0], it[1]); if (got < it[1]) G.stash.push({ id: it[0], n: it[1] - got }); });
    if (r.slots && P.slots < r.slots) { P.slots = r.slots; UI.toast('Bigger backpack: ' + r.slots + ' slots!', 'bigpack', 3000); }
    if (r.flag === 'bridge') { G.flags.bridge = true; W.setBridge(true); }
    if (r.ending) { G.flags.ending = true; W.party.hasCake = false; }
  }

  G.trackedQuest = function () {
    if (G.trackId && G.quests[G.trackId] === 'active') return SS.QUESTS.filter(function (q) { return q.id === G.trackId; })[0];
    return SS.QUESTS.filter(function (q) { return G.quests[q.id] === 'active'; })[0] || null;
  };
  G.trackerText = function () {
    var q = G.trackedQuest();
    if (!q) {
      var av = SS.QUESTS.filter(function (x) { return G.quests[x.id] === 'available'; })[0];
      if (av) {
        var where = { raccoon: 'Raccoon, outside your cave', bear: 'Bear, by the river in the west', beaver: 'Beaver, by the broken bridge', golf: 'the Golf Pro at the clubhouse' }[av.giver];
        return { key: 'av' + av.id, title: 'New quest!', desc: 'Talk to ' + where + '.' };
      }
      var all = SS.QUESTS.every(function (x) { return G.quests[x.id] === 'done'; });
      return { key: all ? 'all' : 'none', title: all ? 'Legendary Sasquatch' : 'Free roam', desc: all ? 'Every quest complete! Keep snacking, fishing and golfing.' : 'Explore, snack, fish, and stay out of sight.' };
    }
    var met = needMet(q);
    var desc = met ? 'Go back to ' + giverName(q.giver) + '.' : q.desc + progressText(q);
    if (q.id === 'golf' && !met) desc = q.desc;
    return { key: q.id + (met ? 'm' : '') + progressText(q), title: q.title, desc: desc };
  };
  G.questTarget = function () {
    var q = G.trackedQuest(), P = G.player;
    function giverPos(g) { return g === 'golf' ? { x: W.clubhouse.ix, y: W.clubhouse.iy } : W.friends[g]; }
    if (!q) {
      var av = SS.QUESTS.filter(function (x) { return G.quests[x.id] === 'available'; })[0];
      return av ? giverPos(av.giver) : null;
    }
    if (needMet(q)) return giverPos(q.giver);
    switch (q.id) {
      case 'sandwich': return { x: 1550, y: 1250 };
      case 'shirt': return G.flags.shirtTaken ? giverPos('raccoon') : { x: W.clothesline.x, y: W.clothesline.y };
      case 'pie': case 'kart': return { x: W.store.ix, y: W.store.iy };
      case 'fish': return { x: 520, y: 1955 };
      case 'sticks':
        var best = null, bd = Infinity;
        W.pickups.forEach(function (p) { if (p.active && p.item === 'stick') { var d = Math.hypot(p.x - P.x, p.y - P.y); if (d < bd) { bd = d; best = p; } } });
        return best;
      case 'golf': return { x: W.clubhouse.ix, y: W.clubhouse.iy };
      case 'heist': return P.carrying ? giverPos('raccoon') : { x: W.party.x, y: W.party.y };
      case 'golden': return { x: 2500, y: 470 };
    }
    return null;
  };

  // ---------------- daily refresh ----------------
  function shuffled(a) { var b = a.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(SS.rand() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  G.dailyRefresh = function (first) {
    var rnd = SS.rand;
    W.containers.forEach(function (c) {
      c.items = [];
      var n = c.kind === 'trash' ? rnd.int(0, 3) : rnd.int(2, 4);
      for (var i = 0; i < n; i++) c.items.push(rnd.weighted(SS.LOOT[c.kind]));
    });
    var picks = [];
    shuffled(W.stickSpots).slice(0, 12).forEach(function (p) { picks.push(['stick', p]); });
    shuffled(W.shroomSpots).slice(0, 8).forEach(function (p) { picks.push(['mushroom', p]); });
    shuffled(W.canSpots).slice(0, 8).forEach(function (p) { picks.push(['can', p]); });
    W.pickups.forEach(function (pk, i) {
      var d = picks[i];
      if (d) { pk.item = d[0]; pk.x = d[1][0]; pk.y = d[1][1]; pk.active = true; pk.label = 'Pick up ' + SS.ITEMS[d[0]].name; }
      else pk.active = false;
    });
    W.bushes.forEach(function (b) { if (b.berry) b.hasBerries = true; });
    if (UI.lootC) UI.renderLoot();
    if (!first && G.mode === 'play') UI.toast('A new day! The campers restocked their picnic baskets.', null, 3500);
  };

  G.hint = function (key, text) {
    if (G.hints[key] || G.mode !== 'play') return;
    G.hints[key] = true;
    UI.toast(text, null, 6000);
  };

  // ---------------- save / load ----------------
  G.hasSave = function () { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  G.save = function () {
    if (G.mode !== 'play' && G.mode !== 'golf') return false;
    var P = G.player;
    var px = P.x, py = P.y;
    if (P.vehicle || !W.circleFree(px, py, P.r, 'foot')) { px = W.home.x; py = W.home.y; }
    var data = {
      v: 1, time: G.time, sel: G.sel,
      player: { x: px, y: py, hunger: P.hunger, energy: P.energy, money: P.money, inv: P.inv, slots: P.slots, gear: P.gear, bait: P.bait, outfit: P.outfit, ward: P.ward },
      stash: G.stash, quests: G.quests, flags: G.flags, stats: G.stats, hints: G.hints, trackId: G.trackId,
      vehicles: G.vehicles.map(function (v) { return { type: v.type, x: v.x, y: v.y, angle: v.angle }; })
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  };
  G.load = function () {
    var d;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!d || d.v !== 1) return false;
    G.reset();
    var P = G.player, p = d.player || {};
    ['x', 'y', 'hunger', 'energy', 'money', 'slots', 'bait'].forEach(function (k) { if (typeof p[k] === 'number' && isFinite(p[k])) P[k] = p[k]; });
    if (Array.isArray(p.inv)) P.inv = p.inv.filter(function (s) { return s && SS.ITEMS[s.id] && s.n > 0; });
    if (p.gear) Object.keys(P.gear).forEach(function (k) { P.gear[k] = !!p.gear[k]; });
    if (p.ward) { P.ward.hats = (p.ward.hats || ['none']).filter(function (h) { return SS.HATS[h]; }); P.ward.tops = (p.ward.tops || ['none']).filter(function (t) { return SS.TOPS[t]; }); }
    if (p.outfit && SS.HATS[p.outfit.hat] && SS.TOPS[p.outfit.top]) P.outfit = { hat: p.outfit.hat, top: p.outfit.top };
    if (Array.isArray(d.stash)) G.stash = d.stash.filter(function (s) { return s && SS.ITEMS[s.id]; });
    if (d.quests) Object.keys(G.quests).forEach(function (k) { if (d.quests[k]) G.quests[k] = d.quests[k]; });
    if (d.flags) Object.keys(d.flags).forEach(function (k) { G.flags[k] = d.flags[k]; });
    if (d.stats) Object.keys(G.stats).forEach(function (k) { if (typeof d.stats[k] === 'number') G.stats[k] = d.stats[k]; });
    G.hints = d.hints || {};
    G.trackId = d.trackId || null;
    G.time = typeof d.time === 'number' ? d.time : 450;
    G.sel = d.sel || 0;
    if (Array.isArray(d.vehicles)) {
      G.vehicles = d.vehicles.filter(function (v) { return SS.VEH[v.type]; }).map(function (v) { return new SS.Vehicle(v.type, v.x, v.y, v.angle); });
      if (!G.vehicles.some(function (v) { return v.type === 'boat'; })) G.vehicles.push(new SS.Vehicle('boat', W.boatDock.x, W.boatDock.y, -Math.PI / 2));
      if (!G.vehicles.some(function (v) { return v.type === 'golfcart'; })) G.vehicles.push(new SS.Vehicle('golfcart', 2160, 2345, 0));
    }
    if (P.gear.kart) G.addKart();
    if (P.gear.bigpack) P.slots = Math.max(P.slots, 16);
    W.setBridge(!!G.flags.bridge);
    if (!W.circleFree(P.x, P.y, P.r, 'foot')) { P.x = W.home.x; P.y = W.home.y; }
    G.refreshQuests();
    computeTime();
    G.lastMorning = Math.floor((G.time - 360) / 1440);
    G.dailyRefresh(true);
    return true;
  };
  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
      if (s.sfx === false) SS.audio.setSfx(false);
      if (s.music === false) SS.audio.setMusicOn(false);
    } catch (e) { /* storage unavailable */ }
  }
  G.saveSettings = function () {
    try { localStorage.setItem(SET_KEY, JSON.stringify({ sfx: SS.audio.sfxOn, music: SS.audio.musicOn })); } catch (e) { /* storage unavailable */ }
  };

  // ---------------- camera ----------------
  function updateCamera(dt) {
    var cam = G.cam, P = G.player;
    var vw = cam.vw / cam.scale, vh = cam.vh / cam.scale;
    var tx, ty;
    if (G.mode === 'title') { tx = 1500 + Math.sin(G.t * 0.06) * 420; ty = 1180 + Math.cos(G.t * 0.045) * 230; }
    else { tx = P.x; ty = P.y - 20; }
    var gx = tx - vw / 2, gy = ty - vh / 2;
    var k = G.mode === 'title' ? 1 : Math.min(1, dt * 7);
    if (Math.hypot(gx - cam.x, gy - cam.y) > 900) k = 1;
    cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k;
    cam.x = clamp(cam.x, 0, Math.max(0, W.w - vw)); cam.y = clamp(cam.y, 0, Math.max(0, W.h - vh));
  }

  // ---------------- rendering ----------------
  var BH = { store: 70, station: 64, clubhouse: 60, house: 54, restroom: 44 };
  function render() {
    var ctx = G.ctx, cam = G.cam, P = G.player, t = G.t;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.mode === 'golf') { ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0); SS.Golf.render(ctx, cam); return; }
    var sc = cam.scale * cam.dpr;
    ctx.setTransform(sc, 0, 0, sc, -cam.x * sc, -cam.y * sc);
    var x0 = cam.x, y0 = cam.y, x1 = cam.x + cam.vw / cam.scale, y1 = cam.y + cam.vh / cam.scale;
    if (x1 > W.w || y1 > W.h) { ctx.fillStyle = '#2d4a24'; ctx.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20); }
    R.drawGround(ctx, x0, y0, x1, y1);
    R.drawWater(ctx, x0, y0, x1, y1, t);
    if (x1 > W.bridge.x0 - 50 && x0 < W.bridge.x1 + 50 && y1 > W.bridge.y0 - 50 && y0 < W.bridge.y1 + 50) R.drawBridge(ctx, W.bridgeFixed, t);
    if (x1 > 1180 && x0 < 1340 && y1 > 1930 && y0 < 2060) R.drawDam(ctx, 1260, 1990);

    // objects are anchored at their base and drawn upward, so look further below the view than above it
    var cx0 = x0 - 160, cx1 = x1 + 160, cy0 = y0 - 40, cy1 = y1 + 260;
    var items = W.queryDraw(cx0, cy0, cx1, cy1).filter(function (o) { return o.x > cx0 && o.x < cx1 && o.y > cy0 && o.y < cy1; });
    var inView = function (x, y) { return x > x0 - 80 && x < x1 + 80 && y > y0 - 40 && y < y1 + 120; };
    W.pickups.forEach(function (p) { if (p.active && inView(p.x, p.y)) items.push({ type: '_pickup', ref: p, sortY: p.y }); });
    G.humans.forEach(function (h) { if (h.present && !h.asleep && inView(h.x, h.y)) items.push({ type: '_human', ref: h, sortY: h.y }); });
    if (inView(G.ranger.x, G.ranger.y)) items.push({ type: '_human', ref: G.ranger, sortY: G.ranger.y });
    Object.keys(W.friends).forEach(function (k) { var f = W.friends[k]; if (inView(f.x, f.y)) items.push({ type: '_friend', ref: f, sortY: f.y }); });
    G.vehicles.forEach(function (v) { if (inView(v.x, v.y)) items.push({ type: '_vehicle', ref: v, sortY: v.y + (v.type === 'boat' ? -30 : 0) }); });
    if (G.mode === 'play' && !P.vehicle && !P.hiddenIn) items.push({ type: '_player', sortY: P.y });
    items.sort(function (a, b) { return a.sortY - b.sortY; });

    var showP = G.mode === 'play' && !P.hiddenIn;
    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      switch (o.type) {
        case '_pickup': R.drawPickup(ctx, o.ref, t); break;
        case '_human': o.ref.draw(ctx, G); break;
        case '_friend': SS.drawFriend(ctx, o.ref, t); break;
        case '_vehicle': R.drawVehicle(ctx, o.ref, t, P.vehicle === o.ref ? { hat: P.outfit.hat, top: P.outfit.top } : null); if (P.vehicle === o.ref && P.carrying) R.drawGiantCake(ctx, o.ref.x, o.ref.y - 36, t); break;
        case '_player':
          R.drawSasquatch(ctx, P.x, P.y, { face: R.faceOf(P.dir), t: P.t, moving: P.moving, run: P.run, hat: P.outfit.hat, top: P.outfit.top, carry: P.carrying });
          break;
        case 'tree':
          var fadeT = showP && Math.abs(P.x - o.x) < 36 * o.s && P.y < o.y - 2 && P.y > o.y - 96 * o.s;
          if (fadeT) ctx.globalAlpha = 0.42;
          R.drawObject(ctx, o, t, G);
          ctx.globalAlpha = 1;
          break;
        case 'building':
          o.fade = showP && P.x > o.x0 - 14 && P.x < o.x1 + 14 && P.y < o.y1 - 2 && P.y > o.y0 - (BH[o.kind] || 60) + 4;
          R.drawObject(ctx, o, t, G);
          break;
        default:
          R.drawObject(ctx, o, t, G);
      }
    }
    if (G.mode === 'play') SS.Fishing.drawWorld(ctx, G, t);

    // lighting & tint (indicators below are drawn on top so they stay readable at night)
    if (G.dark > 0.01) R.drawLighting(ctx, cam, G.dark, G.lightsNow, G.tint);
    else if (G.tint) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = G.tint; ctx.fillRect(0, 0, cam.vw * cam.dpr, cam.vh * cam.dpr); }
    ctx.setTransform(sc, 0, 0, sc, -cam.x * sc, -cam.y * sc);

    // tents with sleeping campers
    W.sites.forEach(function (s) {
      if (!inView(s.tent.tx, s.tent.ty)) return;
      if (s.campers.some(function (c) { return c.asleep; })) {
        ctx.font = 'bold 14px "Lilita One", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
        for (var z = 0; z < 3; z++) { var p = ((t * 0.5 + z / 3) % 1); ctx.globalAlpha = 1 - p; ctx.fillText('z', s.tent.tx + 14 + p * 14 + Math.sin(t * 2 + z) * 3, s.tent.ty - 30 - p * 30); }
        ctx.globalAlpha = 1;
      }
    });

    // overhead indicators
    if (G.mode === 'play') {
      G.humans.concat([G.ranger]).forEach(function (h) {
        if (!h.present || h.asleep || !inView(h.x, h.y)) return;
        var hy = h.y - 52;
        var alarmed = h.state === 'alarm' || h.state === 'cower' || h.state === 'chase';
        if (alarmed) drawMark(ctx, h.x, hy, '!', '#e0412f', 1, t);
        else if (h.sus > 0.02) drawMark(ctx, h.x, hy, '?', '#f2b632', h.sus, t);
        if (h.bubble && h.bubble !== '?') drawBubble(ctx, h.x, hy - (alarmed || h.sus > 0.02 ? 28 : 4), h.bubble);
      });
      Object.keys(W.friends).forEach(function (k) {
        var f = W.friends[k];
        if (!inView(f.x, f.y)) return;
        var st = friendMark(k);
        if (st) drawFriendMark(ctx, f.x, f.y - (k === 'bear' ? 78 : 50), st, t);
      });
      if (G.quests.golf === 'available' && inView(W.clubhouse.ix, W.clubhouse.iy)) drawFriendMark(ctx, W.clubhouse.ix, W.clubhouse.iy - 96, 'new', t);
      var f = G.focus;
      if (f && !UI.modalOpen) {
        var bob = Math.sin(t * 6) * 3;
        ctx.fillStyle = '#fff8dc'; ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(f.mx - 7, f.my - 12 + bob); ctx.lineTo(f.mx + 7, f.my - 12 + bob); ctx.lineTo(f.mx, f.my - 3 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (G.rummage) {
        var rp = G.rummage.t / 1.1;
        R.rrect(ctx, P.x - 22, P.y - 70, 44, 8, 4, 'rgba(40,25,10,0.85)');
        R.rrect(ctx, P.x - 21, P.y - 69, 42 * rp, 6, 3, '#f2c14e');
      }
    }

    // screen-space overlays
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    if (G.mode === 'play') {
      SS.Fishing.drawUI(ctx, G, cam);
      if (G.ranger.state === 'chase') {
        var a = 0.22 + Math.sin(t * 8) * 0.08;
        var gr = ctx.createRadialGradient(cam.vw / 2, cam.vh / 2, Math.min(cam.vw, cam.vh) * 0.35, cam.vw / 2, cam.vh / 2, Math.max(cam.vw, cam.vh) * 0.75);
        gr.addColorStop(0, 'rgba(200,30,20,0)'); gr.addColorStop(1, 'rgba(200,30,20,' + a.toFixed(3) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, cam.vw, cam.vh);
      }
    }
  }
  function friendMark(k) {
    var qs = SS.QUESTS.filter(function (q) { return q.giver === k; });
    var act = qs.filter(function (q) { return G.quests[q.id] === 'active'; })[0];
    if (act) return needMet(act) ? 'ready' : 'wait';
    if (qs.some(function (q) { return G.quests[q.id] === 'available'; })) return 'new';
    return null;
  }
  function drawMark(ctx, x, y, ch, color, fill, t) {
    var r = 9;
    ctx.save();
    var bob = ch === '!' ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    y -= bob;
    R.circ(ctx, x, y, r + 2, 'rgba(40,25,10,0.85)');
    if (ch === '?') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(fill, 0, 1)); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    } else R.circ(ctx, x, y, r, color);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + 1);
    ctx.restore();
  }
  function drawFriendMark(ctx, x, y, st, t) {
    var bob = Math.sin(t * 3) * 3;
    ctx.save();
    var col = st === 'new' ? '#f2c14e' : st === 'ready' ? '#7bc96f' : '#c9b48a';
    var ch = st === 'new' ? '!' : st === 'ready' ? '?' : '…';
    R.circ(ctx, x, y + bob, 12, 'rgba(40,25,10,0.85)');
    R.circ(ctx, x, y + bob, 10, col);
    ctx.fillStyle = '#3a2210'; ctx.font = 'bold 16px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, x, y + bob + 1);
    ctx.restore();
  }
  function drawBubble(ctx, x, y, text) {
    ctx.save();
    ctx.font = '700 11px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 14, h = 20;
    R.rrect(ctx, x - w / 2, y - h, w, h, 8, 'rgba(255,250,235,0.95)');
    ctx.fillStyle = 'rgba(255,250,235,0.95)'; ctx.beginPath(); ctx.moveTo(x - 4, y - 1); ctx.lineTo(x + 4, y - 1); ctx.lineTo(x, y + 5); ctx.fill();
    ctx.fillStyle = '#3a2210'; ctx.fillText(text, x, y - h / 2 + 0.5);
    ctx.restore();
  }

  window.addEventListener('load', function () {
    try { G.boot(); }
    catch (e) {
      var l = document.getElementById('loading');
      if (l) { l.hidden = false; l.textContent = 'Something went wrong while loading: ' + e.message; }
      throw e;
    }
  });
})();
