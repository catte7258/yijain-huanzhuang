/* 一键换装 — vanilla H5/PWA fitting-room client for RuiC-PoseAtlas data. */
(function () {
  'use strict';

  var CDN = 'https://hruiccc.github.io/RuiC-PoseAtlas/';
  var FACE_REMOTE = 'https://ai-portrait-gallery.pages.dev/img/thumb/';
  var OFFICIAL = 'https://hruiccc.github.io/RuiC-PoseAtlas/';
  var STORE_KEY = 'yijian-huanzhuang-v1';
  var PAGE = 60;
  var DAILY_CATS = ['spring', 'summer', 'autumn', 'winter', 'party'];
  var ADULT_CATS = ['lingerie', 'sexy', 'swimwear'];
  var CAT_ORDER = ['spring', 'summer', 'autumn', 'winter', 'party', 'lingerie', 'swimwear', 'sexy'];
  var COLOR_ORDER = [
    'black', 'white', 'ivory', 'cream', 'beige', 'brown', 'grey',
    'red', 'burgundy', 'pink', 'lavender', 'purple',
    'blue', 'navy', 'mint', 'green', 'olive', 'khaki',
    'yellow', 'orange', 'gold', 'silver'
  ];
  var COLOR_HEX = {
    black: '#1a1a1a', white: '#f5f5f5', ivory: '#F3EDE0', cream: '#F3E1C2',
    beige: '#D8C3A5', brown: '#6B3E26', grey: '#8a8a8a', red: '#c1392b',
    burgundy: '#722F37', pink: '#E8A0BF', lavender: '#B9A7D0', purple: '#6B3FA0',
    blue: '#3D6FBF', navy: '#1B2A4A', mint: '#98D7C2', green: '#3E7C4F',
    olive: '#6B6B2F', khaki: '#C3B091', yellow: '#E6C84F', orange: '#E07A3D',
    gold: '#C9A84C', silver: '#C0C0C0'
  };
  var SERIES_ORDER = ['full_std', 'upper', 'full_sexy', 'duo'];
  var ANGLE_ORDER = ['front', 'diagonal', 'side', 'high', 'low'];
  var HAIR_ORDER = ['short', 'medium', 'semilong', 'long'];
  var DEFAULTS = {
    outfitId: 'SPR-0025',
    poseId: 'full_single_P018',
    angle: 'diagonal',
    faceId: 'f71f980dde3',
    tab: 'dress',
    showAll: false,
    cat: '',
    color: '',
    query: '',
    poseSeries: 'full_std',
    hair: 'short',
    faceQuery: ''
  };

  var COSTUMES = window.ATLAS_COSTUMES || [];
  var POSES = window.ATLAS_POSES || [];
  var FACES = window.ATLAS_FACES || [];
  var LABELS = window.ATLAS_LABELS || { cats: {}, groups: {}, colors: {}, tags: {}, series: {}, angles: {}, hairs: {} };

  var costumeById = indexBy(COSTUMES, 'id');
  var poseById = indexBy(POSES, 'id');
  var faceById = indexBy(FACES, 'id');
  var haystackCache = {};

  var state = loadState();
  var outfitLimit = PAGE;
  var faceLimit = PAGE;
  var stageFront = 'a';
  var stageToken = 0;
  var toastTimer = 0;
  var saveTimer = 0;
  var observers = [];

  function indexBy(list, key) {
    var map = Object.create(null);
    for (var i = 0; i < list.length; i++) map[list[i][key]] = list[i];
    return map;
  }

  function $(id) { return document.getElementById(id); }

  function cdn(path) {
    if (!path) return '';
    if (/^https?:/i.test(path)) return path;
    return CDN + path.replace(/^\//, '');
  }

  function poseThumbPath(pose, angle) {
    var a = angle && pose.angles.indexOf(angle) !== -1 ? angle : preferredAngle(pose);
    var file = a === 'diagonal' ? 'diag' : a;
    return 'thumbs/' + pose.id + '_' + file + '.jpg';
  }

  function preferredAngle(pose) {
    if (pose.angles.indexOf('diagonal') !== -1) return 'diagonal';
    if (pose.angles.indexOf('front') !== -1) return 'front';
    return pose.angles[0];
  }

  function labelOf(dict, key, fallback) {
    if (!key) return fallback || '';
    return (dict && dict[key]) || LABELS.tags[key] || fallback || key;
  }

  function catName(k) { return labelOf(LABELS.cats, k, k); }
  function colorName(k) { return labelOf(LABELS.colors, k, k); }
  function groupName(k) { return labelOf(LABELS.groups, k, k); }
  function tagName(k) { return labelOf(LABELS.tags, k, k); }
  function hairName(k) { return labelOf(LABELS.hairs, k, k); }
  function angleName(k) { return labelOf(LABELS.angles, k, k); }
  function seriesName(k) {
    var s = LABELS.series && LABELS.series[k];
    return (s && (s.short || s.zh)) || k;
  }

  function haystack(c) {
    var hit = haystackCache[c.id];
    if (hit) return hit;
    var parts = [c.id, c.cat, c.group, c.color, c.main].concat(c.tags || []);
    var zh = parts.map(function (t) {
      return LABELS.tags[t] || LABELS.cats[t] || LABELS.groups[t] || LABELS.colors[t] || '';
    });
    hit = (parts.join(' ') + ' ' + zh.join(' ')).toLowerCase();
    haystackCache[c.id] = hit;
    return hit;
  }

  function loadState() {
    var s = Object.assign({}, DEFAULTS, { favorites: [] });
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return s;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        if (typeof saved.outfitId === 'string') s.outfitId = saved.outfitId;
        if (typeof saved.poseId === 'string') s.poseId = saved.poseId;
        if (typeof saved.angle === 'string') s.angle = saved.angle;
        if (typeof saved.faceId === 'string') s.faceId = saved.faceId;
        if (typeof saved.showAll === 'boolean') s.showAll = saved.showAll;
        if (typeof saved.cat === 'string') s.cat = saved.cat;
        if (typeof saved.color === 'string') s.color = saved.color;
        if (typeof saved.query === 'string') s.query = saved.query;
        if (typeof saved.poseSeries === 'string') s.poseSeries = saved.poseSeries;
        if (typeof saved.hair === 'string') s.hair = saved.hair;
        if (Array.isArray(saved.favorites)) s.favorites = saved.favorites.filter(Boolean);
      }
    } catch (e) { /* private mode / blocked storage */ }
    if (!costumeById[s.outfitId]) s.outfitId = DEFAULTS.outfitId;
    if (!poseById[s.poseId]) s.poseId = DEFAULTS.poseId;
    if (!faceById[s.faceId]) s.faceId = DEFAULTS.faceId;
    var pose = poseById[s.poseId];
    if (pose && pose.angles.indexOf(s.angle) === -1) s.angle = preferredAngle(pose);
    if (s.cat && CAT_ORDER.indexOf(s.cat) === -1) s.cat = '';
    if (s.cat && ADULT_CATS.indexOf(s.cat) !== -1 && !s.showAll) s.showAll = true;
    return s;
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          outfitId: state.outfitId,
          poseId: state.poseId,
          angle: state.angle,
          faceId: state.faceId,
          showAll: state.showAll,
          cat: state.cat,
          color: state.color,
          query: state.query,
          poseSeries: state.poseSeries,
          hair: state.hair,
          favorites: state.favorites
        }));
      } catch (e) { /* quota */ }
    }, 120);
  }

  function currentOutfit() { return costumeById[state.outfitId] || COSTUMES[0]; }
  function currentPose() { return poseById[state.poseId] || POSES[0]; }
  function currentFace() { return faceById[state.faceId] || FACES[0]; }

  function isFav(id) { return state.favorites.indexOf(id) !== -1; }

  function filteredOutfits() {
    var q = (state.query || '').trim().toLowerCase();
    var out = [];
    for (var i = 0; i < COSTUMES.length; i++) {
      var c = COSTUMES[i];
      if (!state.showAll && DAILY_CATS.indexOf(c.cat) === -1) continue;
      if (state.cat && c.cat !== state.cat) continue;
      if (state.color && c.color !== state.color) continue;
      if (q && haystack(c).indexOf(q) === -1) continue;
      out.push(c);
    }
    return out;
  }

  function filteredPoses() {
    var out = [];
    for (var i = 0; i < POSES.length; i++) {
      var p = POSES[i];
      if (state.poseSeries && p.series !== state.poseSeries) continue;
      out.push(p);
    }
    return out;
  }

  function filteredFaces() {
    var q = (state.faceQuery || '').trim().toLowerCase();
    var out = [];
    for (var i = 0; i < FACES.length; i++) {
      var f = FACES[i];
      if (state.hair && f.hair !== state.hair) continue;
      if (q && f.id.toLowerCase().indexOf(q) === -1) continue;
      out.push(f);
    }
    return out;
  }

  function officialLinks() {
    var pose = currentPose();
    var angle = state.angle && pose.angles.indexOf(state.angle) !== -1 ? state.angle : preferredAngle(pose);
    return {
      pose: OFFICIAL + '#pose=' + encodeURIComponent(pose.id) + '&angle=' + encodeURIComponent(angle),
      costume: OFFICIAL + 'costume.html#costume=' + encodeURIComponent(state.outfitId),
      face: OFFICIAL + 'face.html#portrait=' + encodeURIComponent(state.faceId)
    };
  }

  /* ---------- rendering ---------- */

  function renderAll() {
    renderStage();
    renderMeta();
    renderCombo();
    renderCatChips();
    renderColorChips();
    renderOutfitGrid(true);
    renderSeriesChips();
    renderAngleChips();
    renderPoseGrid();
    renderHairChips();
    renderFaceGrid(true);
    renderFavGrid();
    updateFavButton();
    updateShowAll();
    var search = $('search-outfit');
    if (search && search.value !== state.query) search.value = state.query;
  }

  function setStageImage(url, alt) {
    var token = ++stageToken;
    var nextId = stageFront === 'a' ? 'stage-b' : 'stage-a';
    var currId = stageFront === 'a' ? 'stage-a' : 'stage-b';
    var next = $(nextId);
    var curr = $(currId);
    var fallback = $('stage-fallback');
    fallback.hidden = true;

    function show() {
      if (token !== stageToken) return;
      next.alt = alt || '';
      next.classList.add('is-show');
      curr.classList.remove('is-show');
      stageFront = nextId === 'stage-a' ? 'a' : 'b';
    }

    function fail() {
      if (token !== stageToken) return;
      fallback.hidden = false;
      next.classList.remove('is-show');
    }

    if (!url) { fail(); return; }

    function use(src) {
      next.onerror = fail;
      next.onload = show;
      next.src = src;
      if (next.complete && next.naturalWidth) show();
    }

    var probe = new Image();
    probe.onload = function () {
      if (token !== stageToken) return;
      use(url);
    };
    probe.onerror = function () {
      if (token !== stageToken) return;
      var c = currentOutfit();
      var fallbackUrl = c && c.thumb ? cdn(c.thumb) : '';
      if (fallbackUrl && fallbackUrl !== url) use(fallbackUrl);
      else fail();
    };
    probe.src = url;
    if (probe.complete && probe.naturalWidth) use(url);
  }

  function preloadNeighbors(list) {
    if (!list || !list.length) return;
    var idx = indexIn(list, state.outfitId);
    var ids = [];
    if (idx >= 0) {
      ids.push(list[(idx + 1) % list.length].image);
      ids.push(list[(idx - 1 + list.length) % list.length].image);
    }
    ids.forEach(function (path) {
      if (!path) return;
      var img = new Image();
      img.decoding = 'async';
      img.src = cdn(path);
    });
  }

  function indexIn(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return -1;
  }

  function renderStage() {
    var c = currentOutfit();
    if (!c) return;
    setStageImage(cdn(c.image), c.id + ' ' + (tagName(c.main) || groupName(c.group) || ''));
    preloadNeighbors(filteredOutfits());

    var pose = currentPose();
    var face = currentFace();
    var poseImg = $('chip-pose-img');
    var faceImg = $('chip-face-img');
    poseImg.alt = pose.name;
    poseImg.src = cdn(poseThumbPath(pose, state.angle));
    bindImgFallback(poseImg);
    $('chip-pose-name').textContent = pose.name;
    faceImg.alt = hairName(face.hair);
    faceImg.src = cdn(face.thumb);
    bindImgFallback(faceImg, FACE_REMOTE + face.id + '.webp');
    $('chip-face-name').textContent = hairName(face.hair);
  }

  function renderMeta() {
    var c = currentOutfit();
    if (!c) return;
    $('meta-id').textContent = c.id;
    $('meta-cat').textContent = catName(c.cat);
    $('meta-color').textContent = c.color ? colorName(c.color) : '未标注色';
    $('meta-group').textContent = groupName(c.group);
    var box = $('meta-tags');
    box.textContent = '';
    (c.tags || []).forEach(function (t) {
      var span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tagName(t);
      box.appendChild(span);
    });
  }

  function renderCombo() {
    var links = officialLinks();
    var pose = currentPose();
    var face = currentFace();
    var rows = [
      { key: 'pose', label: '姿势', text: pose.id + ' · ' + angleName(state.angle), href: links.pose },
      { key: 'costume', label: '衣装', text: state.outfitId, href: links.costume },
      { key: 'face', label: '脸型', text: face.id, href: links.face }
    ];
    var box = $('combo-links');
    box.textContent = '';
    rows.forEach(function (row) {
      var div = document.createElement('div');
      div.className = 'combo-item';
      var a = document.createElement('a');
      a.href = row.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = row.label + '  ' + row.text;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '复制';
      btn.addEventListener('click', function () { copyText(row.href, '已复制' + row.label + '链接'); });
      div.appendChild(a);
      div.appendChild(btn);
      box.appendChild(div);
    });
  }

  function visibleCats() {
    return CAT_ORDER.filter(function (k) {
      return state.showAll || DAILY_CATS.indexOf(k) !== -1;
    });
  }

  function renderCatChips() {
    var box = $('cat-chips');
    box.textContent = '';
    var all = chipButton(!state.cat, '全部', function () {
      state.cat = '';
      onFilterChange();
    });
    box.appendChild(all);
    visibleCats().forEach(function (k) {
      box.appendChild(chipButton(state.cat === k, catName(k), function () {
        state.cat = state.cat === k ? '' : k;
        onFilterChange();
      }));
    });
  }

  function renderColorChips() {
    var box = $('color-chips');
    box.textContent = '';
    var all = chipButton(!state.color, '全部色系', function () {
      state.color = '';
      onFilterChange();
    });
    box.appendChild(all);
    COLOR_ORDER.forEach(function (k) {
      var btn = chipButton(state.color === k, colorName(k), function () {
        state.color = state.color === k ? '' : k;
        onFilterChange();
      });
      var sw = document.createElement('span');
      sw.className = 'swatch' + (k === 'white' || k === 'ivory' || k === 'cream' ? ' is-white' : '');
      sw.style.background = COLOR_HEX[k] || '#888';
      btn.insertBefore(sw, btn.firstChild);
      box.appendChild(btn);
    });
  }

  function chipButton(on, text, handler) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (on ? ' is-on' : '');
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  }

  function onFilterChange() {
    outfitLimit = PAGE;
    persist();
    renderCatChips();
    renderColorChips();
    renderOutfitGrid(true);
    updateShowAll();
    preloadNeighbors(filteredOutfits());
  }

  function updateShowAll() {
    var btn = $('btn-show-all');
    btn.setAttribute('aria-pressed', state.showAll ? 'true' : 'false');
    btn.textContent = state.showAll ? '显示全部 · 已开' : '显示全部';
  }

  function renderOutfitGrid(reset) {
    var list = filteredOutfits();
    var grid = $('outfit-grid');
    var empty = $('outfit-empty');
    var sentinel = $('outfit-sentinel');
    $('outfit-count').textContent = list.length ? ('共 ' + list.length + ' 套') : '没有匹配';
    empty.hidden = list.length > 0;
    if (reset) grid.textContent = '';
    var start = reset ? 0 : grid.childElementCount;
    // skip heart buttons — cards only. We'll count cards via data.
    if (!reset) start = grid.querySelectorAll('.card[data-id]').length;
    var end = Math.min(list.length, outfitLimit);
    for (var i = start; i < end; i++) {
      grid.appendChild(outfitCard(list[i], true));
    }
    sentinel.hidden = end >= list.length;
    var moreBtn = $('btn-more-outfits');
    moreBtn.hidden = end >= list.length;
    moreBtn.textContent = end >= list.length ? '已经全部加载' : '加载更多（' + end + ' / ' + list.length + '）';
    observeSentinel(sentinel, function () {
      if (outfitLimit < filteredOutfits().length) {
        outfitLimit += PAGE;
        renderOutfitGrid(false);
      }
    });
  }

  function outfitCard(c, withHeart) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card' + (c.id === state.outfitId ? ' is-current' : '');
    btn.dataset.id = c.id;
    btn.setAttribute('aria-label', c.id + ' ' + catName(c.cat) + ' ' + (c.color ? colorName(c.color) : ''));
    var img = document.createElement('img');
    img.alt = c.id;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = cdn(c.thumb);
    bindImgFallback(img, null, btn);
    btn.appendChild(img);
    if (withHeart) {
      var heart = document.createElement('span');
      heart.className = 'card-heart' + (isFav(c.id) ? ' is-on' : '');
      heart.textContent = isFav(c.id) ? '♥' : '♡';
      heart.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleFav(c.id);
      });
      btn.appendChild(heart);
    }
    btn.addEventListener('click', function () { wearOutfit(c.id); });
    return btn;
  }

  function bindImgFallback(img, remote, card) {
    img.addEventListener('error', function onErr() {
      img.removeEventListener('error', onErr);
      if (remote && img.dataset.fb !== '1') {
        img.dataset.fb = '1';
        img.src = remote;
        img.addEventListener('error', function () {
          fail();
        });
        return;
      }
      fail();
    });
    function fail() {
      img.classList.add('is-broken');
      if (card) card.classList.add('is-broken');
    }
  }

  function renderSeriesChips() {
    var box = $('series-chips');
    box.textContent = '';
    SERIES_ORDER.forEach(function (k) {
      box.appendChild(chipButton(state.poseSeries === k, seriesName(k), function () {
        state.poseSeries = k;
        persist();
        renderSeriesChips();
        renderPoseGrid();
      }));
    });
  }

  function renderAngleChips() {
    var box = $('angle-chips');
    box.textContent = '';
    var pose = currentPose();
    ANGLE_ORDER.forEach(function (k) {
      if (pose && pose.angles.indexOf(k) === -1) return;
      var btn = chipButton(state.angle === k, angleName(k), function () {
        state.angle = k;
        persist();
        renderAngleChips();
        renderPoseGrid();
        renderStage();
        renderCombo();
      });
      box.appendChild(btn);
    });
  }

  function renderPoseGrid() {
    var list = filteredPoses();
    var grid = $('pose-grid');
    var empty = $('pose-empty');
    grid.textContent = '';
    empty.hidden = list.length > 0;
    list.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card' + (p.id === state.poseId ? ' is-current' : '');
      btn.setAttribute('aria-label', p.name);
      var img = document.createElement('img');
      img.alt = p.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = cdn(poseThumbPath(p, state.angle));
      bindImgFallback(img, null, btn);
      var cap = document.createElement('span');
      cap.className = 'card-caption';
      cap.textContent = p.name;
      btn.appendChild(img);
      btn.appendChild(cap);
      btn.addEventListener('click', function () {
        state.poseId = p.id;
        if (p.angles.indexOf(state.angle) === -1) state.angle = preferredAngle(p);
        persist();
        renderStage();
        renderCombo();
        renderAngleChips();
        switchTab('dress');
        toast('已选用姿势：' + p.name);
      });
      grid.appendChild(btn);
    });
  }

  function renderHairChips() {
    var box = $('hair-chips');
    box.textContent = '';
    box.appendChild(chipButton(!state.hair, '全部发长', function () {
      state.hair = '';
      faceLimit = PAGE;
      persist();
      renderHairChips();
      renderFaceGrid(true);
    }));
    HAIR_ORDER.forEach(function (k) {
      box.appendChild(chipButton(state.hair === k, hairName(k), function () {
        state.hair = state.hair === k ? '' : k;
        faceLimit = PAGE;
        persist();
        renderHairChips();
        renderFaceGrid(true);
      }));
    });
  }

  function renderFaceGrid(reset) {
    var list = filteredFaces();
    var grid = $('face-grid');
    var empty = $('face-empty');
    var sentinel = $('face-sentinel');
    empty.hidden = list.length > 0;
    if (reset) grid.textContent = '';
    var start = reset ? 0 : grid.querySelectorAll('.card[data-id]').length;
    var end = Math.min(list.length, faceLimit);
    for (var i = start; i < end; i++) {
      (function (f) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card' + (f.id === state.faceId ? ' is-current' : '');
        btn.dataset.id = f.id;
        btn.setAttribute('aria-label', hairName(f.hair) + ' ' + f.id);
        var img = document.createElement('img');
        img.alt = f.id;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = cdn(f.thumb);
        bindImgFallback(img, FACE_REMOTE + f.id + '.webp', btn);
        btn.appendChild(img);
        btn.addEventListener('click', function () {
          state.faceId = f.id;
          persist();
          renderStage();
          renderCombo();
          switchTab('dress');
          toast('已选用脸型：' + hairName(f.hair));
        });
        grid.appendChild(btn);
      })(list[i]);
    }
    sentinel.hidden = end >= list.length;
    var moreBtn = $('btn-more-faces');
    moreBtn.hidden = end >= list.length;
    moreBtn.textContent = end >= list.length ? '已经全部加载' : '加载更多（' + end + ' / ' + list.length + '）';
    observeSentinel(sentinel, function () {
      if (faceLimit < filteredFaces().length) {
        faceLimit += PAGE;
        renderFaceGrid(false);
      }
    });
  }

  function renderFavGrid() {
    var grid = $('fav-grid');
    var empty = $('fav-empty');
    var items = state.favorites.map(function (id) { return costumeById[id]; }).filter(Boolean);
    $('fav-count').textContent = items.length ? ('已收藏 ' + items.length + ' 套') : '';
    grid.textContent = '';
    empty.hidden = items.length > 0;
    grid.hidden = items.length === 0;
    items.forEach(function (c) { grid.appendChild(outfitCard(c, true)); });
  }

  function updateFavButton() {
    var on = isFav(state.outfitId);
    var btn = $('btn-fav');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '取消收藏' : '收藏当前衣装');
  }

  function observeSentinel(el, cb) {
    if (!el) return;
    if (el._io) { el._io.disconnect(); }
    if (typeof IntersectionObserver === 'undefined') {
      el._io = null;
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) cb();
    }, { root: $('main'), rootMargin: '600px 0px' });
    io.observe(el);
    el._io = io;
    observers.push(io);
  }

  /* ---------- actions ---------- */

  function wearOutfit(id, opts) {
    if (!costumeById[id]) return;
    if (id === state.outfitId && !(opts && opts.force)) {
      highlightGrid();
      return;
    }
    state.outfitId = id;
    persist();
    renderStage();
    renderMeta();
    renderCombo();
    updateFavButton();
    highlightGrid();
    renderFavGrid();
  }

  function highlightGrid() {
    document.querySelectorAll('#outfit-grid .card, #fav-grid .card').forEach(function (el) {
      el.classList.toggle('is-current', el.dataset.id === state.outfitId);
      var heart = el.querySelector('.card-heart');
      if (heart) {
        var on = isFav(el.dataset.id);
        heart.classList.toggle('is-on', on);
        heart.textContent = on ? '♥' : '♡';
      }
    });
  }

  function stepOutfit(dir) {
    var list = filteredOutfits();
    if (!list.length) {
      toast('当前筛选下没有可切换的衣装');
      return;
    }
    var idx = indexIn(list, state.outfitId);
    var next;
    if (idx < 0) next = list[dir > 0 ? 0 : list.length - 1];
    else next = list[(idx + dir + list.length) % list.length];
    wearOutfit(next.id, { force: true });
  }

  function randomOutfit() {
    var list = filteredOutfits();
    if (!list.length) {
      toast('当前筛选下没有可切换的衣装');
      return;
    }
    if (list.length === 1) {
      wearOutfit(list[0].id, { force: true });
      return;
    }
    var pick;
    do {
      pick = list[Math.floor(Math.random() * list.length)];
    } while (pick.id === state.outfitId);
    wearOutfit(pick.id);
  }

  function toggleFav(id) {
    var i = state.favorites.indexOf(id);
    if (i === -1) state.favorites.unshift(id);
    else state.favorites.splice(i, 1);
    persist();
    updateFavButton();
    highlightGrid();
    renderFavGrid();
    toast(i === -1 ? '已加入收藏' : '已取消收藏');
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll('.panel').forEach(function (p) {
      var on = p.dataset.tab === tab;
      p.hidden = !on;
      p.classList.toggle('is-active', on);
    });
    document.querySelectorAll('.tabbar .tab').forEach(function (t) {
      var on = t.dataset.tab === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('main').scrollTop = 0;
    if (tab === 'pose') renderPoseGrid();
    if (tab === 'face') renderFaceGrid(false);
    if (tab === 'fav') renderFavGrid();
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 1800);
  }

  function copyText(text, okMsg) {
    function done() { toast(okMsg || '已复制'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast('复制失败，请长按链接复制'); }
      document.body.removeChild(ta);
    }
  }

  function openAbout(open) {
    $('about-sheet').hidden = !open;
  }

  /* ---------- events ---------- */

  function bindEvents() {
    $('btn-prev').addEventListener('click', function () { stepOutfit(-1); });
    $('btn-next').addEventListener('click', function () { stepOutfit(1); });
    $('btn-random').addEventListener('click', randomOutfit);
    $('btn-fav').addEventListener('click', function () { toggleFav(state.outfitId); });
    $('chip-pose').addEventListener('click', function () { switchTab('pose'); });
    $('chip-face').addEventListener('click', function () { switchTab('face'); });
    $('btn-show-all').addEventListener('click', function () {
      state.showAll = !state.showAll;
      if (!state.showAll && ADULT_CATS.indexOf(state.cat) !== -1) state.cat = '';
      onFilterChange();
    });
    $('btn-compose').addEventListener('click', function () {
      var links = officialLinks();
      var pose = currentPose();
      var face = currentFace();
      var text = '图鉴画师，帮我出一张合成图：\n' +
        '姿势：' + pose.id + '（' + pose.name + '，' + angleName(state.angle) + '） ' + links.pose + '\n' +
        '衣服：' + state.outfitId + ' ' + links.costume + '\n' +
        '脸型：' + face.id + ' ' + links.face;
      copyText(text, '已复制组合，粘贴发给图鉴画师就能出图');
    });
    $('btn-copy-all').addEventListener('click', function () {
      var l = officialLinks();
      var text = '当前组合（素材来自 RuiC-PoseAtlas）\n姿势：' + l.pose + '\n衣装：' + l.costume + '\n脸型：' + l.face;
      copyText(text, '已复制当前组合链接');
    });
    $('btn-more-outfits').addEventListener('click', function () {
      outfitLimit += PAGE;
      renderOutfitGrid(false);
    });
    $('btn-more-faces').addEventListener('click', function () {
      faceLimit += PAGE;
      renderFaceGrid(false);
    });
    $('btn-about').addEventListener('click', function () { openAbout(true); });
    $('about-close').addEventListener('click', function () { openAbout(false); });
    $('about-backdrop').addEventListener('click', function () { openAbout(false); });

    document.querySelectorAll('.tabbar .tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });

    var search = $('search-outfit');
    var clearBtn = $('clear-outfit-search');
    var qTimer = 0;
    search.addEventListener('input', function () {
      clearBtn.hidden = !search.value;
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        state.query = search.value;
        onFilterChange();
      }, 180);
    });
    clearBtn.addEventListener('click', function () {
      search.value = '';
      clearBtn.hidden = true;
      state.query = '';
      onFilterChange();
      search.focus();
    });
    clearBtn.hidden = !state.query;

    var faceSearch = $('search-face');
    var fTimer = 0;
    faceSearch.addEventListener('input', function () {
      clearTimeout(fTimer);
      fTimer = setTimeout(function () {
        state.faceQuery = faceSearch.value;
        faceLimit = PAGE;
        renderFaceGrid(true);
      }, 180);
    });

    bindSwipe($('stage'));

    document.addEventListener('keydown', function (e) {
      if ($('about-sheet').hidden === false && e.key === 'Escape') {
        openAbout(false);
        return;
      }
      if (state.tab !== 'dress') return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepOutfit(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepOutfit(1); }
    });
  }

  function bindSwipe(el) {
    var startX = 0, startY = 0, tracking = false;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
    });
    function end(e) {
      if (!tracking) return;
      tracking = false;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) < 46) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) stepOutfit(1);
      else stepOutfit(-1);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', function () { tracking = false; });
    el.addEventListener('pointerleave', function (e) {
      if (tracking) end(e);
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    navigator.serviceWorker.register('./sw.js').catch(function () { /* offline first is optional */ });
  }

  function init() {
    if (!COSTUMES.length || !POSES.length) {
      document.body.innerHTML = '<p style="padding:24px;color:#EDE4D4">图鉴数据未能加载。请通过本地静态服务打开本项目，例如：python3 -m http.server。</p>';
      return;
    }
    bindEvents();
    renderAll();
    switchTab('dress');
    registerSW();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
