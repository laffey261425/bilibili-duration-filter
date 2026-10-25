'use strict';

const DEFAULTS = {
  filterShort: true,
  filterMid: false,
  filterLive: false,
  shortMax: 5,
  midMax: 30,
  unit: 'min',
  showBadge: true,
  showPlaceholder: true,
  showTitle: true,
  clickUnhide: true,
  shortPhotos: [],
  midPhotos: [],
  livePhotos: []
};

let cfg = Object.assign({}, DEFAULTS);

function $(id) { return document.getElementById(id); }

function save(key, value) {
  const obj = {};
  obj[key] = value;
  chrome.storage.local.set(obj);
}

/* 数字框渲染:按单位显示 min 或 min+s */
function fmtMin(m) {
  const r = Math.round(m * 10) / 10;
  return String(r).replace(/\.0$/, '');
}

function renderTimeInputs() {
  const secMode = cfg.unit === 's';
  document.querySelectorAll('.num-sec').forEach(function (el) {
    el.style.display = secMode ? 'inline-block' : 'none';
  });
  document.getElementById('range-short').step = secMode ? '1' : '30';
  document.getElementById('range-mid').step = secMode ? '1' : '30';
  document.querySelectorAll('.unit-sec').forEach(function (el) {
    el.style.display = secMode ? '' : 'none';
  });
  const pairs = [['short', cfg.shortMax], ['mid', cfg.midMax]];
  pairs.forEach(function (p) {
    const key = p[0], minutes = p[1];
    const totalSec = Math.round(minutes * 60);
    if (secMode) {
      $(('in-' + key + '-min')).value = Math.floor(totalSec / 60);
      $(('in-' + key + '-sec')).value = totalSec % 60;
    } else {
      $(('in-' + key + '-min')).value = fmtMin(minutes);
      $(('in-' + key + '-sec')).value = 0;
    }
  });
}

/* 拉杆 → 秒;参数约束:短上限 < 中上限(至少差 30 秒) */
function applyRange(key) {
  const sec = parseInt($('range-' + key).value, 10);
  if (key === 'short') {
    const midSec = Math.round(cfg.midMax * 60);
    if (sec >= midSec) {
      $('range-short').value = midSec - 30;
      save('midMax', (midSec - 30) / 60 + 1);
      return;
    }
    save('shortMax', sec / 60);
  } else {
    const shortSec = Math.round(cfg.shortMax * 60);
    if (sec <= shortSec) {
      $('range-mid').value = shortSec + 30;
      save('shortMax', (shortSec + 30) / 60 - 1);
      return;
    }
    save('midMax', sec / 60);
  }
}

/* 数字框 → 秒 */
function applyInput(key) {
  const secMode = cfg.unit === 's';
  let sec;
  if (secMode) {
    const m = parseInt($('in-' + key + '-min').value, 10) || 0;
    const s = parseInt($('in-' + key + '-sec').value, 10) || 0;
    sec = m * 60 + s;
  } else {
    sec = Math.round((parseFloat($('in-' + key + '-min').value) || 0) * 60);
  }
  if (key === 'short') {
    const midSec = Math.round(cfg.midMax * 60);
    if (sec >= midSec) sec = midSec - 30;
    $('range-short').value = sec;
    save('shortMax', sec / 60);
  } else {
    const shortSec = Math.round(cfg.shortMax * 60);
    if (sec <= shortSec) sec = shortSec + 30;
    if (sec > 1800) sec = 1800;
    $('range-mid').value = sec;
    save('midMax', sec / 60);
  }
  renderTimeInputs();
}

/* 照片组 */
function bindPhotoGroup(key, prefix) {
  $('btn-pick-' + prefix).addEventListener('click', function () {
    $('file-' + prefix).click();
  });
  $('btn-clear-' + prefix).addEventListener('click', function () {
    save(key, []);
  });
  $('file-' + prefix).addEventListener('change', function () {
    const files = Array.prototype.slice.call(this.files);
    if (!files.length) return;
    const st = $('st-' + prefix);
    st.textContent = '处理照片中…';
    st.style.color = '#9499a0';
    const results = [];
    let done = 0;
    const next = function () {
      done++;
      if (done >= files.length) {
        const arr = (cfg[key] || []).concat(results);
        save(key, arr);
        st.textContent = '已添加 ' + results.length + ' 张,共 ' + arr.length + ' 张';
        st.style.color = '#22c55e';
        this.value = '';
      }
    };
    const self = this;
    files.forEach(function (f) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          try {
            const maxW = 800;
            let w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            results.push(canvas.toDataURL('image/jpeg', 0.82));
          } catch (err) { /* ignore */ }
          next.call(self);
        };
        img.onerror = function () {
          st.textContent = '有图片无法读取(请用 JPG/PNG)';
          st.style.color = '#ef4444';
          next.call(self);
        };
        img.src = e.target.result;
      };
      reader.onerror = function () { next.call(self); };
      reader.readAsDataURL(f);
    });
  });
}

