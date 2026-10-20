/* Sneeky Sasquatch - player, humans (campers, townsfolk, golfers...), the ranger, friends, vehicles */
'use strict';
(function () {
  var W = SS.world, R = SS.R;
  var clamp = SS.clamp, TAU = SS.TAU;

  // ---------------- Player ----------------
  function Player() {
    this.x = W.home.x; this.y = W.home.y; this.r = 11;
    this.dir = Math.PI / 2; this.face = 'down'; this.dirX = 0;
    this.moving = false; this.run = false; this.t = 0;
    this.hunger = 75; this.energy = 100; this.money = 0;
    this.inv = []; this.slots = 8;
    this.gear = { rod: false, prorod: false, flashlight: false, bigpack: false, kart: false };
    this.bait = 0;
    this.outfit = { hat: 'none', top: 'none' };
    this.ward = { hats: ['none'], tops: ['none'] };
    this.hiddenIn = null; this.vehicle = null; this.carrying = null;
    this.wanted = 0; this.exhaustT = 0; this.busy = 0;
  }
  Player.prototype.disguised = function () { return this.outfit.hat !== 'none' && this.outfit.top !== 'none'; };
  Player.prototype.count = function (id) { var n = 0; this.inv.forEach(function (s) { if (s.id === id) n += s.n; }); return n; };
  Player.prototype.countType = function (type) { var n = 0; this.inv.forEach(function (s) { if (SS.ITEMS[s.id].type === type) n += s.n; }); return n; };
  Player.prototype.space = function (id) {
    var room = (this.slots - this.inv.length) * SS.STACK;
    this.inv.forEach(function (s) { if (s.id === id) room += SS.STACK - s.n; });
    return room;
  };
  Player.prototype.add = function (id, n) {
    n = n || 1; var added = 0;
    for (var i = 0; i < this.inv.length && n > 0; i++) {
      var s = this.inv[i];
      if (s.id === id && s.n < SS.STACK) { var k = Math.min(n, SS.STACK - s.n); s.n += k; n -= k; added += k; }
    }
    while (n > 0 && this.inv.length < this.slots) { var k2 = Math.min(n, SS.STACK); this.inv.push({ id: id, n: k2 }); n -= k2; added += k2; }
    return added;
  };
  Player.prototype.remove = function (id, n) {
    n = n || 1;
    for (var i = this.inv.length - 1; i >= 0 && n > 0; i--) {
      var s = this.inv[i];
      if (s.id === id) { var k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.inv.splice(i, 1); }
    }
    return n === 0;
  };
  Player.prototype.removeType = function (type, n) {
    for (var i = this.inv.length - 1; i >= 0 && n > 0; i--) {
      var s = this.inv[i];
      if (SS.ITEMS[s.id].type === type) { var k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n <= 0) this.inv.splice(i, 1); }
    }
  };
  SS.Player = Player;

  // ---------------- vision ----------------
  // returns 0 (can't see) .. 1 (very close & clear)
  SS.seePlayer = function (h, G, ignoreFov) {
    var P = G.player;
    if (P.hiddenIn || !G.playerVisible) return 0;
    var dx = P.x - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy);
    var range = h.range, fov = h.fov;
    if (G.dark > 0.35) {
      if (h.isRanger) { range = h.flashOn ? 250 : 90; if (h.flashOn) fov = 0.55; }
      else range = G.playerLit ? h.range * 0.75 : 85;
    }
    if (P.vehicle) range *= 1.15;
    if (P.carrying) range *= 1.25;
    if (d > range) return 0;
    if (!ignoreFov && d > 44) {
      if (Math.abs(SS.angDiff(h.dir, Math.atan2(dy, dx))) > fov) return 0;
    }
    if (!W.losClear(h.x, h.y, P.x, P.y)) return 0;
    return clamp(1 - d / range, 0.05, 1);
  };

  // ---------------- base NPC movement ----------------
  function NPC() {}
  NPC.prototype.say = function (text, time) { this.bubble = text; this.bubbleT = time || 2.2; };
  NPC.prototype.stepToward = function (tx, ty, speed, dt) {
    var dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 2) { this.moving = false; return true; }
    var s = Math.min(d, speed * dt);
    var ox = this.x, oy = this.y;
    W.move(this, dx / d * s, dy / d * s, this.r, 'foot');
    var moved = Math.hypot(this.x - ox, this.y - oy);
    this.dir = SS.approachAngle(this.dir, Math.atan2(dy, dx), dt * 10);
    this.moving = moved > 0.2;
    this.speedNow = moved / Math.max(dt, 0.001);
    if (moved < s * 0.3) this.stuckT = (this.stuckT || 0) + dt; else this.stuckT = 0;
    return d - s < 3;
  };
  NPC.prototype.goTo = function (x, y) {
    this.path = W.findPath(this.x, this.y, x, y) || [[x, y]];
    this.goal = [x, y];
  };
  NPC.prototype.followPath = function (speed, dt) {
    if (!this.path || !this.path.length) { this.moving = false; return true; }
    var p = this.path[0];
    if (this.stepToward(p[0], p[1], speed, dt) || Math.hypot(p[0] - this.x, p[1] - this.y) < 8) this.path.shift();
    if (this.stuckT > 1.2) {
      this.stuckT = 0;
      var last = this.path[this.path.length - 1];
      if (last && Math.hypot(last[0] - this.x, last[1] - this.y) < 36) { this.path = []; this.moving = false; return true; }
      if (this.goal) { this.path = W.findPath(this.x, this.y, this.goal[0], this.goal[1]); if (!this.path) { this.path = []; return true; } }
      else this.path.shift();
    }
    return !this.path.length;
  };
  NPC.prototype.lookAround = function (dt) {
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookTarget = this.dir + SS.rand.range(-1.8, 1.8); this.lookT = SS.rand.range(1.2, 3.5); }
    this.dir = SS.approachAngle(this.dir, this.lookTarget, dt * 2.2);
  };
  NPC.prototype.faceToward = function (x, y, dt, rate) {
    this.dir = SS.approachAngle(this.dir, Math.atan2(y - this.y, x - this.x), dt * (rate || 6));
  };

  // ---------------- Humans ----------------
  var SKINS = ['#f1c9a5', '#e0ac7e', '#c68e62', '#9c6a43', '#6e4a2e', '#f5d7bd'];
  var HAIRS = ['#2b1a10', '#5a3519', '#a0662e', '#e3c16f', '#8a8a8a', '#1a1a1a', '#b5452f'];
  var SHIRTS = ['#e85d75', '#3fa7d6', '#f2c14e', '#7bc950', '#9b5de5', '#f28f3b', '#ffffff', '#2ec4b6', '#ef476f'];
  var PANTS = ['#2c3e50', '#34495e', '#6d4c41', '#3b5998', '#556b2f', '#7f8c8d', '#c9b28a'];
  function randomLook(rnd) {
    return { skin: rnd.pick(SKINS), hair: rnd.pick(HAIRS), hairStyle: rnd.int(0, 2), shirt: rnd.pick(SHIRTS), pants: rnd.pick(PANTS), hat: rnd() < 0.25 ? rnd.pick(['#d23c3c', '#2f5a8a', '#f2c14e', '#3f8a4f']) : null };
  }

  function Human(opt) {
    this.kind = opt.kind; this.x = opt.x; this.y = opt.y; this.r = 8;
    this.home = { x: opt.x, y: opt.y };
    this.look = opt.look; this.dir = SS.rand.range(0, TAU);
    this.state = 'idle'; this.timer = SS.rand.range(1, 4); this.t = SS.rand() * 10;
    this.sus = 0; this.bubble = null; this.bubbleT = 0; this.lookT = 0; this.lookTarget = this.dir;
    this.walk = 48; this.runSpd = 150;
    this.range = opt.range || 210; this.fov = opt.fov || 1.0;
    this.site = opt.site; this.spots = opt.spots || [];
    this.wake = opt.wake || 7; this.sleep = opt.sleep || 23;
    this.hours = opt.hours || null; // [start, end] for daytime visitors
    this.exit = opt.exit || null;
    this.present = true; this.asleep = false; this.sitting = false;
    this.waypoints = opt.waypoints || null; this.wp = 0;
    this.alertCD = 0;
  }
  Human.prototype = Object.create(NPC.prototype);
  Human.prototype.awakeNow = function (G) {
    var h = G.hour;
    if (this.kind === 'camper') {
      if (this.sleep > this.wake) return h >= this.wake && h < this.sleep;
      return h >= this.wake || h < this.sleep - 24;
    }
    if (this.hours) return h >= this.hours[0] && h < this.hours[1];
    return true;
  };
  Human.prototype.update = function (dt, G) {
    this.t += dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }
    if (this.alertCD > 0) this.alertCD -= dt;
    if (this.kind === 'guest' && !G.party.active) { this.present = false; return; }
    var shouldBeUp = this.awakeNow(G);
    var P = G.player;

    // schedules
    if (this.kind === 'camper') {
      if (!shouldBeUp && !this.asleep && this.state !== 'tobed' && this.state !== 'alarm' && this.state !== 'cower') {
        this.state = 'tobed'; this.goTo(this.site.door.x, this.site.door.y + 6); this.sitting = false;
      }
      if (shouldBeUp && this.asleep) { this.asleep = false; this.x = this.site.door.x; this.y = this.site.door.y + 8; this.state = 'idle'; this.timer = 1; this.say('*yawn*', 2); }
      if (this.asleep) { this.moving = false; return; }
    } else if (this.hours) {
      if (!shouldBeUp && this.present && this.state !== 'leaving' && this.state !== 'alarm') {
        this.state = 'leaving'; this.sitting = false; this.goTo(this.exit.x, this.exit.y);
      }
      if (shouldBeUp && !this.present) { this.present = true; this.x = this.exit.x; this.y = this.exit.y; this.state = 'arrive'; this.goTo(this.home.x, this.home.y); }
      if (!this.present) return;
    }

    // vision & suspicion
    var see = (this.state === 'tobed' || this.state === 'leaving') ? 0 : SS.seePlayer(this, G, false);
    this.seesPlayer = see > 0;
    var blendIn = P.disguised() && P.wanted <= 0 && !P.carrying;
    if (see > 0 && !blendIn && this.state !== 'alarm' && this.state !== 'cower') {
      var rate = (0.55 + see * 2.2) * (P.run ? 1.3 : 1);
      if (this.sus <= 0) { this.say('?', 1.2); SS.audio.play('huh'); }
      this.sus += rate * dt;
      this.faceToward(P.x, P.y, dt, 3);
      if (this.sus >= 1) this.panic(G, 'bigfoot');
    } else if (this.state !== 'cower') {
      this.sus = Math.max(0, this.sus - dt * 0.35);
    }

    switch (this.state) {
      case 'idle':
        this.moving = false;
        this.lookAround(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.pickActivity(G);
        break;
      case 'walk':
        this.sitting = false;
        if (this.followPath(this.walk, dt)) {
          this.state = 'idle'; this.timer = SS.rand.range(3, 8);
          this.sitting = !!this.sitAfter; this.sitAfter = false;
          if (this.faceAfter !== undefined) { this.dir = this.faceAfter; this.lookTarget = this.dir; this.faceAfter = undefined; }
        }
        break;
      case 'arrive':
        if (this.followPath(this.walk, dt)) { this.state = 'idle'; this.timer = 2; }
        break;
      case 'leaving':
        if (this.followPath(this.walk * 1.2, dt)) { this.present = false; this.state = 'idle'; }
        break;
      case 'tobed':
        if (this.followPath(this.walk, dt)) { this.asleep = true; this.state = 'idle'; this.sus = 0; }
        break;
      case 'investigate':
        this.sitting = false;
        if (this.followPath(this.walk * 1.3, dt) || this.timer < 4) {
          this.lookAround(dt);
          this.moving = false;
        }
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'walk'; this.goTo(this.home.x, this.home.y); }
        break;
      case 'alarm':
        this.sitting = false;
        var ax = this.x - P.x, ay = this.y - P.y, ad = Math.hypot(ax, ay) || 1;
        this.stepToward(this.x + ax / ad * 60, this.y + ay / ad * 60, this.runSpd, dt);
        this.dir = Math.atan2(P.y - this.y, P.x - this.x);
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'cower'; this.timer = 7; }
        break;
      case 'cower':
        this.moving = false;
        this.timer -= dt;
        if (see > 0 && !blendIn) {
          this.faceToward(P.x, P.y, dt, 6);
          if (this.alertCD <= 0) { this.say(SS.rand.pick(SS.SCREAMS)); G.alertRanger(P.x, P.y, this); this.alertCD = 4; }
          this.timer = Math.max(this.timer, 3);
        }
        if (this.timer <= 0) { this.sus = 0; this.state = 'walk'; this.goTo(this.home.x, this.home.y); this.say(SS.rand.pick(['Phew...', 'Was that real?', 'I need a vacation.']), 2); }
        break;
    }
  };
  Human.prototype.pickActivity = function (G) {
    var rnd = SS.rand;
    if (this.kind === 'camper') {
      var r = rnd();
      var site = this.site;
      if (Math.hypot(this.x - site.x, this.y - site.y) > 130) {
        this.state = 'walk'; this.goTo(site.x + rnd.range(-25, 25), site.y + rnd.range(0, 40));
      } else if (r < 0.45) {
        var sp = this.spots[rnd.int(0, this.spots.length - 1)];
        this.state = 'walk'; this.goTo(sp[0], sp[1]); this.sitAfter = true;
        this.faceAfter = Math.atan2(site.y + 40 - sp[1], site.x - 30 - sp[0]) + rnd.range(-0.6, 0.6);
      } else if (r < 0.85) {
        var a = rnd.range(0, TAU), d = rnd.range(20, 80);
        this.state = 'walk'; this.goTo(site.x + Math.cos(a) * d, site.y + Math.sin(a) * d);
      } else {
        var dest = rnd.pick([[1550, 1300], [1440, 1270], [1660, 1270]]);
        this.state = 'walk'; this.goTo(dest[0], dest[1]);
        this.home = { x: site.x + rnd.range(-30, 30), y: site.y + rnd.range(-20, 30) };
      }
    } else if (this.kind === 'beach') {
      if (rnd() < 0.7) { this.state = 'walk'; this.path = [[this.home.x, this.home.y]]; this.goal = null; this.sitAfter = true; this.faceAfter = rnd.range(0, TAU); }
      else { this.state = 'walk'; this.path = [[this.home.x + rnd.range(-90, 90), this.home.y - rnd.range(0, 25)]]; this.goal = null; }
    } else if (this.kind === 'town' || this.kind === 'golfer') {
      this.wp = (this.wp + 1) % this.waypoints.length;
      var w = this.waypoints[this.wp];
      this.state = 'walk'; this.goTo(w[0], w[1]);
    } else if (this.kind === 'guest') {
      this.state = 'walk'; this.path = [[this.home.x + rnd.range(-40, 40), this.home.y + rnd.range(-20, 30)]]; this.goal = null;
    }
    this.timer = rnd.range(3, 7);
  };
  Human.prototype.panic = function (G, why) {
    var P = G.player;
    this.state = 'alarm'; this.timer = 2.2; this.sus = 1; this.sitting = false;
    this.say(why === 'thief' ? SS.rand.pick(SS.THIEF) : SS.rand.pick(SS.SCREAMS), 2.8);
    SS.audio.play('scream');
    G.alertRanger(P.x, P.y, this);
    this.alertCD = 4;
    G.onSpotted(this);
    // nearby humans turn to look
    G.humans.forEach(function (o) {
      if (o !== this && o.present && !o.asleep && Math.hypot(o.x - this.x, o.y - this.y) < 260) { o.faceToward(P.x, P.y, 1, 10); o.sus = Math.max(o.sus, 0.5); }
    }, this);
  };
  Human.prototype.hearNoise = function (x, y) {
    if (this.asleep || !this.present || this.state === 'alarm' || this.state === 'cower' || this.state === 'tobed' || this.state === 'leaving') return;
    this.state = 'investigate'; this.timer = 8; this.sitting = false;
    var a = Math.atan2(this.y - y, this.x - x);
    this.goTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40);
    this.say(SS.rand.pick(SS.HUH), 2);
  };
  Human.prototype.draw = function (ctx, G) {
    if (!this.present || this.asleep) return;
    R.drawHuman(ctx, this.x, this.y, { face: R.faceOf(this.dir), t: this.t, moving: this.moving, look: this.look, sitting: this.sitting && !this.moving, scared: this.state === 'alarm' || this.state === 'cower', run: this.state === 'alarm' });
  };
  SS.Human = Human;

  // ---------------- Ranger ----------------
  function Ranger() {
    Human.call(this, { kind: 'ranger', x: W.rangerPost.x, y: W.rangerPost.y, look: { skin: '#e0ac7e', hair: '#5a3519', hairStyle: 0, shirt: '#c8b27a', pants: '#56693f', ranger: true }, range: 270, fov: 0.95 });
    this.isRanger = true;
    this.walk = 78; this.runSpd = 202;
    this.state = 'patrol'; this.route = 0; this.pause = 0;
    this.lastSeen = null; this.lostT = 0; this.repath = 0; this.flashOn = false;
  }
  Ranger.prototype = Object.create(Human.prototype);
  Ranger.ROUTE = [[2380, 1330, 6], [2100, 1385, 0], [1890, 1250, 2], [1790, 1100, 0], [1550, 1052, 3], [1310, 1100, 0], [1222, 1250, 3], [1320, 1405, 0], [1550, 1450, 3], [1780, 1405, 0], [1890, 1250, 0],
    [1960, 900, 0], [2230, 790, 3], [2450, 770, 4], [2200, 790, 0], [1960, 900, 0], [2100, 1385, 0], [2700, 1360, 2], [2380, 1330, 8]];
  Ranger.prototype.update = function (dt, G) {
    var P = G.player;
    this.t += dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble = null; }
    this.flashOn = G.dark > 0.3 && this.state !== 'nap';
    var h = G.hour;
    var napTime = h >= 1 && h < 4.5;
    var heist = G.party.active;

    if (napTime && (this.state === 'patrol' || this.state === 'return' || this.state === 'guard')) {
      this.state = 'tonap'; this.goTo(W.rangerPost.x, W.rangerPost.y);
    }
    if (this.state === 'nap' && !napTime) { this.state = heist ? 'guard' : 'patrol'; this.say('*SNORT* Huh? I\'m awake!', 2.5); this.path = null; }

    // vision
    var chasing = this.state === 'chase';
    var see = (this.state === 'nap' || this.state === 'tonap') ? 0 : SS.seePlayer(this, G, chasing);
    var blendIn = P.disguised() && P.wanted <= 0 && !P.carrying;
    this.seesPlayer = see > 0;
    if (see > 0 && !blendIn && !chasing) {
      if (this.sus <= 0) { this.say('?', 1); SS.audio.play('huh'); }
      this.sus += (1 + see * 3) * dt;
      this.faceToward(P.x, P.y, dt, 4);
      if (this.sus >= 1) this.startChase(G);
    } else if (!chasing) this.sus = Math.max(0, this.sus - dt * 0.4);

    var dP = Math.hypot(P.x - this.x, P.y - this.y);
    switch (this.state) {
      case 'patrol': {
        var wp = Ranger.ROUTE[this.route];
        if (heist && h >= 10 && h < 21) { this.state = 'party'; this.goTo(2590, 1280); break; }
        if (heist && G.dark > 0.3) { this.state = 'guard'; this.goTo(2620, 1290); break; }
        if (this.pause > 0) { this.pause -= dt; this.moving = false; this.lookAround(dt); break; }
        if (!this.path || !this.path.length) {
          if (Math.hypot(wp[0] - this.x, wp[1] - this.y) < 12) { this.pause = wp[2]; this.route = (this.route + 1) % Ranger.ROUTE.length; this.path = null; }
          else this.goTo(wp[0], wp[1]);
        }
        if (this.path && this.path.length) this.followPath(this.walk, dt);
        break;
      }
      case 'party':
      case 'guard':
        if (this.state === 'party' && !(heist && h >= 10 && h < 21)) { this.state = 'patrol'; this.path = null; break; }
        if (this.state === 'guard' && !(heist && G.dark > 0.3)) { this.state = 'patrol'; this.path = null; break; }
        if (!heist) { this.state = 'patrol'; this.path = null; break; }
        if (this.path && this.path.length) this.followPath(this.walk, dt);
        else { this.moving = false; this.lookAround(dt); }
        break;
      case 'tonap':
        if (this.followPath(this.walk, dt)) { this.state = 'nap'; this.dir = Math.PI / 2; }
        break;
      case 'nap':
        this.moving = false;
        if (!this.bubble) this.say('Zzz...', 2.5);
        break;
      case 'respond':
        if (this.followPath(this.runSpd * 0.9, dt) || (this.timer -= dt) <= 0) {
          this.state = 'search'; this.timer = 6; this.searchAt = this.goal || [this.x, this.y]; this.path = null;
        }
        break;
      case 'investigate':
        if (this.followPath(this.walk * 1.4, dt)) { this.moving = false; this.lookAround(dt); }
        this.timer -= dt;
        if (this.timer <= 0) this.goBack();
        break;
      case 'chase':
        this.updateChase(dt, G, see, dP);
        break;
      case 'search':
        this.timer -= dt;
        if (!this.path || !this.path.length) {
          if (this.pause > 0) { this.pause -= dt; this.lookAround(dt); this.moving = false; }
          else { var sa = this.searchAt; this.path = [[sa[0] + SS.rand.range(-110, 110), sa[1] + SS.rand.range(-110, 110)]]; this.goal = null; this.pause = 1.2; }
        } else this.followPath(this.walk * 1.2, dt);
        if (this.stuckT > 0.5) this.path = null;
        if (this.timer <= 0) { this.say(SS.rand.pick(['Must\'ve been a bear...', 'Hmm. Lost it.', 'Darn tourists and their stories.']), 2.5); this.goBack(); }
        break;
      case 'return':
        if (this.followPath(this.walk, dt)) { this.state = heist ? 'party' : 'patrol'; this.path = null; }
        break;
    }
  };
  Ranger.prototype.goBack = function () {
    this.state = 'return';
    var target = SS.game.party.active ? [2590, 1280] : null;
    if (!target) {
      var best = 0, bd = Infinity;
      for (var i = 0; i < Ranger.ROUTE.length; i++) { var d = Math.hypot(Ranger.ROUTE[i][0] - this.x, Ranger.ROUTE[i][1] - this.y); if (d < bd) { bd = d; best = i; } }
      this.route = best; target = Ranger.ROUTE[best];
    }
    this.goTo(target[0], target[1]);
  };
  Ranger.prototype.startChase = function (G) {
    if (this.state === 'chase') return;
    this.state = 'chase'; this.sus = 1; this.lostT = 0;
    this.lastSeen = [G.player.x, G.player.y];
    this.say(SS.rand.pick(['HEY! STOP RIGHT THERE!', 'FREEZE, SASQUATCH!', 'Got you now!']), 2.5);
    SS.audio.play('whistle');
    G.onChase();
  };
  Ranger.prototype.updateChase = function (dt, G, see, dP) {
    var P = G.player;
    if (see > 0 && !P.hiddenIn) {
      this.lastSeen = [P.x, P.y]; this.lostT = 0;
      if (this.stuckT > 0.35 || this.usingPath) {
        this.repath -= dt;
        if (this.repath <= 0 || !this.path || !this.path.length) { this.goTo(P.x, P.y); this.repath = 0.6; this.usingPath = true; }
        this.followPath(this.runSpd, dt);
        if (W.walkLine(this.x, this.y, P.x, P.y, 8)) this.usingPath = false;
      } else this.stepToward(P.x, P.y, this.runSpd, dt);
    } else {
      this.lostT += dt;
      if (!this.path || !this.path.length || this.lostGoal !== this.lastSeen) { this.goTo(this.lastSeen[0], this.lastSeen[1]); this.lostGoal = this.lastSeen; }
      var arrived = this.followPath(this.runSpd * 0.85, dt);
      if (arrived || this.lostT > 4) {
        this.state = 'search'; this.timer = 7; this.searchAt = this.lastSeen; this.path = null; this.pause = 0.8;
        this.say(SS.rand.pick(['Where\'d it go?', 'I know you\'re around here...', 'Come out, big guy!']), 2.5);
      }
    }
    if (dP < 24 && !P.hiddenIn && (!P.vehicle || P.vehicle.speed < 40)) G.caught();
  };
  Ranger.prototype.alert = function (x, y, G) {
    if (this.state === 'chase') return;
    if (this.state === 'nap' || this.state === 'tonap') {
      if (Math.hypot(x - this.x, y - this.y) > 320) return;
      this.say('Wha-? Who\'s screaming?!', 2);
    } else this.say(SS.rand.pick(['On my way!', 'Sasquatch sighting?!', 'Not again!']), 2);
    this.state = 'respond'; this.timer = 25; this.sus = 0.4;
    this.goTo(x, y);
    SS.audio.play('whistle');
  };
  Ranger.prototype.hearNoise = function (x, y) {
    if (this.state === 'chase' || this.state === 'respond' || this.state === 'nap' || this.state === 'tonap') return;
    this.state = 'investigate'; this.timer = 9;
    this.goTo(x + SS.rand.range(-30, 30), y + 36);
    this.say(SS.rand.pick(['What was that noise?', 'Raccoons in the trash again?', 'Hmm?']), 2);
  };
  Ranger.prototype.draw = function (ctx, G) {
    R.drawHuman(ctx, this.x, this.y, { face: R.faceOf(this.dir), t: this.t, moving: this.moving, look: this.look, sitting: this.state === 'nap', run: this.state === 'chase' || this.state === 'respond', flashlight: this.flashOn });
  };
  SS.Ranger = Ranger;

  // ---------------- spawning ----------------
  SS.spawnHumans = function (G) {
    var rnd = SS.rng(4242), humans = [];
    W.sites.forEach(function (site, i) {
      var n = W.siteDefs[i].campers;
      for (var k = 0; k < n; k++) {
        var sp = site.sit[k % site.sit.length];
        var h = new Human({ kind: 'camper', x: sp[0], y: sp[1], look: randomLook(rnd), site: site, spots: site.sit, wake: 6 + rnd() * 2, sleep: 21.5 + rnd() * 3 });
        h.home = { x: site.x + rnd.range(-30, 30), y: site.y + rnd.range(-10, 40) };
        site.campers.push(h); humans.push(h);
      }
    });
    var beachExit = { x: 1960, y: 860 };
    humans.push(new Human({ kind: 'beach', x: 2262, y: 748, look: randomLook(rnd), hours: [9, 19], exit: beachExit, range: 190 }));
    humans.push(new Human({ kind: 'beach', x: 2640, y: 756, look: randomLook(rnd), hours: [10, 18.5], exit: beachExit, range: 190 }));
    var townWp1 = [[2760, 1350], [3000, 1350], [3020, 1236], [3200, 1350], [3420, 1350], [3060, 1430], [3060, 1700], [3060, 1430]];
    var townWp2 = [[3420, 1350], [3060, 1640], [2980, 1700], [2980, 1440], [3020, 1236], [2700, 1350], [3260, 1350]];
    var townExit = { x: 3500, y: 1350 };
    humans.push(new Human({ kind: 'town', x: 3000, y: 1350, look: randomLook(rnd), hours: [7, 21], exit: townExit, waypoints: townWp1 }));
    humans.push(new Human({ kind: 'town', x: 3300, y: 1350, look: randomLook(rnd), hours: [8, 20], exit: townExit, waypoints: townWp2 }));
    humans.push(new Human({ kind: 'town', x: 2980, y: 1600, look: randomLook(rnd), hours: [9, 19.5], exit: townExit, waypoints: townWp1.slice().reverse() }));
    var golfExit = { x: 2250, y: 2690 };
    var gw1 = [[1000, 2300], [1250, 2280], [1480, 2250], [1250, 2300]];
    var gw2 = [[2450, 2520], [2750, 2440], [3040, 2390], [2700, 2500]];
    var gw3 = [[2420, 2210], [2750, 2200], [3080, 2195], [2750, 2215]];
    humans.push(new Human({ kind: 'golfer', x: 1100, y: 2300, look: Object.assign(randomLook(rnd), { shirt: '#f4f4ee', hat: '#3f8a4f' }), hours: [8, 19], exit: golfExit, waypoints: gw1 }));
    humans.push(new Human({ kind: 'golfer', x: 2600, y: 2480, look: Object.assign(randomLook(rnd), { shirt: '#9bd4f5' }), hours: [8.5, 18.5], exit: golfExit, waypoints: gw2 }));
    humans.push(new Human({ kind: 'golfer', x: 2600, y: 2205, look: Object.assign(randomLook(rnd), { shirt: '#f7b2c4', hat: '#ffffff' }), hours: [9, 18], exit: golfExit, waypoints: gw3 }));
    // party guests (only during the heist)
    humans.push(new Human({ kind: 'guest', x: 2570, y: 1250, look: Object.assign(randomLook(rnd), { hat: '#e85d75' }), hours: [10, 21], exit: { x: 2700, y: 1380 } }));
    humans.push(new Human({ kind: 'guest', x: 2655, y: 1276, look: Object.assign(randomLook(rnd), { hat: '#3fa7d6' }), hours: [10, 21], exit: { x: 2700, y: 1380 } }));
    humans.forEach(function (h) { if (h.kind === 'guest') { h.present = false; h.home = { x: h.x, y: h.y }; } });
    return humans;
  };

  // ---------------- Friends ----------------
  SS.drawFriend = function (ctx, f, t) {
    if (f.id === 'raccoon') R.drawRaccoon(ctx, f.x, f.y, t);
    else if (f.id === 'bear') R.drawBear(ctx, f.x, f.y, t);
    else if (f.id === 'beaver') R.drawBeaver(ctx, f.x, f.y, t);
  };

  // ---------------- Vehicles ----------------
  SS.VEH = {
    kart: { name: 'Go-Kart', speed: 330, accel: 520, r: 16, mode: 'foot' },
    golfcart: { name: 'Golf Cart', speed: 250, accel: 380, r: 17, mode: 'foot' },
    boat: { name: 'Rowboat', speed: 150, accel: 170, r: 18, mode: 'boat' }
  };
  SS.Vehicle = function (type, x, y, angle) {
    this.type = type; this.x = x; this.y = y; this.angle = angle || 0; this.speed = 0; this.vx = 0; this.vy = 0;
    this.def = SS.VEH[type];
  };
})();
