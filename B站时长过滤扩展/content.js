(function () {
  'use strict';



  /* ============ 默认配置 ============ */
  const DEFAULTS = {
    filterShort: true,    // 过滤短视频
    filterMid: false,     // 过滤中视频(单独开关)
    filterLive: false,    // 过滤直播
    shortMax: 5,          // 短视频上限(分钟)
    midMax: 30,           // 中视频上限(分钟)
    unit: 'min',          // 操作台单位:min / s
    showBadge: true,      // 分类标签
    showPlaceholder: true, // 过滤时显示占位图
    showTitle: true,      // 占位卡显示视频名称
    clickUnhide: true,    // 点击占位卡解除隐藏
    shortPhotos: [],      // 短视频遮挡照片组(轮换)
    midPhotos: [],        // 中视频遮挡照片组(轮换)
    livePhotos: [],       // 直播遮挡照片组(轮换)
    togglePos: null       // 悬浮按钮位置(拖动后保存)
  };

  let config = Object.assign({}, DEFAULTS);
  const unhidden = new Set();   // 用户点击解除的 bvid
  let photoCursor = 0;          // 照片轮换游标

  /* ============ 时长解析 ============ */
  function parseDuration(text) {
    if (!text) return null;
    const m = String(text).trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) return null;
    const h = m[3] !== undefined ? parseInt(m[1], 10) : 0;
    const min = m[3] !== undefined ? parseInt(m[2], 10) : parseInt(m[1], 10);
    const sec = m[3] !== undefined ? parseInt(m[3], 10) : parseInt(m[2], 10);
    if (min > 59 || sec > 59) return null;
    return h * 3600 + min * 60 + sec;
  }

  function classify(sec) {
    if (sec < config.shortMax * 60) return 'short';
    if (sec < config.midMax * 60) return 'mid';
    return 'long';
  }

  const LABELS = { short: '短', mid: '中', long: '长' };

  /* ============ 卡片识别 ============ */
  const CARD_SELECTORS = [
    '.bili-video-card',
    '.bili-live-card',
    '.live-card',
    '.floor-single-card',
    '.video-card',
    '.video-list-item'
  ];

  const LIVE_LINK_SELECTOR = 'a[href*="live.bilibili.com"], a[href*="/live/"]';

  const DURATION_SELECTORS = [
    '.bili-video-card__stats__duration',
    '.bili-video-card__stats--duration',
    '.bili-video-card__info--duration',
    '.video-card__duration',
    '.duration'
  ];

  const TITLE_SELECTORS = [
    '.bili-video-card__info--tit',
    '.bili-video-card__info--title',
    '.video-card__info--tit',
    '.bili-video-card__info--tit a'
  ];

  function findDuration(card) {
    for (const sel of DURATION_SELECTORS) {
      const el = card.querySelector(sel);
      let t = el ? el.textContent.trim() : '';
      if (t) {
        // 历史记录页格式 "00:04/29:26"(已看/总长)→ 取斜杠后的总时长
        const slash = t.match(/(\d{1,3}:\d{1,2}(?::\d{1,2})?)\s*\/\s*(\d{1,3}:\d{1,2}(?::\d{1,2})?)/);
        if (slash) t = slash[2];
        return { el: el, text: t };
      }
    }
    const text = card.textContent || '';
    if (/直播/i.test(text)) return null;
    const slash = text.match(/(\d{1,3}:\d{1,2}(?::\d{1,2})?)\s*\/\s*(\d{1,3}:\d{1,2}(?::\d{1,2})?)/);
    if (slash) return { el: null, text: slash[2] };
    const m = text.match(/(\d{1,3}:\d{1,2}(?::\d{1,2})?)/);
    return m ? { el: null, text: m[1] } : null;
  }

  function findTitle(card) {
    for (const sel of TITLE_SELECTORS) {
      const el = card.querySelector(sel);
      const t = el ? (el.textContent || el.title || '').trim() : '';
      if (t) return t;
    }
    const a = card.querySelector('a[title]');
    return a ? a.title.trim() : '';
  }

  function findBvid(card) {
    const a = card.querySelector('a[href*="/video/"]');
    if (!a) return null;
    const m = a.href.match(/\/video\/(BV[\w]+)/);
    return m ? m[1] : a.href;
  }

  function isLiveCard(card) {
    if (/直播/.test(card.textContent || '')) return true;
    return !!card.querySelector(LIVE_LINK_SELECTOR);
  }



  /* ============ 核心处理 ============ */
  function markDurationEl(el, cls) {
    if (el && !el.dataset.biliDurMarked) {
      el.dataset.biliDurMarked = '1';
      el.dataset.biliDurOriginal = el.textContent;
      el.textContent = LABELS[cls] + ' ' + el.textContent;
    }
  }

  function unmarkDurationEl(el) {
    if (el && el.dataset.biliDurMarked) {
      el.textContent = el.dataset.biliDurOriginal;
      delete el.dataset.biliDurMarked;
    }
  }

  function getPhotos(cls) {
    let list;
    if (cls === 'short') list = config.shortPhotos;
    else if (cls === 'mid') list = config.midPhotos;
    else list = config.livePhotos;
    return list && list.length ? list : null;
  }

  function processCard(card) {
    if (card.__biliDurSeconds === undefined) {
      const info = findDuration(card);
      card.__biliDurSeconds = info ? parseDuration(info.text) : null;
      card.__biliDurEl = info ? info.el : null;
      card.__biliDurText = info ? info.text : '';
      card.__biliDurBvid = findBvid(card);
      if (card.__biliDurSeconds !== null) {
        card.__biliDurCls = classify(card.__biliDurSeconds);
        card.classList.add('bili-dur-' + card.__biliDurCls);
        if (config.showBadge) {
          markDurationEl(card.__biliDurEl, card.__biliDurCls);
        }
      } else if (isLiveCard(card)) {
        card.__biliDurCls = 'live';
        card.classList.add('bili-dur-live');
      }
    }
    const sec = card.__biliDurSeconds;
    const cls = card.__biliDurCls;
    const shouldFilter = (cls === 'short' && config.filterShort) || (cls === 'mid' && config.filterMid) || (cls === 'live' && config.filterLive);
    const isUnhidden = (card.__biliDurBvid && unhidden.has(card.__biliDurBvid)) || card.dataset.biliDurUnhidden === '1';
    const shouldHide = shouldFilter && (sec !== null || cls === 'live') && !isUnhidden;

    if (shouldHide) {
      if (config.showPlaceholder) {
        const photos = getPhotos(cls);
        const phUrl = photos ? photos[photoCursor++ % photos.length] : chrome.runtime.getURL('placeholder.jpg');
        card.style.display = '';
        card.classList.add('bili-dur-filtered');
        card.style.setProperty('--bili-dur-ph', 'url("' + phUrl + '")');
        let tag = card.querySelector('.bili-dur-ph-tag');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'bili-dur-ph-tag';
          card.appendChild(tag);
        }
        if (cls === 'live') {
          tag.textContent = '已过滤 · 直播';
        } else {
          const title = config.showTitle ? findTitle(card) : '';
          tag.textContent = title ? (title + ' · ' + card.__biliDurText) : card.__biliDurText;
        }
      } else {
        card.style.display = 'none';
        card.classList.remove('bili-dur-filtered');
      }
    } else {
      card.style.display = '';
      card.classList.remove('bili-dur-filtered');
      const tag = card.querySelector('.bili-dur-ph-tag');
      if (tag) tag.remove();
    }
  }

  /* ============ 点击解除隐藏 ============ */
  function unhideCard(card) {
    if (card.__biliDurBvid) unhidden.add(card.__biliDurBvid);
    card.dataset.biliDurUnhidden = '1';
    card.classList.remove('bili-dur-filtered');
    card.style.removeProperty('--bili-dur-ph');
    card.style.display = '';
    const tag = card.querySelector('.bili-dur-ph-tag');
    if (tag) tag.remove();
  }

  document.addEventListener('click', function (e) {
    if (!config.clickUnhide) return;
    const card = e.target && e.target.closest ? e.target.closest('.bili-dur-filtered') : null;
    if (card) {
      e.preventDefault();
      e.stopPropagation();
      unhideCard(card);
    }
  }, true);

  /* 右键:把已解除隐藏的视频重新隐藏 */
  document.addEventListener('contextmenu', function (e) {
    const card = e.target && e.target.closest ? e.target.closest(CARD_SELECTORS.join(',')) : null;
    if (!card || card.dataset.biliDurUnhidden !== '1') return;
    e.preventDefault();
    e.stopPropagation();
    if (card.__biliDurBvid) unhidden.delete(card.__biliDurBvid);
    delete card.dataset.biliDurUnhidden;
    processCard(card);
  }, true);

  function scan() {
    const cards = document.querySelectorAll(CARD_SELECTORS.join(','));
    let short = 0, mid = 0, long = 0, live = 0, hidden = 0;
    cards.forEach(function (c) {
      processCard(c);
      const cls = c.__biliDurCls;
      if (cls === 'short') short++;
      else if (cls === 'mid') mid++;
      else if (cls === 'long') long++;
      else if (cls === 'live') live++;
      if (c.classList.contains('bili-dur-filtered') || c.style.display === 'none') hidden++;
    });
    if (cards.length) {
      console.log('[B站时长过滤] 卡片 ' + cards.length + ' 张(短' + short + '/中' + mid + '/长' + long + '/直播' + live + ') 隐藏' + hidden + ' | 短阈值 ' + config.shortMax + 'min 中阈值 ' + config.midMax + 'min | 短过滤' + (config.filterShort ? '开' : '关') + ' 中过滤' + (config.filterMid ? '开' : '关'));
    }
  }

  function rescanAll() {
    document.querySelectorAll(CARD_SELECTORS.join(',')).forEach(function (card) {
      card.classList.remove('bili-dur-short', 'bili-dur-mid', 'bili-dur-long', 'bili-dur-filtered');
      card.style.removeProperty('--bili-dur-ph');
      const tag = card.querySelector('.bili-dur-ph-tag');
      if (tag) tag.remove();
      if (card.__biliDurEl) unmarkDurationEl(card.__biliDurEl);
      card.__biliDurSeconds = undefined;
      card.__biliDurEl = null;
      card.__biliDurCls = null;
    });
    scan();
  }  /* ============ 样式 ============ */
  function addStyle(css) {
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  addStyle(`
    .bili-video-card, .video-card, .video-list-item { position: relative; }
    .bili-dur-short { box-shadow: inset 0 0 0 2px rgba(244, 63, 94, 0.6); }
    .bili-dur-mid { box-shadow: inset 0 0 0 2px rgba(14, 165, 233, 0.6); }
    .bili-dur-long { box-shadow: inset 0 0 0 2px rgba(34, 197, 94, 0.6); }
    .bili-dur-live { box-shadow: inset 0 0 0 2px rgba(255, 170, 0, 0.6); }
    .bili-dur-short [data-bili-dur-marked] { color: #f43f5e; }
    .bili-dur-mid [data-bili-dur-marked] { color: #0ea5e9; }
    .bili-dur-long [data-bili-dur-marked] { color: #22c55e; }
    [data-bili-dur-marked] { font-weight: 600; }
    .bili-dur-filtered { position: relative !important; overflow: hidden; }
    .bili-dur-filtered > *:not(.bili-dur-ph-tag) { opacity: 0; }
    .bili-dur-filtered::after {
      content: '';
      position: absolute; inset: 0; z-index: 5;
      background-image: var(--bili-dur-ph);
      background-size: cover;
      background-position: center;
      pointer-events: none;
    }
    .bili-dur-ph-tag {
      position: absolute; left: 6px; right: 6px; bottom: 6px; z-index: 6;
      padding: 3px 8px; font-size: 12px; line-height: 1.5;
      color: #fff; background: rgba(0,0,0,0.6);
      border-radius: 4px; pointer-events: none; opacity: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: calc(100% - 12px);
    }
    #bili-dur-pet-wrap {
      position: fixed; right: 24px; bottom: 90px; z-index: 2147483000;
      width: 100px; height: 100px; cursor: grab;
    }
    #bili-dur-pet-wrap:active { cursor: grabbing; }
    #bili-dur-pet {
      width: 100%; height: 100%; object-fit: contain;
      user-select: none; -webkit-user-drag: none; pointer-events: auto;
    }
    #bili-dur-toggle {
      position: absolute; left: -4px; top: -4px; z-index: 2147483001;
      width: 30px; height: 30px; border: 2px solid #fff; border-radius: 50%;
      background: #fb7299; color: #fff; font-size: 13px; font-weight: 700;
      cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    #bili-dur-panel {
      position: fixed; right: 24px; bottom: 140px; z-index: 2147483001;
      width: 260px; background: #fff; color: #18191c;
      border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      padding: 14px 16px; font-size: 13px; display: none;
      font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      box-sizing: border-box;
    }
    #bili-dur-panel.open { display: block; }
    #bili-dur-panel .bili-dur-head {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px; font-weight: 700; font-size: 14px;
    }
    #bili-dur-panel .bili-dur-close {
      border: none; background: none; font-size: 18px; cursor: pointer;
      color: #9499a0; line-height: 1;
    }
    #bili-dur-panel label {
      display: flex; align-items: center; gap: 6px; margin: 6px 0; cursor: pointer;
    }
    #bili-dur-panel .bili-dur-hint { margin-top: 10px; color: #9499a0; font-size: 12px; line-height: 1.6; }
  `);

  /* ============ 配置存储 ============ */
  function saveSetting(key, value) {
    const obj = {};
    obj[key] = value;
    chrome.storage.local.set(obj);
  }

  /* ============ 页面内快捷面板 ============ */
  let panel = null;
  let toggleBtn = null;
  let petWrap = null;

  function buildUI() {
    petWrap = document.createElement('div');
    petWrap.id = 'bili-dur-pet-wrap';
    const pet = document.createElement('img');
    pet.id = 'bili-dur-pet';
    pet.src = chrome.runtime.getURL('pet.png');
    pet.alt = '';
    pet.draggable = false;
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'bili-dur-toggle';
    toggleBtn.title = '视频时长分类与过滤(详细设置在工具栏图标)';
    toggleBtn.textContent = '时';
    petWrap.appendChild(pet);
    petWrap.appendChild(toggleBtn);

    panel = document.createElement('div');
    panel.id = 'bili-dur-panel';
    panel.innerHTML = [
      '<div class="bili-dur-head"><span>快捷开关</span>',
      '<button class="bili-dur-close" title="关闭">×</button></div>',
      '<label><input type="checkbox" id="bili-dur-cb-short"> 过滤短视频</label>',
      '<label><input type="checkbox" id="bili-dur-cb-mid"> 过滤中视频</label>',
      '<label><input type="checkbox" id="bili-dur-cb-live"> 过滤直播</label>',
      '<label><input type="checkbox" id="bili-dur-cb-title"> 显示视频名称</label>',
      '<label><input type="checkbox" id="bili-dur-cb-ph"> 显示占位图</label>',
      '<div class="bili-dur-row"><span class="bili-dur-lbl">短视频上限</span><input type="range" id="bili-dur-range-short" min="30" max="300" step="30"><input type="number" id="bili-dur-in-short-min" class="bili-dur-num" min="0"><input type="number" id="bili-dur-in-short-sec" class="bili-dur-num" min="0" max="59" style="display:none;"></div>',
      '<div class="bili-dur-row"><span class="bili-dur-lbl">中视频上限</span><input type="range" id="bili-dur-range-mid" min="360" max="1800" step="30"><input type="number" id="bili-dur-in-mid-min" class="bili-dur-num" min="0"><input type="number" id="bili-dur-in-mid-sec" class="bili-dur-num" min="0" max="59" style="display:none;"></div>',
      '<div class="bili-dur-hint" id="bili-dur-range-hint"></div>',
      '<div class="bili-dur-hint">照片组、单位等详细设置请点浏览器工具栏的「时」图标</div>'
    ].join('');

    panel.querySelector('.bili-dur-close').addEventListener('click', function () {
      panel.classList.remove('open');
    });
    let dragState = null;
    let wasDrag = false;
    pet.addEventListener('mousedown', function (e) {
      dragState = { sx: e.clientX, sy: e.clientY, ox: petWrap.offsetLeft, oy: petWrap.offsetTop, moved: false };
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragState) return;
      const dx = e.clientX - dragState.sx;
      const dy = e.clientY - dragState.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
      if (dragState.moved) {
        petWrap.style.right = 'auto';
        petWrap.style.bottom = 'auto';
        petWrap.style.left = Math.max(0, dragState.ox + dx) + 'px';
        petWrap.style.top = Math.max(0, dragState.oy + dy) + 'px';
        if (panel.classList.contains('open')) positionPanel();
      }
    });
    document.addEventListener('mouseup', function () {
      if (dragState) {
        if (dragState.moved) {
          wasDrag = true;
          saveSetting('togglePos', { left: petWrap.style.left, top: petWrap.style.top });
          if (panel.classList.contains('open')) positionPanel();
        }
        dragState = null;
      }
    });
    function positionPanel() {
      const r = petWrap.getBoundingClientRect();
      const pw = 270, ph = 340;
      let left = r.left + r.width + 10;
      let top = r.top - 20;
      if (left + pw > window.innerWidth) left = r.left - pw - 10;
      if (top + ph > window.innerHeight) top = window.innerHeight - ph - 10;
      if (top < 0) top = 0;
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
    function togglePanel() {
      if (wasDrag) { wasDrag = false; return; }
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) positionPanel();
    }
    pet.addEventListener('click', togglePanel);
    toggleBtn.addEventListener('click', togglePanel);
    document.body.appendChild(petWrap);
    document.body.appendChild(panel);
    panel.querySelector('#bili-dur-range-short').addEventListener('input', function () { applyQuickRange('short'); });
    panel.querySelector('#bili-dur-range-mid').addEventListener('input', function () { applyQuickRange('mid'); });
    panel.querySelector('#bili-dur-in-short-min').addEventListener('change', function () { applyQuickInput('short'); });
    panel.querySelector('#bili-dur-in-short-sec').addEventListener('change', function () { applyQuickInput('short'); });
    panel.querySelector('#bili-dur-in-mid-min').addEventListener('change', function () { applyQuickInput('mid'); });
    panel.querySelector('#bili-dur-in-mid-sec').addEventListener('change', function () { applyQuickInput('mid'); });

    panel.querySelector('#bili-dur-cb-short').addEventListener('change', function () {
      saveSetting('filterShort', this.checked);
    });
    panel.querySelector('#bili-dur-cb-mid').addEventListener('change', function () {
      saveSetting('filterMid', this.checked);
    });
    panel.querySelector('#bili-dur-cb-live').addEventListener('change', function () {
      saveSetting('filterLive', this.checked);
    });
    panel.querySelector('#bili-dur-cb-title').addEventListener('change', function () {
      saveSetting('showTitle', this.checked);
    });
    panel.querySelector('#bili-dur-cb-ph').addEventListener('change', function () {
      saveSetting('showPlaceholder', this.checked);
    });
  }

  /* 快捷面板:阈值拉杆 / 数字框 */
  function applyQuickRange(key) {
    const sec = parseInt(document.getElementById('bili-dur-range-' + key).value, 10);
    if (key === 'short') {
      const midSec = Math.round(config.midMax * 60);
      if (sec >= midSec) {
        document.getElementById('bili-dur-range-short').value = midSec - 30;
        saveSetting('shortMax', (midSec - 30) / 60);
        return;
      }
      saveSetting('shortMax', sec / 60);
    } else {
      const shortSec = Math.round(config.shortMax * 60);
      if (sec <= shortSec) {
        document.getElementById('bili-dur-range-mid').value = shortSec + 30;
        saveSetting('midMax', (shortSec + 30) / 60);
        return;
      }
      saveSetting('midMax', sec / 60);
    }
  }

  function applyQuickInput(key) {
    const secMode = config.unit === 's';
    const minEl = document.getElementById('bili-dur-in-' + key + '-min');
    const secEl = document.getElementById('bili-dur-in-' + key + '-sec');
    let sec;
    if (secMode) {
      sec = (parseInt(minEl.value, 10) || 0) * 60 + (parseInt(secEl.value, 10) || 0);
    } else {
      sec = Math.round((parseFloat(minEl.value) || 0) * 60);
    }
    if (key === 'short') {
      const midSec = Math.round(config.midMax * 60);
      if (sec >= midSec) sec = midSec - 30;
    } else {
      const shortSec = Math.round(config.shortMax * 60);
      if (sec <= shortSec) sec = shortSec + 30;
    }
    document.getElementById('bili-dur-range-' + key).value = sec;
    saveSetting(key === 'short' ? 'shortMax' : 'midMax', sec / 60);
    renderQuickTime();
  }

  function fmtT(sec) {
    sec = Math.round(sec);
    if (config.unit === 's') {
      const m = Math.floor(sec / 60), s = sec % 60;
      return m ? (m + 'min' + s + 's') : (s + 's');
    }
    const m = Math.round(sec / 6) / 10;
    return String(m).replace(/\.0$/, '') + 'min';
  }

  function renderQuickTime() {
    if (!panel) return;
    const secMode = config.unit === 's';
    const hintEl = document.getElementById('bili-dur-range-hint');
    if (hintEl) {
      const s = Math.round(config.shortMax * 60);
      const m = Math.round(config.midMax * 60);
      hintEl.textContent = '短视频:0~' + fmtT(s) + ' | 中视频:' + fmtT(s) + '~' + fmtT(m) + ' | 长视频:>' + fmtT(m);
    }
    const pairs = [['short', config.shortMax], ['mid', config.midMax]];
    pairs.forEach(function (p) {
      const key = p[0], minutes = p[1];
      const totalSec = Math.round(minutes * 60);
      const rangeEl = document.getElementById('bili-dur-range-' + key);
      const minEl = document.getElementById('bili-dur-in-' + key + '-min');
      const secEl = document.getElementById('bili-dur-in-' + key + '-sec');
      if (!rangeEl || !minEl || !secEl) return;
      rangeEl.value = Math.min(Math.max(totalSec, key === 'short' ? 30 : 360), key === 'short' ? 300 : 1800);
      if (secMode) {
        minEl.value = Math.floor(totalSec / 60);
        secEl.value = totalSec % 60;
        secEl.style.display = 'inline-block';
      } else {
        minEl.value = Math.round(minutes * 10) / 10;
        secEl.value = 0;
        secEl.style.display = 'none';
      }
    });
  }

  function syncPanelControls() {
    if (!panel) return;
    document.getElementById('bili-dur-cb-short').checked = config.filterShort;
    document.getElementById('bili-dur-cb-mid').checked = config.filterMid;
    document.getElementById('bili-dur-cb-live').checked = config.filterLive;
    document.getElementById('bili-dur-cb-title').checked = config.showTitle;
    document.getElementById('bili-dur-cb-ph').checked = config.showPlaceholder;
    renderQuickTime();
  }

  /* ============ 配置加载与同步 ============ */
  function applyConfig() {
    if (!panel) buildUI();
    syncPanelControls();
    if (config.togglePos && config.togglePos.left && petWrap) {
      petWrap.style.right = 'auto';
      petWrap.style.bottom = 'auto';
      petWrap.style.left = config.togglePos.left;
      petWrap.style.top = config.togglePos.top;
    }
    rescanAll();
    if (config.showPlaceholder) {
      console.log('[B站时长过滤] 占位图: 短' + config.shortPhotos.length + '张/中' + config.midPhotos.length + '张' + (config.shortPhotos.length || config.midPhotos.length ? '' : '(内置默认图)'));
    }
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    let changed = false;
    for (const k in DEFAULTS) {
      if (changes[k] && typeof changes[k].newValue !== 'undefined') {
        config[k] = changes[k].newValue;
        changed = true;
      }
    }
    if (changed) applyConfig();
  });

  function loadConfig() {
    chrome.storage.local.get(DEFAULTS, function (items) {
      for (const k in DEFAULTS) {
        if (typeof items[k] !== 'undefined') config[k] = items[k];
      }
      // 兼容旧版单图:迁移到短视频照片组
      if ((!items.shortPhotos || !items.shortPhotos.length) && items.placeholderImage) {
        config.shortPhotos = [items.placeholderImage];
        chrome.storage.local.set({ shortPhotos: config.shortPhotos, placeholderImage: '' });
      }
      applyConfig();
    });
  }

  /* ============ 启动 ============ */
  let scanTimer = null;
  const observer = new MutationObserver(function () {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 300);
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  loadConfig();
})();