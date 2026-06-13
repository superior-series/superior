'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function showStatus(msg, type) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.className = 'status-msg visible ' + (type || 'info');
}

function clearStatus() {
  const el = document.getElementById('status-msg');
  el.className = 'status-msg';
  el.textContent = '';
}

function showSettingsMsg(msg, type) {
  const el = document.getElementById('settings-msg');
  el.textContent = msg;
  el.className = 'settings-msg ' + (type || '');
  if (msg) setTimeout(() => { el.textContent = ''; el.className = 'settings-msg'; }, 3000);
}

// ---------------------------------------------------------------------------
// Data table
// ---------------------------------------------------------------------------

let selectedIndices = new Set();

async function loadData() {
  const tbody = document.getElementById('data-tbody');
  try {
    const res = await fetch('/api/data');
    const { rows, total } = await res.json();

    selectedIndices.clear();
    updateDeleteBtn();

    const caption = document.getElementById('data-caption');
    if (total === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">まだデータがありません。上で取得を実行するとここに表示されます。</td></tr>';
      caption.textContent = '';
      document.getElementById('check-all').checked = false;
      return;
    }

    caption.textContent = `最新 ${Math.min(rows.length, 10)} 件を表示（全 ${total} 件）`;
    document.getElementById('check-all').checked = false;

    tbody.innerHTML = '';
    rows.forEach(row => {
      const tr = document.createElement('tr');
      tr.dataset.idx = row.idx;

      const urlText = row.image_url;
      const urlShort = urlText.length > 60 ? urlText.slice(0, 60) + '…' : urlText;

      // checkbox cell
      const tdCheck = document.createElement('td');
      tdCheck.className = 'col-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.idx = row.idx;
      cb.addEventListener('change', onRowCheck);
      tdCheck.appendChild(cb);
      tr.appendChild(tdCheck);

      // data cells (text only — no innerHTML for user data)
      [row.date, row.source, row.keyword].forEach(val => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });

      // URL cell — anchor
      const tdUrl = document.createElement('td');
      tdUrl.className = 'col-url';
      if (urlText.startsWith('http')) {
        const a = document.createElement('a');
        a.href = urlText;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = urlText;
        a.textContent = urlShort;
        tdUrl.appendChild(a);
      } else {
        tdUrl.textContent = urlText;
      }
      tr.appendChild(tdUrl);

      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">データの読み込みに失敗しました。</td></tr>';
  }
}

function onRowCheck(e) {
  const idx = Number(e.target.dataset.idx);
  const tr = e.target.closest('tr');
  if (e.target.checked) {
    selectedIndices.add(idx);
    tr.classList.add('selected');
  } else {
    selectedIndices.delete(idx);
    tr.classList.remove('selected');
  }
  updateDeleteBtn();
  syncCheckAll();
}

function syncCheckAll() {
  const all = document.querySelectorAll('#data-tbody input[type="checkbox"]');
  const allChecked = all.length > 0 && [...all].every(cb => cb.checked);
  document.getElementById('check-all').checked = allChecked;
}

document.getElementById('check-all').addEventListener('change', (e) => {
  const all = document.querySelectorAll('#data-tbody input[type="checkbox"]');
  selectedIndices.clear();
  all.forEach(cb => {
    cb.checked = e.target.checked;
    const tr = cb.closest('tr');
    if (e.target.checked) {
      selectedIndices.add(Number(cb.dataset.idx));
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });
  updateDeleteBtn();
});

function updateDeleteBtn() {
  const btn = document.getElementById('delete-btn');
  btn.disabled = selectedIndices.size === 0;
}

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

document.getElementById('collect-btn').addEventListener('click', async () => {
  const keyword = document.getElementById('keyword').value.trim();
  const limit   = document.getElementById('limit').value;
  const source  = document.querySelector('input[name="source"]:checked')?.value;

  if (!keyword) {
    showStatus('キーワードを入力してください。', 'error');
    document.getElementById('keyword').focus();
    return;
  }

  const btn = document.getElementById('collect-btn');
  btn.disabled = true;
  btn.classList.add('btn--loading');
  clearStatus();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000); // 3分タイムアウト

  try {
    const res = await fetch('/api/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, limit: Number(limit), source }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();

    if (data.ok) {
      showStatus(data.message, data.count > 0 ? 'success' : 'info');
      await loadData();
    } else {
      showStatus(data.message, 'error');
    }
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      showStatus('取得がタイムアウトしました。件数を減らして再試行してください。', 'error');
    } else {
      showStatus('通信エラーが発生しました。', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn--loading');
  }
});

document.getElementById('keyword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') e.preventDefault();
});

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

document.getElementById('delete-btn').addEventListener('click', async () => {
  if (selectedIndices.size === 0) return;
  const indices = [...selectedIndices];

  const btn = document.getElementById('delete-btn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indices }),
    });
    const data = await res.json();
    if (data.ok) {
      await loadData();
    } else {
      alert(data.message || '削除に失敗しました。');
      btn.disabled = false;
    }
  } catch (e) {
    alert('通信エラーが発生しました。');
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------

const modal = document.getElementById('settings-modal');

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();

    // Unsplash
    const uWrap = document.getElementById('key-current-wrap');
    const uMasked = document.getElementById('key-masked');
    if (data.unsplash && data.unsplash.set) {
      uMasked.textContent = data.unsplash.masked;
      uWrap.style.display = 'flex';
    } else {
      uWrap.style.display = 'none';
    }

    // Pexels
    const pWrap = document.getElementById('pexels-key-current-wrap');
    const pMasked = document.getElementById('pexels-key-masked');
    if (data.pexels && data.pexels.set) {
      pMasked.textContent = data.pexels.masked;
      pWrap.style.display = 'flex';
    } else {
      pWrap.style.display = 'none';
    }
  } catch (_) {}
}

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('key-input').value = '';
  document.getElementById('pexels-key-input').value = '';
  showSettingsMsg('');
  loadConfig();
  modal.classList.add('open');
});

