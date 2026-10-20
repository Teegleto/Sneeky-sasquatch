/* Sneeky Sasquatch - DOM user interface: HUD, hotbar, dialogs, shop, cave, wardrobe, map, menus */
'use strict';
(function () {
  var UI = SS.ui = {};
  var R = SS.R, W = SS.world;
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  UI.el = el;
  function icon(id, size) { return el('img', { src: R.iconURL(id, 64), class: 'icon', width: size || 40, height: size || 40, alt: '' }); }
  function btn(label, fn, cls) { return el('button', { class: 'btn ' + (cls || ''), text: label, onclick: function (e) { e.stopPropagation(); SS.audio.play('ui'); fn(); } }); }
  UI.btn = btn;

  var SVG = {
    food: '<svg viewBox="0 0 24 24"><path d="M7 3c-2 3-2 6 0 8l1 10h2l1-10c2-2 2-5 0-8l-1 5H9L8 3H7zm9 0c-2 0-3 3-3 6s1 4 2 4l-1 8h2l1-8c1 0 2-1 2-4s-1-6-3-6z" fill="currentColor"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-2 8 10-13h-6l1-7z" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffd34d"/><g stroke="#ffd34d" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z" fill="#e8e4ff"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    quest: '<svg viewBox="0 0 24 24"><path d="M6 3h10l3 3v15H6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9h7M9 13h7M9 17h4" stroke="currentColor" stroke-width="2"/></svg>',
    shirt: '<svg viewBox="0 0 24 24"><path d="M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3c-1 2-2 3-4 3S9 5 8 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    hand: '<svg viewBox="0 0 24 24"><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6V3.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v8c0 5-3 8-7 8-3 0-4-1-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13z" fill="currentColor"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M9.5 3h5a1 1 0 0 1 1 1v2h-7V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="currentColor"/><path d="M5.5 11h13" stroke="#5a3a22" stroke-width="1.6"/><rect x="8" y="14" width="8" height="5" rx="1.5" fill="#5a3a22"/><rect x="11" y="10" width="2" height="3" rx=".6" fill="#f2c14e"/></svg>',
    run: '<svg viewBox="0 0 24 24"><circle cx="14" cy="4" r="2" fill="currentColor"/><path d="M7 21l3-6 3 2v5M10 15l1-6 3 2 3 1M11 9l-4 2-1 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  UI.SVG = SVG;

  // ---------------- init ----------------
  UI.init = function () {
    var hud = $('hud');
    $('barHunger').querySelector('.ico').innerHTML = SVG.food;
    $('barEnergy').querySelector('.ico').innerHTML = SVG.bolt;
    $('bMap').innerHTML = SVG.map; $('bQuest').innerHTML = SVG.quest; $('bWard').innerHTML = SVG.shirt; $('bMenu').innerHTML = SVG.menu;
    $('btnAction').innerHTML = SVG.hand; $('btnRun').innerHTML = SVG.run;
    $('btnBag').insertAdjacentHTML('afterbegin', SVG.bag);
    $('btnBag').addEventListener('click', function (e) { e.stopPropagation(); if (SS.game.mode === 'play' && !SS.game.paused) UI.openBackpack(); });
    $('bMap').onclick = function () { UI.openMap(); };
    $('bQuest').onclick = function () { UI.openQuests(); };
    $('bWard').onclick = function () { UI.openWardrobe(); };
    $('bMenu').onclick = function () { UI.openPause(); };
    $('mini').onclick = function () { UI.openMap(); };
    $('modalWrap').addEventListener('click', function (e) { if (e.target.id === 'modalWrap' && UI.modalClosable) UI.closeModal(); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#hotbar') && !e.target.closest('#itemMenu')) UI.hideItemMenu();
      // after a click, HUD buttons give focus back so Enter/Space keep controlling the game
      var b = e.target.closest('#hud button, #touch button, #hud .slot');
      if (b && b.blur) b.blur();
    });
    SS.setupTouch($('app'));
    var cv = $('c'), ptr = SS.input.pointer;
    function pos(e) { var r = cv.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; }
    cv.addEventListener('pointerdown', function (e) {
      SS.audio.unlock();
      // on phones the left thumb drives the joystick; only golf uses raw touches on the canvas
      if (e.pointerType === 'touch' && SS.game.mode !== 'golf') return;
      pos(e); ptr.down = true; ptr.pressed = true;
    });
    window.addEventListener('pointermove', function (e) { pos(e); });
    window.addEventListener('pointerup', function (e) { if (ptr.down) { pos(e); ptr.released = true; } ptr.down = false; });
    window.addEventListener('pointercancel', function () { ptr.down = false; });
  };

  // ---------------- HUD ----------------
  // The HUD runs every frame, so it only touches the DOM when a value actually changes.
  var miniT = 0, last = {}, els = {};
  function node(id) { return els[id] || (els[id] = $(id)); }
  function setText(id, v) { if (last[id] !== v) { last[id] = v; node(id).textContent = v; } }
  UI.update = function (dt) {
    var G = SS.game;
    if (G.mode !== 'play') return;
    var P = G.player;
    setBar('barHunger', P.hunger);
    setBar('barEnergy', P.energy);
    setText('dayTxt', 'Day ' + G.day);
    setText('timeTxt', SS.fmtTime(G.time));
    var night = G.hour < 6 || G.hour >= 20;
    if (UI._night !== night) { node('clockIcon').innerHTML = night ? SVG.moon : SVG.sun; UI._night = night; }
    setText('moneyTxt', '$' + P.money);
    // chips
    var chips = [];
    if (P.hiddenIn) chips.push(['Hidden', 'good']);
    if (P.disguised()) chips.push([P.wanted > 0 ? 'Disguise blown ' + Math.ceil(P.wanted) + 's' : 'Disguised', P.wanted > 0 ? 'bad' : 'good']);
    if (G.ranger.state === 'chase') chips.push(['Ranger chasing!', 'bad']);
    if (P.carrying) chips.push(['Carrying cake', 'warn']);
    if (P.hunger <= 0) chips.push(['Starving', 'bad']);
    else if (P.hunger < 20) chips.push(['Hungry', 'warn']);
    if (P.energy <= 0) chips.push(['Exhausted!', 'bad']);
    else if (P.energy < 20) chips.push(['Sleepy', 'warn']);
    var key = chips.map(function (c) { return c.join(':'); }).join('|');
    if (key !== UI._chipKey) {
      UI._chipKey = key;
      var box = $('chips'); box.innerHTML = '';
      chips.forEach(function (c) { box.appendChild(el('span', { class: 'chip ' + c[1], text: c[0] })); });
    }
    // quest tracker
    var q = G.trackerText();
    if (q.key !== UI._qKey) { UI._qKey = q.key; $('questBox').querySelector('.qt').textContent = q.title; $('questBox').querySelector('.qd').textContent = q.desc; }
    // prompt
    var f = G.focus, ptxt = '';
    if (f && !G.fishing && !G.rummage) ptxt = f.label;
    if (G.rummage) ptxt = 'Rummaging...';
    if (ptxt !== UI._ptxt) {
      UI._ptxt = ptxt;
      var pr = $('prompt');
      if (ptxt) { pr.innerHTML = ''; pr.appendChild(el('kbd', { text: SS.input.isTouch ? 'Tap' : 'E' })); pr.appendChild(document.createTextNode(' ' + ptxt)); pr.hidden = false; }
      else pr.hidden = true;
    }
    var ready = !!ptxt || !!G.fishing;
    if (last.ready !== ready) { last.ready = ready; node('btnAction').classList.toggle('ready', ready); }
    miniT -= dt;
    if (miniT <= 0) { miniT = 0.15; drawMini(); }
    if (UI.lootC) updateLoot();
  };
  function setBar(id, v) {
    var w = Math.round(Math.max(0, Math.min(100, v)) * 2) / 2, low = v < 22;
    if (last[id] !== w) { last[id] = w; (els[id + 'F'] || (els[id + 'F'] = node(id).querySelector('.fill'))).style.width = w + '%'; }
    if (last[id + 'L'] !== low) { last[id + 'L'] = low; node(id).classList.toggle('low', low); }
  }
  function drawMini() {
    var G = SS.game, c = $('mini'), g = c.getContext('2d'), P = G.player;
    var s = R.miniScale, vw = c.width, vh = c.height, zoom = 2.2;
    g.save();
    g.fillStyle = '#2d4a24'; g.fillRect(0, 0, vw, vh);
    var cx = P.x * s * zoom - vw / 2, cy = P.y * s * zoom - vh / 2;
    g.drawImage(R.mini, -cx, -cy, R.mini.width * zoom, R.mini.height * zoom);
    function dot(x, y, col, r) { g.beginPath(); g.arc(x * s * zoom - cx, y * s * zoom - cy, r, 0, 6.3); g.fillStyle = col; g.fill(); }
    var tgt = G.questTarget();
    if (tgt) {
      var tx = tgt.x * s * zoom - cx, ty = tgt.y * s * zoom - cy;
      var inside = tx > 6 && ty > 6 && tx < vw - 6 && ty < vh - 6;
      if (!inside) { var a = Math.atan2(ty - vh / 2, tx - vw / 2); tx = vw / 2 + Math.cos(a) * (vw / 2 - 8); ty = vh / 2 + Math.sin(a) * (vh / 2 - 8); tx = SS.clamp(tx, 6, vw - 6); ty = SS.clamp(ty, 6, vh - 6); }
      g.beginPath(); g.arc(tx, ty, 5, 0, 6.3); g.fillStyle = '#ffd34d'; g.fill(); g.strokeStyle = '#3a2210'; g.lineWidth = 2; g.stroke();
    }
    if (G.ranger) dot(G.ranger.x, G.ranger.y, G.ranger.state === 'chase' ? '#ff4040' : '#e8d070', 3);
    G.humans.forEach(function (h) { if (h.present && !h.asleep) dot(h.x, h.y, '#ffffff', 2); });
    g.translate(vw / 2, vh / 2); g.rotate(P.dir + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 4); g.lineTo(-4.5, 4); g.closePath(); g.fillStyle = '#c0703a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    g.restore();
  }

  // ---------------- hotbar ----------------
  UI.refresh = function () {
    var G = SS.game, P = G.player, bar = $('hotbar');
    bar.innerHTML = '';
    for (var i = 0; i < P.slots; i++) {
      var s = P.inv[i];
      var slot = el('div', { class: 'slot' + (i === G.sel ? ' sel' : '') + (s ? '' : ' empty'), 'data-i': i, title: s ? SS.ITEMS[s.id].name : '' });
      if (i < 9) slot.appendChild(el('span', { class: 'num', text: String(i + 1) }));
      if (s) {
        slot.appendChild(icon(s.id, 38));
        if (s.n > 1) slot.appendChild(el('span', { class: 'cnt', text: String(s.n) }));
      }
      (function (idx) { slot.addEventListener('click', function (e) { e.stopPropagation(); UI.selectSlot(idx, true); }); })(i);
      bar.appendChild(slot);
    }
    if (UI.lootC) UI.renderLoot();
    var n = 0; P.inv.forEach(function (s) { n += s.n; });
    $('bagCount').textContent = n ? String(n) : '';
  };
  // Backpack panel (used on touch screens instead of the hotbar)
  UI.openBackpack = function () {
    var G = SS.game, P = G.player;
    var body = el('div', { class: 'pack' });
    function render() {
      body.innerHTML = '';
      var grid = el('div', { class: 'pack-grid' });
      for (var i = 0; i < P.slots; i++) {
        var s = P.inv[i];
        var slot = el('button', { class: 'slot' + (i === G.sel ? ' sel' : '') + (s ? '' : ' empty'), title: s ? SS.ITEMS[s.id].name : '' });
        if (s) { slot.appendChild(icon(s.id, 38)); if (s.n > 1) slot.appendChild(el('span', { class: 'cnt', text: String(s.n) })); }
        (function (idx) { slot.onclick = function () { G.sel = idx; render(); }; })(i);
        grid.appendChild(slot);
      }
      body.appendChild(grid);
      var s2 = P.inv[G.sel];
      var act = el('div', { class: 'pack-act' });
      if (s2) {
        var it = SS.ITEMS[s2.id];
        act.appendChild(icon(s2.id, 40));
        act.appendChild(el('div', { class: 'row-txt' }, [el('b', { text: it.name + (s2.n > 1 ? ' x' + s2.n : '') }), el('small', { text: it.food ? 'Hunger +' + it.food + (it.energy ? ', Energy +' + it.energy : '') : it.type === 'fish' ? 'Sells for $' + it.value : s2.id === 'can' ? 'Recycle for $1' : s2.id === 'stick' ? 'Beaver needs these' : '' })]));
        if (it.food) act.appendChild(btn(it.drink ? 'Drink' : 'Eat', function () { G.eat(G.sel); render(); }, 'small'));
        act.appendChild(btn('Drop', function () { var x = P.inv[G.sel]; if (!x) return; x.n--; if (x.n <= 0) P.inv.splice(G.sel, 1); UI.refresh(); render(); }, 'small ghost'));
      } else act.appendChild(el('span', { class: 'muted', text: P.inv.length ? 'Tap an item to eat or drop it.' : 'Your backpack is empty. Go find some snacks!' }));
      body.appendChild(act);
    }
    UI.openModal('Backpack (' + P.inv.length + '/' + P.slots + ')', body, { cls: 'pack-m' });
    render();
  };
  UI.selectSlot = function (i, menu) {
    var G = SS.game;
    G.sel = i; UI.refresh();
    var s = G.player.inv[i];
    if (menu && s) UI.showItemMenu(i); else UI.hideItemMenu();
  };
  UI.showItemMenu = function (i) {
    var G = SS.game, P = G.player, s = P.inv[i], m = $('itemMenu');
    if (!s) return;
    var it = SS.ITEMS[s.id];
    m.innerHTML = '';
    m.appendChild(el('div', { class: 'im-title', text: it.name + (s.n > 1 ? ' x' + s.n : '') }));
    var info = it.food ? 'Hunger +' + it.food + (it.energy ? '  Energy +' + it.energy : '') : it.type === 'fish' ? 'Sells for $' + it.value : it.id === 'can' ? 'Recycle for $1' : it.value ? 'Sells for $' + it.value : 'Quest item';
    if (s.id === 'stick') info = 'Beaver needs these';
    if (s.id === 'can') info = 'Recycle for $1 at the store';
    m.appendChild(el('div', { class: 'im-info', text: info }));
    var row = el('div', { class: 'im-row' });
    if (it.food) row.appendChild(btn(it.drink ? 'Drink' : 'Eat', function () { G.eat(i); UI.hideItemMenu(); }, 'small'));
    row.appendChild(btn('Drop', function () { P.inv[i].n--; if (P.inv[i].n <= 0) P.inv.splice(i, 1); UI.toast('Dropped ' + it.name + '.'); UI.refresh(); UI.hideItemMenu(); }, 'small ghost'));
    m.appendChild(row);
    var slot = $('hotbar').children[i];
    m.hidden = false;
    var r = slot.getBoundingClientRect(), ar = $('app').getBoundingClientRect();
    var left = r.left - ar.left + r.width / 2 - m.offsetWidth / 2;
    m.style.left = Math.max(8, Math.min(ar.width - m.offsetWidth - 8, left)) + 'px';
    m.style.top = (r.top - ar.top - m.offsetHeight - 10) + 'px';
  };
  UI.hideItemMenu = function () { $('itemMenu').hidden = true; };

  // ---------------- toasts ----------------
  UI.toast = function (text, iconId, time) {
    var box = $('toasts');
    var t = el('div', { class: 'toast' });
    if (iconId) t.appendChild(icon(iconId, 28));
    t.appendChild(el('span', { text: text }));
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('out'); }, (time || 2800));
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, (time || 2800) + 500);
  };

  // ---------------- modal ----------------
  UI.modalOpen = false;
  UI.openModal = function (title, body, opts) {
    opts = opts || {};
    var m = $('modal');
    m.innerHTML = '';
    m.className = 'panel modal ' + (opts.cls || '');
    var head = el('div', { class: 'm-head' }, [el('h2', { text: title })]);
    if (opts.closable !== false) head.appendChild(el('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: function () { UI.closeModal(); } }));
    m.appendChild(head);
    var bd = el('div', { class: 'm-body' });
    if (body) bd.appendChild(body);
    m.appendChild(bd);
    $('modalWrap').hidden = false;
    UI.modalOpen = true; UI.modalClosable = opts.closable !== false; UI.onClose = opts.onClose || null;
    SS.game.paused = true;
    UI.closeLoot();
    UI.hideItemMenu();
    return bd;
  };
  UI.closeModal = function () {
    if (!UI.modalOpen) return;
    $('modalWrap').hidden = true; UI.modalOpen = false;
    SS.game.paused = UI.dialogOpen;
    var cb = UI.onClose; UI.onClose = null;
    if (cb) cb();
  };

  // ---------------- dialogue ----------------
  UI.dialogOpen = false;
  var dlgAnim = null;
  UI.dialog = function (who, name, lines, done, choices) {
    var box = $('dialog');
    var idx = 0;
    UI.dialogOpen = true; SS.game.paused = true;
    UI.closeLoot(); UI.hideItemMenu();
    box.hidden = false;
    var pc = $('dlgPortrait'), pg = pc.getContext('2d');
    var t0 = performance.now();
    cancelAnimationFrame(dlgAnim);
    (function anim() {
      if (!UI.dialogOpen) return;
      pg.setTransform(pc.width / 96, 0, 0, pc.height / 96, 0, 0);
      if (who === 'narrator') { pg.fillStyle = '#e8dcb8'; pg.fillRect(0, 0, 96, 96); pg.save(); pg.translate(48, 104); pg.scale(1.9, 1.9); R.drawSasquatch(pg, 0, 0, { face: 'down', t: (performance.now() - t0) / 1000, hat: SS.game.player.outfit.hat, top: SS.game.player.outfit.top }); pg.restore(); }
      else R.drawPortrait(pg, who, (performance.now() - t0) / 1000);
      dlgAnim = requestAnimationFrame(anim);
    })();
    $('dlgName').textContent = name;
    var txt = $('dlgText'), btns = $('dlgBtns');
    var typing = null;
    function show() {
      var line = lines[idx];
      txt.textContent = '';
      var n = 0;
      clearInterval(typing);
      typing = setInterval(function () { n += 2; txt.textContent = line.slice(0, n); if (n >= line.length) { clearInterval(typing); typing = null; } }, 16);
      btns.innerHTML = '';
      var last = idx === lines.length - 1;
      if (last && choices && choices.length) {
        choices.forEach(function (c) { btns.appendChild(btn(c.label, function () { close(); if (c.fn) c.fn(); }, c.cls)); });
        if (!SS.input.isTouch) btns.firstChild.focus();
      } else {
        btns.appendChild(btn(last ? 'OK' : 'Next', next));
      }
    }
    function next() {
      if (typing) { clearInterval(typing); typing = null; txt.textContent = lines[idx]; return; }
      idx++;
      if (idx >= lines.length) { close(); if (done) done(); }
      else show();
    }
    function close() {
      clearInterval(typing);
      box.hidden = true; UI.dialogOpen = false; UI.dialogNext = null;
      SS.game.paused = UI.modalOpen;
    }
    UI.dialogNext = function () { if (idx === lines.length - 1 && choices && choices.length) { if (typing) next(); return; } next(); };
    show();
  };

  // ---------------- loot panel (does not pause) ----------------
  UI.openLoot = function (c) {
    UI.lootC = c;
    UI.renderLoot();
    $('loot').hidden = false;
  };
  UI.renderLoot = function () {
    var c = UI.lootC, box = $('loot');
    if (!c) return;
    box.innerHTML = '';
    var names = { basket: 'Picnic Basket', cooler: 'Cooler', trash: 'Trash Can' };
    var head = el('div', { class: 'loot-head' }, [el('b', { text: names[c.kind] }), el('button', { class: 'x', text: '×', 'aria-label': 'Close', onclick: function () { UI.closeLoot(); } })]);
    box.appendChild(head);
    var grid = el('div', { class: 'loot-grid' });
    if (!c.items.length) grid.appendChild(el('div', { class: 'empty-msg', text: c.kind === 'trash' ? 'Just smelly garbage.' : 'Empty! Come back tomorrow.' }));
    c.items.forEach(function (id, i) {
      var s = el('button', { class: 'slot loot-slot', title: SS.ITEMS[id].name, onclick: function (e) { e.stopPropagation(); SS.game.takeFromContainer(c, i); } }, [icon(id, 38)]);
      grid.appendChild(s);
    });
    box.appendChild(grid);
    if (c.items.length > 1) box.appendChild(btn('Take All', function () { SS.game.takeAll(c); }, 'small'));
    box.appendChild(el('div', { class: 'loot-tip', text: 'Grab fast. People who see you steal will call the Ranger!' }));
  };
  function updateLoot() {
    var c = UI.lootC, P = SS.game.player;
    if (Math.hypot(P.x - c.x, P.y - c.y) > 80) UI.closeLoot();
  }
  UI.closeLoot = function () { UI.lootC = null; $('loot').hidden = true; };

  // ---------------- shop ----------------
  UI.openShop = function (mode) {
    var G = SS.game, P = G.player;
    var vending = mode === 'vending';
    var tab = 'buy';
    var body = el('div');
    var bd = UI.openModal(vending ? 'Vending Machine' : 'General Store', body, { cls: 'shop' });
    function render() {
      body.innerHTML = '';
      var top = el('div', { class: 'shop-top' }, [el('span', { class: 'money', text: '$' + P.money }), el('span', { class: 'shop-greet', text: vending ? 'Machines don\'t ask questions.' : (G.hour >= 20 ? '"We close at 10, friend."' : '"Welcome! My, what a... hearty beard you have."') })]);
      body.appendChild(top);
      if (!vending) {
        var tabs = el('div', { class: 'tabs' });
        ['buy', 'sell'].forEach(function (t) { tabs.appendChild(el('button', { class: 'tab' + (tab === t ? ' on' : ''), text: t === 'buy' ? 'Buy' : 'Sell', onclick: function () { tab = t; render(); } })); });
        body.appendChild(tabs);
      }
      var list = el('div', { class: 'shop-list' });
      if (tab === 'buy') {
        var items = vending ? [{ item: 'soda', price: 3 }, { item: 'chips', price: 3 }, { item: 'coffee', price: 4 }] : SS.SHOP;
        var lastCat = null;
        items.forEach(function (e) {
          var owned = shopOwned(e, P);
          if (e.gear === 'prorod' && !P.gear.rod) return;
          if (e.cat && e.cat !== lastCat) { list.appendChild(el('div', { class: 'cat', text: e.cat })); lastCat = e.cat; }
          var name, ic, desc = '';
          if (e.item) { name = SS.ITEMS[e.item].name; ic = e.item; var it = SS.ITEMS[e.item]; desc = 'Hunger +' + it.food + (it.energy ? ', Energy +' + it.energy : ''); }
          else if (e.gear) { name = e.name; ic = e.gear === 'bait' ? 'bait' : e.gear; desc = e.desc + (e.gear === 'bait' && P.bait ? ' (have ' + P.bait + ')' : ''); }
          else if (e.hat) { name = SS.HATS[e.hat].name; ic = 'hat_' + e.hat; desc = 'Hat'; }
          else if (e.top) { name = SS.TOPS[e.top].name; ic = 'top_' + e.top; desc = 'Shirt'; }
          var b = owned ? el('span', { class: 'owned', text: 'Owned' }) : btn('$' + e.price, function () { G.buy(e); render(); }, 'small' + (P.money < e.price ? ' poor' : ''));
          list.appendChild(el('div', { class: 'row' }, [icon(ic, 40), el('div', { class: 'row-txt' }, [el('b', { text: name }), el('small', { text: desc })]), b]));
        });
      } else {
        var any = false;
        P.inv.forEach(function (s, i) {
          var it = SS.ITEMS[s.id];
          if (!it.value || s.id === 'can') return;
          any = true;
          var row = el('div', { class: 'row' }, [icon(s.id, 40), el('div', { class: 'row-txt' }, [el('b', { text: it.name + (s.n > 1 ? ' x' + s.n : '') }), el('small', { text: '$' + it.value + ' each' })])]);
          var bb = el('div', { class: 'row-btns' });
          bb.appendChild(btn('Sell 1', function () { G.sell(s.id, 1); render(); }, 'small'));
          if (s.n > 1) bb.appendChild(btn('All', function () { G.sell(s.id, s.n); render(); }, 'small ghost'));
          row.appendChild(bb);
          list.appendChild(row);
        });
        if (!any) list.appendChild(el('p', { class: 'muted', text: 'Nothing to sell. Fish, honey, mushrooms and berries sell well. Empty cans go in the recycling machine outside.' }));
      }
      body.appendChild(list);
    }
    render();
  };
  function shopOwned(e, P) {
    if (e.gear === 'rod') return P.gear.rod;
    if (e.gear === 'prorod') return P.gear.prorod;
    if (e.gear === 'flashlight') return P.gear.flashlight;
    if (e.gear === 'bigpack') return P.gear.bigpack;
    if (e.gear === 'kart') return P.gear.kart;
    if (e.hat) return P.ward.hats.indexOf(e.hat) >= 0;
    if (e.top) return P.ward.tops.indexOf(e.top) >= 0;
    return false;
  }

  // ---------------- cave ----------------
  UI.openHome = function () {
    var G = SS.game;
    var body = el('div', { class: 'home' });
    var tired = G.player.energy < 60 || G.hour >= 18 || G.hour < 7;
    body.appendChild(el('p', { class: 'muted', text: 'Cozy, a little damp, and all yours. It\'s ' + SS.fmtTime(G.time) + '.' }));
    var grid = el('div', { class: 'home-grid' });
    grid.appendChild(homeCard('Sleep', tired ? 'Sleep until morning and save the game.' : 'Not sleepy yet. Come back after 6 PM.', 'moon', function () { UI.closeModal(); G.sleep(); }));
    grid.appendChild(homeCard('Stash', 'Store food and fish safely. Stuff in the stash is never lost.', 'chest', function () { UI.openStash(); }));
    grid.appendChild(homeCard('Wardrobe', 'Change your disguise.', 'shirt', function () { UI.openWardrobe(); }));
    grid.appendChild(homeCard('Save Game', 'Save without sleeping.', 'save', function () { UI.toast(G.save() ? 'Game saved.' : 'Could not save in this browser.'); }));
    body.appendChild(grid);
    UI.openModal('Your Cave', body, { cls: 'home-m' });
  };
  function homeCard(title, desc, ic, fn) {
    var ico = el('span', { class: 'hc-ico', html: ic === 'moon' ? SVG.moon : ic === 'shirt' ? SVG.shirt : ic === 'save' ? SVG.quest : '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2" fill="#a7773f"/><rect x="3" y="5" width="18" height="5" rx="2" fill="#8a5c33"/><rect x="10" y="9" width="4" height="4" fill="#f2c14e"/></svg>' });
    return el('button', { class: 'home-card', onclick: function () { SS.audio.play('ui'); fn(); } }, [ico, el('b', { text: title }), el('small', { text: desc })]);
  }
  UI.openStash = function () {
    var G = SS.game, P = G.player;
    var body = el('div', { class: 'stash' });
    function render() {
      body.innerHTML = '';
      body.appendChild(el('p', { class: 'muted', text: 'Click an item to move it between your backpack and the stash.' }));
      var cols = el('div', { class: 'stash-cols' });
      function grid(title, list, cap, fn) {
        var g = el('div', { class: 'stash-grid' });
        for (var i = 0; i < cap; i++) {
          var s = list[i];
          var sl = el('button', { class: 'slot' + (s ? '' : ' empty'), title: s ? SS.ITEMS[s.id].name : '' });
          if (s) { sl.appendChild(icon(s.id, 36)); if (s.n > 1) sl.appendChild(el('span', { class: 'cnt', text: String(s.n) })); (function (idx) { sl.onclick = function () { fn(idx); render(); UI.refresh(); }; })(i); }
          g.appendChild(sl);
        }
        return el('div', { class: 'stash-col' }, [el('h3', { text: title + ' (' + list.length + '/' + cap + ')' }), g]);
      }
      cols.appendChild(grid('Backpack', P.inv, P.slots, function (i) {
        var s = P.inv[i];
        var moved = addTo(G.stash, 30, s.id, s.n);
        s.n -= moved; if (s.n <= 0) P.inv.splice(i, 1);
        if (!moved) UI.toast('Stash is full.');
      }));
      cols.appendChild(grid('Stash', G.stash, 30, function (i) {
        var s = G.stash[i];
        var moved = P.add(s.id, s.n);
        s.n -= moved; if (s.n <= 0) G.stash.splice(i, 1);
        if (!moved) UI.toast('Backpack is full.');
      }));
      body.appendChild(cols);
      body.appendChild(btn('Back', function () { UI.openHome(); }, 'ghost'));
    }
    UI.openModal('Cave Stash', body, { cls: 'stash-m' });
    render();
  };
  function addTo(list, cap, id, n) {
    var added = 0;
    list.forEach(function (s) { if (s.id === id && s.n < SS.STACK && n > 0) { var k = Math.min(n, SS.STACK - s.n); s.n += k; n -= k; added += k; } });
    while (n > 0 && list.length < cap) { var k2 = Math.min(n, SS.STACK); list.push({ id: id, n: k2 }); n -= k2; added += k2; }
    return added;
  }

  // ---------------- wardrobe ----------------
  UI.openWardrobe = function () {
    var G = SS.game, P = G.player;
    if (G.ranger.state === 'chase') { UI.toast('No time to change, the Ranger is after you!'); return; }
    var body = el('div', { class: 'ward' });
    var pv = el('canvas', { width: 240, height: 280, class: 'ward-prev' });
    var anim;
    function draw() {
      var g = pv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 240, 280);
      var gr = g.createRadialGradient(120, 230, 10, 120, 230, 120); gr.addColorStop(0, '#d4c49a'); gr.addColorStop(1, 'rgba(212,196,154,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 240, 280);
      g.translate(120, 250); g.scale(3.4, 3.4);
      R.drawSasquatch(g, 0, 0, { face: 'down', t: performance.now() / 1000, hat: P.outfit.hat, top: P.outfit.top });
      if (UI.modalOpen && pv.isConnected) anim = requestAnimationFrame(draw);
    }
    function render() {
      body.innerHTML = '';
      var side = el('div', { class: 'ward-side' });
      side.appendChild(pv);
      side.appendChild(el('div', { class: 'ward-status ' + (P.disguised() ? 'ok' : 'no'), text: P.disguised() ? 'Disguised! Humans think you\'re a camper.' : 'Not disguised. Wear a hat AND a shirt.' }));
      body.appendChild(side);
      var opts = el('div', { class: 'ward-opts' });
      opts.appendChild(el('h3', { text: 'Hats' }));
      var hg = el('div', { class: 'ward-grid' });
      Object.keys(SS.HATS).forEach(function (id) {
        var have = P.ward.hats.indexOf(id) >= 0;
        hg.appendChild(el('button', { class: 'ward-item' + (P.outfit.hat === id ? ' on' : '') + (have ? '' : ' locked'), title: have ? SS.HATS[id].name : '???', onclick: function () { if (!have) return; P.outfit.hat = id; SS.audio.play('ui'); render(); } }, [have ? icon('hat_' + id, 44) : el('span', { class: 'q', text: '?' }), el('small', { text: have ? SS.HATS[id].name : 'Locked' })]));
      });
      opts.appendChild(hg);
      opts.appendChild(el('h3', { text: 'Shirts' }));
      var tg = el('div', { class: 'ward-grid' });
      Object.keys(SS.TOPS).forEach(function (id) {
        var have = P.ward.tops.indexOf(id) >= 0;
        tg.appendChild(el('button', { class: 'ward-item' + (P.outfit.top === id ? ' on' : '') + (have ? '' : ' locked'), title: have ? SS.TOPS[id].name : '???', onclick: function () { if (!have) return; P.outfit.top = id; SS.audio.play('ui'); render(); } }, [have ? icon('top_' + id, 44) : el('span', { class: 'q', text: '?' }), el('small', { text: have ? SS.TOPS[id].name : 'Locked' })]));
      });
      opts.appendChild(tg);
      body.appendChild(opts);
    }
    var before = P.outfit.hat + '/' + P.outfit.top;
    UI.openModal('Wardrobe', body, { cls: 'ward-m', onClose: function () {
      cancelAnimationFrame(anim);
      if (P.wanted > 0 && P.outfit.hat + '/' + P.outfit.top !== before && !G.anyoneSees()) { P.wanted = 0; UI.toast('New look! Nobody recognizes you now.'); }
    } });
    render();
    draw();
  };

  // ---------------- map ----------------
  UI.openMap = function () {
    var G = SS.game, P = G.player;
    var cv = el('canvas', { class: 'bigmap' });
    var body = el('div', { class: 'map-wrap' }, [cv]);
    UI.openModal('Map', body, { cls: 'map-m' });
    var avail = Math.min(body.clientWidth || 600, 900);
    var s = avail / W.w;
    cv.width = Math.round(W.w * s * 2); cv.height = Math.round(W.h * s * 2);
    cv.style.width = Math.round(W.w * s) + 'px'; cv.style.height = Math.round(W.h * s) + 'px';
    var g = cv.getContext('2d');
    g.scale(2, 2);
    g.drawImage(R.mini, 0, 0, W.w * s, W.h * s);
    g.font = '700 ' + Math.max(10, 13 * s / 0.2) + 'px Nunito, sans-serif';
    g.textAlign = 'center';
    W.landmarks.forEach(function (l) {
      var x = l.x * s, y = l.y * s;
      g.lineWidth = 3; g.strokeStyle = 'rgba(40,25,10,0.85)'; g.fillStyle = '#fff6dc';
      g.strokeText(l.name, x, y); g.fillText(l.name, x, y);
    });
    if (!W.bridgeFixed) { g.fillStyle = '#e04040'; g.font = '700 11px Nunito, sans-serif'; g.fillText('Bridge out!', W.bridge.x0 * s + 40, (W.bridge.y0 + 70) * s); }
    var tgt = G.questTarget();
    if (tgt) { g.beginPath(); g.arc(tgt.x * s, tgt.y * s, 7, 0, 6.3); g.fillStyle = '#ffd34d'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#3a2210'; g.stroke(); }
    g.save(); g.translate(P.x * s, P.y * s); g.rotate(P.dir + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 6); g.lineTo(-7, 6); g.closePath(); g.fillStyle = '#c0703a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    g.restore();
    body.appendChild(el('p', { class: 'muted map-legend', html: '<span class="lg you"></span> You &nbsp; <span class="lg goal"></span> Current goal' }));
  };

  // ---------------- quests ----------------
  UI.openQuests = function () {
    var G = SS.game;
    var body = el('div', { class: 'quests' });
    var active = [], done = [], avail = [];
    SS.QUESTS.forEach(function (q) {
      var s = G.quests[q.id];
      if (s === 'active') active.push(q); else if (s === 'done') done.push(q); else if (s === 'available') avail.push(q);
    });
    var giverName = { raccoon: 'Raccoon (by your cave)', bear: 'Bear (west, by the river)', beaver: 'Beaver (by the broken bridge)', golf: 'the Golf Clubhouse' };
    if (active.length) { body.appendChild(el('h3', { text: 'In progress' })); active.forEach(function (q) { body.appendChild(el('div', { class: 'qcard' }, [el('b', { text: q.title }), el('p', { text: q.desc })])); }); }
    if (avail.length) { body.appendChild(el('h3', { text: 'New' })); avail.forEach(function (q) { body.appendChild(el('div', { class: 'qcard new' }, [el('b', { text: q.title }), el('p', { text: 'Talk to ' + giverName[q.giver] + '.' })])); }); }
    if (done.length) { body.appendChild(el('h3', { text: 'Completed' })); done.forEach(function (q) { body.appendChild(el('div', { class: 'qcard done' }, [el('b', { text: '✓ ' + q.title })])); }); }
    var locked = SS.QUESTS.length - active.length - done.length - avail.length;
    if (locked > 0) body.appendChild(el('p', { class: 'muted', text: locked + ' more quest' + (locked > 1 ? 's' : '') + ' to discover.' }));
    var st = G.stats;
    body.appendChild(el('p', { class: 'muted stats-line', text: 'Snacks stolen: ' + st.stolen + ' · Fish caught: ' + st.fish + ' · Times caught: ' + st.caught + ' · Day ' + G.day }));
    UI.openModal('Quests', body, { cls: 'quests-m' });
  };

  // ---------------- pause / help ----------------
  UI.openPause = function () {
    var G = SS.game;
    var body = el('div', { class: 'pause' });
    body.appendChild(btn('Resume', function () { UI.closeModal(); }));
    body.appendChild(btn('How to Play', function () { UI.openHelp(true); }, 'ghost'));
    body.appendChild(btn('Sound effects: ' + (SS.audio.sfxOn ? 'On' : 'Off'), function () { SS.audio.setSfx(!SS.audio.sfxOn); G.saveSettings(); UI.openPause(); }, 'ghost'));
    body.appendChild(btn('Music: ' + (SS.audio.musicOn ? 'On' : 'Off'), function () { SS.audio.setMusicOn(!SS.audio.musicOn); G.saveSettings(); UI.openPause(); }, 'ghost'));
    body.appendChild(btn('Save Game', function () { UI.toast(G.save() ? 'Game saved.' : 'Could not save in this browser.'); }, 'ghost'));
    body.appendChild(btn('Quit to Title', function () { G.save(); UI.closeModal(); G.toTitle(); }, 'ghost'));
    body.appendChild(el('p', { class: 'muted', text: 'Your game also saves every time you sleep in your cave.' }));
    UI.openModal('Paused', body, { cls: 'pause-m' });
  };
  UI.openHelp = function (fromPause) {
    var body = el('div', { class: 'help' });
    body.innerHTML =
      '<div class="help-grid">' +
      '<div><h3>Controls</h3><ul class="keys">' +
      '<li><kbd>WASD</kbd>/<kbd>Arrows</kbd> Move</li><li><kbd>Shift</kbd> Run (uses energy)</li><li><kbd>E</kbd>/<kbd>Space</kbd> Interact, grab, talk, fish</li>' +
      '<li><kbd>1-9</kbd> Select item, <kbd>F</kbd> eat it</li><li><kbd>C</kbd> Wardrobe</li><li><kbd>M</kbd> Map, <kbd>J</kbd> Quests</li><li><kbd>Esc</kbd> Menu</li></ul>' +
      '<p class="muted">On a phone: drag the left side of the screen to move, hold the runner button to run, and tap the hand button to interact.</p></div>' +
      '<div><h3>How to be a sneaky sasquatch</h3><ul>' +
      '<li>Steal food from picnic baskets, coolers and trash cans when no one is looking.</li>' +
      '<li>A <b>?</b> over a human means they\'re getting suspicious. Get out of sight before they scream.</li>' +
      '<li>Hide in bushes. Nobody can see you in there.</li>' +
      '<li>If the Ranger catches you, you\'re dragged home and lose everything in your backpack. Store valuables in your cave stash.</li>' +
      '<li>Wear a hat <i>and</i> a shirt to blend in, shop in town, and play golf. Just don\'t steal in front of people.</li>' +
      '<li>Keep your hunger and energy up. Eat snacks, and sleep in your cave at night.</li>' +
      '<li>Campers sleep at night. The Ranger patrols with a flashlight, but even rangers need naps.</li>' +
      '</ul></div></div>';
    UI.openModal('How to Play', body, { cls: 'help-m', onClose: fromPause ? function () { setTimeout(UI.openPause, 0); } : null });
  };

  // ---------------- golf ----------------
  UI.showGolf = function (on) {
    $('hud').hidden = on;
    document.body.classList.toggle('golfing', on);
  };

  // ---------------- title & transitions ----------------
  UI.showTitle = function (hasSave) {
    var t = $('title');
    t.hidden = false; $('hud').hidden = true;
    var b = $('titleBtns'); b.innerHTML = '';
    if (hasSave) b.appendChild(btn('Continue', function () { SS.audio.unlock(); SS.game.continueGame(); }, 'big'));
    b.appendChild(btn(hasSave ? 'New Game' : 'Play', function () {
      SS.audio.unlock();
      if (hasSave) { UI.confirmNew(); return; }
      SS.game.newGame();
    }, hasSave ? 'big ghost' : 'big'));
    b.appendChild(btn('How to Play', function () { UI.openHelp(false); }, 'ghost'));
  };
  UI.confirmNew = function () {
    var body = el('div', { class: 'pause' });
    body.appendChild(el('p', { text: 'Start over? Your saved game will be replaced the next time you save.' }));
    body.appendChild(btn('Start a new game', function () { UI.closeModal(); SS.game.newGame(); }));
    body.appendChild(btn('Cancel', function () { UI.closeModal(); }, 'ghost'));
    UI.openModal('New Game', body, { cls: 'pause-m' });
  };
  UI.hideTitle = function () { $('title').hidden = true; $('hud').hidden = false; };
  UI.fade = function (mid, after) {
    var f = $('fade');
    f.classList.add('on');
    SS.game.paused = true;
    setTimeout(function () {
      if (mid) mid();
      setTimeout(function () { f.classList.remove('on'); SS.game.paused = UI.modalOpen || UI.dialogOpen; if (after) after(); }, 350);
    }, 600);
  };

  UI.ending = function () {
    var G = SS.game, st = G.stats;
    var body = el('div', { class: 'ending' });
    var cv = el('canvas', { width: 640, height: 400, class: 'end-art' });
    body.appendChild(cv);
    body.appendChild(el('p', { class: 'big-txt', text: 'The Great Cake Heist is complete! Raccoon, Bear, Beaver and every critter in the forest shared the most delicious cake in the history of Whispering Pines.' }));
    body.appendChild(el('p', { class: 'muted', text: 'Finished on day ' + G.day + ' · ' + st.stolen + ' snacks stolen · ' + st.fish + ' fish caught · caught by the Ranger ' + st.caught + ' time' + (st.caught === 1 ? '' : 's') + '.' }));
    body.appendChild(el('p', { text: 'The forest is still yours. Keep exploring, catch the Golden Fish, and collect every outfit.' }));
    body.appendChild(btn('Keep Playing', function () { UI.closeModal(); }, 'big'));
    UI.openModal('The End?', body, { cls: 'end-m' });
    var g = cv.getContext('2d'), t0 = performance.now();
    (function anim() {
      if (!cv.isConnected) return;
      var t = (performance.now() - t0) / 1000;
      g.setTransform(2, 0, 0, 2, 0, 0);
      g.fillStyle = '#2d4a24'; g.fillRect(0, 0, 320, 200);
      g.fillStyle = '#3d6a30'; g.fillRect(0, 140, 320, 60);
      g.save(); g.translate(52, 172); g.scale(1.15, 1.15); R.drawBear(g, 0, 0, t); g.restore();
      R.drawPartyTable(g, 165, 168, true, t);
      R.drawSasquatch(g, 112, 182, { face: 'right', t: t, moving: false, hat: G.player.outfit.hat, top: G.player.outfit.top, scale: 1.3 });
      R.drawRaccoon(g, 215, 180, t); R.drawBeaver(g, 255, 184, t);
      for (var i = 0; i < 40; i++) {
        var x = (i * 47 + t * 30 * (1 + i % 3)) % 320, y = (i * 23 + t * 60 * (1 + i % 2)) % 200;
        g.fillStyle = ['#e85d75', '#3fa7d6', '#f2c14e', '#7bc950'][i % 4]; g.fillRect(x, y, 4, 7);
      }
      requestAnimationFrame(anim);
    })();
  };
})();