function renderThumbs(key, prefix) {
  const box = $('thumbs-' + prefix);
  box.innerHTML = '';
  const arr = cfg[key] || [];
  arr.forEach(function (url, i) {
    const d = document.createElement('div');
    d.className = 'thumb';
    const img = document.createElement('img');
    img.src = url;
    const x = document.createElement('span');
    x.className = 'thumb-x';
    x.textContent = '×';
    x.addEventListener('click', function () {
      const list = (cfg[key] || []).slice();
      list.splice(i, 1);
      save(key, list);
    });
    d.appendChild(img);
    d.appendChild(x);
    box.appendChild(d);
  });
  const st = $('st-' + prefix);
  st.textContent = arr.length ? (arr.length + ' 张照片,轮流遮挡') : '未设置,使用内置默认图';
  st.style.color = arr.length ? '#9499a0' : '#9499a0';
}

function fmtT(sec) {
  sec = Math.round(sec);
  if (cfg.unit === 's') {
    const m = Math.floor(sec / 60), s = sec % 60;
    return m ? (m + 'min' + s + 's') : (s + 's');
  }
  const m = Math.round(sec / 6) / 10;
  return String(m).replace(/\.0$/, '') + 'min';
}

function updateRangeHint() {
  const s = Math.round(cfg.shortMax * 60);
  const m = Math.round(cfg.midMax * 60);
  $('range-hint').textContent = '短视频:0~' + fmtT(s) + ' | 中视频:' + fmtT(s) + '~' + fmtT(m) + ' | 长视频:>' + fmtT(m);
}

function applyUI() {
  $('cb-short').checked = cfg.filterShort;
  $('cb-mid').checked = cfg.filterMid;
  $('cb-live').checked = cfg.filterLive;
  $('cb-badge').checked = cfg.showBadge;
  $('cb-ph').checked = cfg.showPlaceholder;
  $('cb-title').checked = cfg.showTitle;
  $('cb-unhide').checked = cfg.clickUnhide;
  $('unit-min').checked = cfg.unit !== 's';
  $('unit-s').checked = cfg.unit === 's';
  $('range-short').value = Math.min(Math.max(Math.round(cfg.shortMax * 60), 30), 300);
  $('range-mid').value = Math.min(Math.max(Math.round(cfg.midMax * 60), 60), 1800);
  renderTimeInputs();
  updateRangeHint();
  renderThumbs('shortPhotos', 'short');
  renderThumbs('midPhotos', 'mid');
  renderThumbs('livePhotos', 'live');
}

/* 事件绑定 */
$('cb-short').addEventListener('change', function () { save('filterShort', this.checked); });
$('cb-mid').addEventListener('change', function () { save('filterMid', this.checked); });
$('cb-live').addEventListener('change', function () { save('filterLive', this.checked); });
$('cb-badge').addEventListener('change', function () { save('showBadge', this.checked); });
$('cb-ph').addEventListener('change', function () { save('showPlaceholder', this.checked); });
$('cb-title').addEventListener('change', function () { save('showTitle', this.checked); });
$('cb-unhide').addEventListener('change', function () { save('clickUnhide', this.checked); });

$('unit-min').addEventListener('change', function () { if (this.checked) save('unit', 'min'); });
$('unit-s').addEventListener('change', function () { if (this.checked) save('unit', 's'); });

$('range-short').addEventListener('input', function () { applyRange('short'); });
$('range-mid').addEventListener('input', function () { applyRange('mid'); });

$('in-short-min').addEventListener('change', function () { applyInput('short'); });
$('in-short-sec').addEventListener('change', function () { applyInput('short'); });
$('in-mid-min').addEventListener('change', function () { applyInput('mid'); });
$('in-mid-sec').addEventListener('change', function () { applyInput('mid'); });

bindPhotoGroup('shortPhotos', 'short');
bindPhotoGroup('midPhotos', 'mid');
bindPhotoGroup('livePhotos', 'live');

/* 初始加载 + storage 同步 */
chrome.storage.local.get(DEFAULTS, function (items) {
  cfg = Object.assign({}, DEFAULTS, items);
  if ((!cfg.shortPhotos || !cfg.shortPhotos.length) && items.placeholderImage) {
    cfg.shortPhotos = [items.placeholderImage];
    chrome.storage.local.set({ shortPhotos: cfg.shortPhotos, placeholderImage: '' });
  }
  applyUI();
});

chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== 'local') return;
  let changed = false;
  for (const k in DEFAULTS) {
    if (changes[k] && typeof changes[k].newValue !== 'undefined') {
      cfg[k] = changes[k].newValue;
      changed = true;
    }
  }
  if (changed) applyUI();
});