function closeModal() { modal.classList.remove('open'); }

document.getElementById('settings-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// --- 汎用キー保存ヘルパー ---
async function saveApiKey(service, inputId, maskedId, wrapId) {
  const key = document.getElementById(inputId).value.trim();
  if (!key) { showSettingsMsg('APIキーを入力してください。', 'error'); return; }
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, api_key: key }),
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById(inputId).value = '';
      document.getElementById(maskedId).textContent = data.masked;
      document.getElementById(wrapId).style.display = 'flex';
      showSettingsMsg('保存しました。', 'success');
    } else {
      showSettingsMsg(data.message || '保存に失敗しました。', 'error');
    }
  } catch (_) { showSettingsMsg('通信エラーが発生しました。', 'error'); }
}

async function clearApiKey(endpoint, inputId, maskedId, wrapId) {
  try {
    await fetch(endpoint, { method: 'DELETE' });
    document.getElementById(wrapId).style.display = 'none';
    document.getElementById(maskedId).textContent = '';
    document.getElementById(inputId).value = '';
    showSettingsMsg('クリアしました。', 'success');
  } catch (_) { showSettingsMsg('通信エラーが発生しました。', 'error'); }
}

// Unsplash
document.getElementById('key-save-btn').addEventListener('click', () =>
  saveApiKey('unsplash', 'key-input', 'key-masked', 'key-current-wrap'));
document.getElementById('key-clear-btn').addEventListener('click', () =>
  clearApiKey('/api/config/unsplash_key', 'key-input', 'key-masked', 'key-current-wrap'));

// Pexels
document.getElementById('pexels-key-save-btn').addEventListener('click', () =>
  saveApiKey('pexels', 'pexels-key-input', 'pexels-key-masked', 'pexels-key-current-wrap'));
document.getElementById('pexels-key-clear-btn').addEventListener('click', () =>
  clearApiKey('/api/config/pexels_key', 'pexels-key-input', 'pexels-key-masked', 'pexels-key-current-wrap'));

// ---------------------------------------------------------------------------
// Image download
// ---------------------------------------------------------------------------

async function downloadImage(url, keyword, rowNum) {
  const res = await fetch('/api/download-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, keyword, row_num: rowNum }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '取得失敗');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
  const filename = nameMatch ? decodeURIComponent(nameMatch[1]) : 'image.jpg';

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

document.getElementById('download-images-btn').addEventListener('click', async () => {
  if (selectedIndices.size === 0) {
    alert('ダウンロードする行を選択してください。');
    return;
  }

  const toDownload = [];
  document.querySelectorAll('#data-tbody tr').forEach((tr, i) => {
    const idx = Number(tr.dataset.idx);
    if (selectedIndices.has(idx)) {
      const a = tr.querySelector('td.col-url a');
      const keyword = tr.cells[3] ? tr.cells[3].textContent : '';
      if (a) toDownload.push({ url: a.href, keyword, rowNum: i + 1 });
    }
  });

  if (toDownload.length === 0) return;

  const btn = document.getElementById('download-images-btn');
  btn.disabled = true;
  btn.classList.add('btn--loading');

  let failed = 0;
  try {
    for (const { url, keyword, rowNum } of toDownload) {
      try {
        await downloadImage(url, keyword, rowNum);
      } catch (_) {
        failed++;
      }
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn--loading');
  }

  if (failed > 0) {
    alert(`${failed} 件の画像のダウンロードに失敗しました。`);
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadData();
loadConfig();
