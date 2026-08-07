const loginScreen = document.getElementById('loginScreen');
const adminScreen = document.getElementById('adminScreen');

// ---------- tema (mesmo comportamento da pagina publica) ----------
const THEME_KEY = 'acesso-rapido-theme';
const root = document.documentElement;

function wireThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  if (!themeToggle) return;

  const SUN_PATH = '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>';
  const MOON_PATH = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

  function applyIcon(theme) {
    themeIcon.innerHTML = theme === 'dark' ? MOON_PATH : SUN_PATH;
  }
  applyIcon(root.getAttribute('data-theme') || 'dark');

  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    applyIcon(next);
  });
}
wireThemeToggle();

// ---------- checagem de sessao ----------
async function checkSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.isAdmin) {
    loginScreen.style.display = 'none';
    adminScreen.style.display = 'block';
    loadTileList();
    loadAlertList();
    loadStats();
    loadGroupList().then(loadUserList);
  } else {
    loginScreen.style.display = 'flex';
    adminScreen.style.display = 'none';
  }
}

// ---------- navegacao lateral por categorias ----------
document.querySelectorAll('.sidebar-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-category').forEach(sec => sec.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('cat-' + btn.dataset.category).style.display = 'block';
  });
});

// ---------- login ----------
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.remove('show');
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      loginError.textContent = data.error || 'Falha ao entrar';
      loginError.classList.add('show');
      return;
    }
    checkSession();
  } catch (err) {
    loginError.textContent = 'Erro de conexão. Tente novamente.';
    loginError.classList.add('show');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  checkSession();
});

// ---------- formulario de tile (criar/editar) ----------
const tileForm = document.getElementById('tileForm');
const tileIdInput = document.getElementById('tileId');
const titleInput = document.getElementById('title');
const urlInput = document.getElementById('url');
const tagChipsEl = document.getElementById('tagChips');
const tagsInputField = document.getElementById('tagsInputField');
let currentTags = [];

function renderTagChips() {
  tagChipsEl.innerHTML = '';
  currentTags.forEach((tag, index) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    const label = document.createElement('span');
    label.textContent = tag;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      currentTags.splice(index, 1);
      renderTagChips();
    });
    chip.appendChild(label);
    chip.appendChild(removeBtn);
    tagChipsEl.appendChild(chip);
  });
}

function addTagFromInput() {
  const value = tagsInputField.value.trim().replace(/,$/, '').trim();
  if (!value) return;
  if (!currentTags.some(t => t.toLowerCase() === value.toLowerCase())) {
    currentTags.push(value);
    renderTagChips();
  }
  tagsInputField.value = '';
}

tagsInputField.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTagFromInput();
  } else if (e.key === 'Backspace' && !tagsInputField.value && currentTags.length) {
    currentTags.pop();
    renderTagChips();
  }
});
tagsInputField.addEventListener('blur', addTagFromInput);
const imageFileInput = document.getElementById('imageFile');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const formSuccess = document.getElementById('formSuccess');
const formError = document.getElementById('formError');

let currentImageUrl = null; // imagem ja salva (ao editar)
let removeImageFlag = false;

imageFileInput.addEventListener('change', () => {
  const file = imageFileInput.files[0];
  if (!file) return;
  removeImageFlag = false;
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.innerHTML = `<img src="${reader.result}" alt="preview">`;
    removeImageBtn.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
});

removeImageBtn.addEventListener('click', () => {
  imageFileInput.value = '';
  imagePreview.innerHTML = '—';
  removeImageBtn.style.display = 'none';
  removeImageFlag = true;
  currentImageUrl = null;
});

function resetForm() {
  tileForm.reset();
  tileIdInput.value = '';
  currentTags = [];
  renderTagChips();
  tagsInputField.value = '';
  imagePreview.innerHTML = '—';
  removeImageBtn.style.display = 'none';
  currentImageUrl = null;
  removeImageFlag = false;
  formTitle.textContent = 'Adicionar novo acesso';
  cancelEditBtn.style.display = 'none';
}

cancelEditBtn.addEventListener('click', resetForm);

function showFormSuccess(msg) {
  formSuccess.textContent = msg;
  formSuccess.classList.add('show');
  formError.classList.remove('show');
  setTimeout(() => formSuccess.classList.remove('show'), 2500);
}
function showFormError(msg) {
  formError.textContent = msg;
  formError.classList.add('show');
  formSuccess.classList.remove('show');
}

tileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('show');

  const id = tileIdInput.value;
  const formData = new FormData();
  formData.append('title', titleInput.value.trim());
  formData.append('url', urlInput.value.trim());
  addTagFromInput(); // garante que algo digitado e nao confirmado tambem seja salvo
  formData.append('tags', JSON.stringify(currentTags));

  if (imageFileInput.files[0]) {
    formData.append('image', imageFileInput.files[0]);
  } else if (removeImageFlag) {
    formData.append('removeImage', 'true');
  }

  try {
    const res = await fetch(id ? `/api/tiles/${id}` : '/api/tiles', {
      method: id ? 'PUT' : 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      showFormError(data.error || 'Erro ao salvar');
      return;
    }
    showFormSuccess(id ? 'Acesso atualizado!' : 'Acesso adicionado!');
    resetForm();
    loadTileList();
  } catch (err) {
    showFormError('Erro de conexão ao salvar.');
  }
});

// ---------- lista de tiles ----------
const tileList = document.getElementById('tileList');
let tilesCache = [];

function iconSvg(name) {
  const icons = {
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"></path>',
    trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    up: '<polyline points="18 15 12 9 6 15"></polyline>',
    down: '<polyline points="6 9 12 15 18 9"></polyline>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

let linkStatusCache = {};

function linkStatusDot(tileId) {
  const s = linkStatusCache[tileId];
  if (!s) return '<span class="link-dot link-dot-unknown" title="Ainda não verificado"></span>';
  if (s.status === 'ok') return `<span class="link-dot link-dot-ok" title="Link OK (${s.httpStatus})"></span>`;
  return `<span class="link-dot link-dot-broken" title="Link pode estar fora do ar${s.httpStatus ? ' (' + s.httpStatus + ')' : ''}"></span>`;
}

function renderTileList() {
  tileList.innerHTML = '';
  if (!tilesCache.length) {
    tileList.innerHTML = '<div class="empty-admin">Nenhum acesso cadastrado ainda. Use o formulário acima para adicionar o primeiro.</div>';
    return;
  }

  tilesCache.forEach((tile, index) => {
    const row = document.createElement('div');
    row.className = 'tile-row';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.innerHTML = tile.image
      ? `<img src="${tile.image}" alt="${tile.title}">`
      : (tile.title || '?').slice(0, 2).toUpperCase();

    if (tile.image) {
      window.autoTrimImage(tile.image).then((trimmedUrl) => {
        if (trimmedUrl) {
          const imgEl = thumb.querySelector('img');
          if (imgEl) imgEl.src = trimmedUrl;
        }
      });
    }

    const info = document.createElement('div');
    info.className = 'info';
    const tagsHtml = (tile.tags && tile.tags.length)
      ? `<div class="t-url">🏷️ ${escapeHtml(tile.tags.join(', '))}</div>`
      : '';
    info.innerHTML = `<div class="t-title">${linkStatusDot(tile.id)}${escapeHtml(tile.title)}</div><div class="t-url">${escapeHtml(tile.url)}</div>${tagsHtml}`;

    const moveBtns = document.createElement('div');
    moveBtns.className = 'move-btns';
    const upBtn = document.createElement('button');
    upBtn.innerHTML = iconSvg('up');
    upBtn.title = 'Mover para cima';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveTile(index, -1));
    const downBtn = document.createElement('button');
    downBtn.innerHTML = iconSvg('down');
    downBtn.title = 'Mover para baixo';
    downBtn.disabled = index === tilesCache.length - 1;
    downBtn.addEventListener('click', () => moveTile(index, 1));
    moveBtns.appendChild(upBtn);
    moveBtns.appendChild(downBtn);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = iconSvg('edit');
    editBtn.title = 'Editar';
    editBtn.addEventListener('click', () => editTile(tile));

    const delBtn = document.createElement('button');
    delBtn.innerHTML = iconSvg('trash');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => deleteTile(tile));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(moveBtns);
    row.appendChild(actions);
    tileList.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadTileList() {
  const res = await fetch('/api/tiles');
  tilesCache = await res.json();
  tilesCache.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  try {
    const statusRes = await fetch('/api/tiles/link-status');
    linkStatusCache = await statusRes.json();
  } catch (e) { /* ignora */ }
  renderTileList();
}

const checkLinksBtn = document.getElementById('checkLinksBtn');
const linkCheckHint = document.getElementById('linkCheckHint');
checkLinksBtn.addEventListener('click', async () => {
  checkLinksBtn.disabled = true;
  checkLinksBtn.textContent = 'Verificando...';
  linkCheckHint.textContent = 'Isso pode levar alguns segundos, dependendo de quantos acessos você tem.';
  try {
    const res = await fetch('/api/tiles/check-links', { method: 'POST' });
    linkStatusCache = await res.json();
    renderTileList();
    const brokenCount = Object.values(linkStatusCache).filter(s => s.status === 'broken').length;
    linkCheckHint.textContent = brokenCount
      ? `Verificação concluída: ${brokenCount} link(s) parecem fora do ar.`
      : 'Verificação concluída: todos os links responderam normalmente.';
  } catch (e) {
    linkCheckHint.textContent = 'Não foi possível verificar os links agora.';
  }
  checkLinksBtn.disabled = false;
  checkLinksBtn.textContent = 'Verificar links';
});

function editTile(tile) {
  tileIdInput.value = tile.id;
  titleInput.value = tile.title;
  urlInput.value = tile.url;
  currentTags = [...(tile.tags || [])];
  renderTagChips();
  tagsInputField.value = '';
  currentImageUrl = tile.image;
  removeImageFlag = false;
  imageFileInput.value = '';
  imagePreview.innerHTML = tile.image ? `<img src="${tile.image}" alt="preview">` : '—';
  removeImageBtn.style.display = tile.image ? 'inline-flex' : 'none';
  formTitle.textContent = 'Editar acesso';
  cancelEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteTile(tile) {
  if (!confirm(`Excluir "${tile.title}"?`)) return;
  await fetch(`/api/tiles/${tile.id}`, { method: 'DELETE' });
  loadTileList();
}

async function moveTile(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= tilesCache.length) return;
  const arr = [...tilesCache];
  [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
  tilesCache = arr;
  renderTileList();
  await fetch('/api/tiles/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: arr.map(t => t.id) })
  });
}

// =====================================================
// ALERTAS
// =====================================================
const alertForm = document.getElementById('alertForm');
const alertIdInput = document.getElementById('alertId');
const alertTitleInput = document.getElementById('alertTitle');
const alertTypeInput = document.getElementById('alertType');
const alertMessageInput = document.getElementById('alertMessage');
const alertStartAtInput = document.getElementById('alertStartAt');
const alertEndAtInput = document.getElementById('alertEndAt');
const alertActiveSwitch = document.getElementById('alertActiveSwitch');
const alertFormTitleEl = document.getElementById('alertFormTitle');
const alertFormSuccess = document.getElementById('alertFormSuccess');
const alertFormError = document.getElementById('alertFormError');
const cancelAlertEditBtn = document.getElementById('cancelAlertEditBtn');
const alertListEl = document.getElementById('alertList');

let alertActive = true;
let alertsCache = [];

alertActiveSwitch.classList.add('on');
alertActiveSwitch.addEventListener('click', () => {
  alertActive = !alertActive;
  alertActiveSwitch.classList.toggle('on', alertActive);
});

function resetAlertForm() {
  alertForm.reset();
  alertIdInput.value = '';
  alertActive = true;
  alertActiveSwitch.classList.add('on');
  alertFormTitleEl.textContent = 'Adicionar novo alerta';
  cancelAlertEditBtn.style.display = 'none';
}
cancelAlertEditBtn.addEventListener('click', resetAlertForm);

function showAlertFormSuccess(msg) {
  alertFormSuccess.textContent = msg;
  alertFormSuccess.classList.add('show');
  alertFormError.classList.remove('show');
  setTimeout(() => alertFormSuccess.classList.remove('show'), 2500);
}
function showAlertFormError(msg) {
  alertFormError.textContent = msg;
  alertFormError.classList.add('show');
  alertFormSuccess.classList.remove('show');
}

alertForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertFormError.classList.remove('show');

  const id = alertIdInput.value;
  const payload = {
    title: alertTitleInput.value.trim(),
    type: alertTypeInput.value,
    message: alertMessageInput.value.trim(),
    startAt: alertStartAtInput.value || null,
    endAt: alertEndAtInput.value || null,
    active: alertActive
  };

  try {
    const res = await fetch(id ? `/api/alerts/${id}` : '/api/alerts', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showAlertFormError(data.error || 'Erro ao salvar alerta');
      return;
    }
    showAlertFormSuccess(id ? 'Alerta atualizado!' : 'Alerta criado!');
    resetAlertForm();
    loadAlertList();
  } catch (err) {
    showAlertFormError('Erro de conexão ao salvar.');
  }
});

const ALERT_TYPE_LABELS = {
  info: 'Informação',
  warning: 'Aviso',
  danger: 'Crítico',
  success: 'Sucesso'
};

function formatAlertSchedule(alert) {
  if (!alert.startAt && !alert.endAt) return '';
  const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (alert.startAt && alert.endAt) return `⏰ ${fmt(alert.startAt)} até ${fmt(alert.endAt)}`;
  if (alert.startAt) return `⏰ a partir de ${fmt(alert.startAt)}`;
  return `⏰ até ${fmt(alert.endAt)}`;
}

function renderAlertList() {
  alertListEl.innerHTML = '';
  if (!alertsCache.length) {
    alertListEl.innerHTML = '<div class="empty-admin">Nenhum alerta cadastrado ainda.</div>';
    return;
  }

  alertsCache.forEach((alert) => {
    const row = document.createElement('div');
    row.className = 'tile-row' + (alert.active ? '' : ' alert-row-inactive');

    const dot = document.createElement('div');
    dot.className = `alert-type-dot alert-badge-${alert.type}`;

    const info = document.createElement('div');
    info.className = 'info';
    const scheduleText = formatAlertSchedule(alert);
    const ackText = alert.ackCount ? `👍 ${alert.ackCount} confirmação${alert.ackCount === 1 ? '' : 'ões'}` : '';
    const metaParts = [scheduleText, ackText].filter(Boolean).join(' · ');
    info.innerHTML = `<div class="t-title">${alert.title ? escapeHtml(alert.title) + ' — ' : ''}${ALERT_TYPE_LABELS[alert.type] || 'Informação'}${alert.active ? '' : ' (desativado)'}</div><div class="t-url">${escapeHtml(alert.message)}</div>${metaParts ? `<div class="t-url">${escapeHtml(metaParts)}</div>` : ''}`;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-secondary';
    toggleBtn.style.flexShrink = '0';
    toggleBtn.textContent = alert.active ? 'Desativar' : 'Ativar';
    toggleBtn.addEventListener('click', () => toggleAlertActive(alert));

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = iconSvg('edit');
    editBtn.title = 'Editar';
    editBtn.addEventListener('click', () => editAlert(alert));

    const delBtn = document.createElement('button');
    delBtn.innerHTML = iconSvg('trash');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => deleteAlert(alert));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(dot);
    row.appendChild(info);
    row.appendChild(toggleBtn);
    row.appendChild(actions);
    alertListEl.appendChild(row);
  });
}

async function loadAlertList() {
  const res = await fetch('/api/alerts/all');
  alertsCache = await res.json();
  alertsCache.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  renderAlertList();
}

function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function editAlert(alert) {
  alertIdInput.value = alert.id;
  alertTitleInput.value = alert.title || '';
  alertTypeInput.value = alert.type;
  alertMessageInput.value = alert.message;
  alertStartAtInput.value = toDatetimeLocalValue(alert.startAt);
  alertEndAtInput.value = toDatetimeLocalValue(alert.endAt);
  alertActive = alert.active;
  alertActiveSwitch.classList.toggle('on', alertActive);
  alertFormTitleEl.textContent = 'Editar alerta';
  cancelAlertEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function toggleAlertActive(alert) {
  await fetch(`/api/alerts/${alert.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !alert.active })
  });
  loadAlertList();
}

async function deleteAlert(alert) {
  if (!confirm('Excluir este alerta?')) return;
  await fetch(`/api/alerts/${alert.id}`, { method: 'DELETE' });
  loadAlertList();
}

// =====================================================
// ESTATISTICAS (ranking + historico de cliques + buscas)
// =====================================================
function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function loadStats() {
  try {
    const [clicksRes, searchesRes, dailyRes] = await Promise.all([
      fetch('/api/track/clicks'),
      fetch('/api/track/searches'),
      fetch('/api/track/clicks/daily')
    ]);
    const clicksData = await clicksRes.json();
    const searches = await searchesRes.json();
    const daily = await dailyRes.json();

    renderRanking(clicksData.ranking || []);
    renderClicksHistory(clicksData.history || []);
    renderSearchesHistory(searches || []);
    renderClicksChart(daily || []);
  } catch (e) {
    // estatisticas nao sao criticas, ignora silenciosamente
  }
}

function renderClicksChart(daily) {
  const canvas = document.getElementById('clicksChart');
  if (!canvas || !daily.length) return;

  // ajusta a resolucao do canvas ao tamanho real exibido (fica nitido em telas retina)
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
  const displayHeight = 180;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.height = displayHeight + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const styles = getComputedStyle(document.documentElement);
  const accent1 = styles.getPropertyValue('--accent-1').trim() || '#34C7E8';
  const accent2 = styles.getPropertyValue('--accent-2').trim() || '#2E6FE0';
  const textMuted = styles.getPropertyValue('--text-muted').trim() || '#8A9BB5';
  const border = styles.getPropertyValue('--border').trim() || '#22314F';

  const paddingLeft = 8;
  const paddingRight = 8;
  const paddingBottom = 24;
  const paddingTop = 10;
  const chartW = displayWidth - paddingLeft - paddingRight;
  const chartH = displayHeight - paddingTop - paddingBottom;

  const maxCount = Math.max(1, ...daily.map(d => d.count));
  const barGap = 6;
  const barW = (chartW / daily.length) - barGap;

  const gradient = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartH);
  gradient.addColorStop(0, accent1);
  gradient.addColorStop(1, accent2);

  // linha de base
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH);
  ctx.lineTo(paddingLeft + chartW, paddingTop + chartH);
  ctx.stroke();

  daily.forEach((d, i) => {
    const x = paddingLeft + i * (barW + barGap);
    const h = (d.count / maxCount) * (chartH - 6);
    const y = paddingTop + chartH - h;

    ctx.fillStyle = d.count > 0 ? gradient : 'rgba(138,155,181,0.15)';
    const radius = Math.min(4, barW / 2);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, Math.max(barW, 1), Math.max(h, 2), radius);
    } else {
      ctx.rect(x, y, Math.max(barW, 1), Math.max(h, 2));
    }
    ctx.fill();

    // rotulo do dia (so mostra a cada 2 dias pra nao poluir)
    if (i % 2 === 0) {
      const d2 = new Date(d.date + 'T00:00:00');
      const label = `${String(d2.getDate()).padStart(2, '0')}/${String(d2.getMonth() + 1).padStart(2, '0')}`;
      ctx.fillStyle = textMuted;
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, displayHeight - 8);
    }
  });
}

function renderRanking(ranking) {
  const el = document.getElementById('rankingList');
  if (!ranking.length) {
    el.innerHTML = '<div class="empty-admin">Ainda não há cliques registrados.</div>';
    return;
  }
  el.innerHTML = '';
  ranking.slice(0, 10).forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    row.innerHTML = `
      <div class="ranking-position">${index + 1}</div>
      <div class="ranking-title">${escapeHtml(item.tileTitle)}</div>
      <div class="ranking-count">${item.count} clique${item.count === 1 ? '' : 's'}</div>`;
    el.appendChild(row);
  });
}

function renderClicksHistory(history) {
  const el = document.getElementById('clicksHistoryList');
  if (!history.length) {
    el.innerHTML = '<div class="empty-admin">Nenhum clique registrado ainda.</div>';
    return;
  }
  el.innerHTML = '';
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <span class="history-text">Clique em <strong>${escapeHtml(item.tileTitle)}</strong></span>
      <span class="history-time">${formatDateTime(item.timestamp)}</span>`;
    el.appendChild(row);
  });
}

function renderSearchesHistory(searches) {
  const el = document.getElementById('searchesHistoryList');
  if (!searches.length) {
    el.innerHTML = '<div class="empty-admin">Nenhuma busca registrada ainda.</div>';
    return;
  }
  el.innerHTML = '';
  searches.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <span class="history-text">Buscou por "<strong>${escapeHtml(item.term)}</strong>"</span>
      <span class="history-time">${formatDateTime(item.timestamp)}</span>`;
    el.appendChild(row);
  });
}

// =====================================================
// GRUPOS (permissões: Painel Admin / Painel de TI)
// =====================================================
const groupForm = document.getElementById('groupForm');
const groupIdInput = document.getElementById('groupId');
const groupNameInput = document.getElementById('groupName');
const groupPermAdminSwitch = document.getElementById('groupPermAdminSwitch');
const groupPermTiSwitch = document.getElementById('groupPermTiSwitch');
const groupFormTitleEl = document.getElementById('groupFormTitle');
const groupFormSuccess = document.getElementById('groupFormSuccess');
const groupFormError = document.getElementById('groupFormError');
const cancelGroupEditBtn = document.getElementById('cancelGroupEditBtn');
const groupListEl = document.getElementById('groupList');

let groupsCache = [];
let groupPermAdmin = false;
let groupPermTi = false;

groupPermAdminSwitch.addEventListener('click', () => {
  groupPermAdmin = !groupPermAdmin;
  groupPermAdminSwitch.classList.toggle('on', groupPermAdmin);
});
groupPermTiSwitch.addEventListener('click', () => {
  groupPermTi = !groupPermTi;
  groupPermTiSwitch.classList.toggle('on', groupPermTi);
});

function resetGroupForm() {
  groupForm.reset();
  groupIdInput.value = '';
  groupPermAdmin = false;
  groupPermTi = false;
  groupPermAdminSwitch.classList.remove('on');
  groupPermTiSwitch.classList.remove('on');
  groupFormTitleEl.textContent = 'Adicionar novo grupo';
  cancelGroupEditBtn.style.display = 'none';
}
cancelGroupEditBtn.addEventListener('click', resetGroupForm);

function showGroupFormSuccess(msg) {
  groupFormSuccess.textContent = msg;
  groupFormSuccess.classList.add('show');
  groupFormError.classList.remove('show');
  setTimeout(() => groupFormSuccess.classList.remove('show'), 2500);
}
function showGroupFormError(msg) {
  groupFormError.textContent = msg;
  groupFormError.classList.add('show');
  groupFormSuccess.classList.remove('show');
}

groupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  groupFormError.classList.remove('show');
  const id = groupIdInput.value;
  const payload = {
    name: groupNameInput.value.trim(),
    permissions: { admin: groupPermAdmin, ti: groupPermTi }
  };
  try {
    const res = await fetch(id ? `/api/groups/${id}` : '/api/groups', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showGroupFormError(data.error || 'Erro ao salvar grupo');
      return;
    }
    showGroupFormSuccess(id ? 'Grupo atualizado!' : 'Grupo criado!');
    resetGroupForm();
    await loadGroupList();
    renderUserList(); // atualiza labels de grupo na lista de usuarios
  } catch (err) {
    showGroupFormError('Erro de conexão ao salvar.');
  }
});

function permissionsBadges(permissions) {
  const parts = [];
  if (permissions && permissions.admin) parts.push('Painel Admin');
  if (permissions && permissions.ti) parts.push('Painel de TI');
  return parts.length ? parts.join(' + ') : 'Sem permissões';
}

function renderGroupList() {
  groupListEl.innerHTML = '';
  if (!groupsCache.length) {
    groupListEl.innerHTML = '<div class="empty-admin">Nenhum grupo cadastrado.</div>';
    return;
  }
  groupsCache.forEach(group => {
    const row = document.createElement('div');
    row.className = 'tile-row';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<div class="t-title">${escapeHtml(group.name)}</div><div class="t-url">${escapeHtml(permissionsBadges(group.permissions))}</div>`;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.innerHTML = iconSvg('edit');
    editBtn.title = 'Editar';
    editBtn.addEventListener('click', () => editGroup(group));
    const delBtn = document.createElement('button');
    delBtn.innerHTML = iconSvg('trash');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => deleteGroup(group));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    groupListEl.appendChild(row);
  });
}

async function loadGroupList() {
  const res = await fetch('/api/groups');
  groupsCache = await res.json();
  renderGroupList();
  populateGroupSelect();
}

function populateGroupSelect() {
  const select = document.getElementById('userGroupId');
  const current = select.value;
  select.innerHTML = groupsCache.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  if (current) select.value = current;
}

function editGroup(group) {
  groupIdInput.value = group.id;
  groupNameInput.value = group.name;
  groupPermAdmin = !!(group.permissions && group.permissions.admin);
  groupPermTi = !!(group.permissions && group.permissions.ti);
  groupPermAdminSwitch.classList.toggle('on', groupPermAdmin);
  groupPermTiSwitch.classList.toggle('on', groupPermTi);
  groupFormTitleEl.textContent = 'Editar grupo';
  cancelGroupEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteGroup(group) {
  if (!confirm(`Excluir o grupo "${group.name}"?`)) return;
  const res = await fetch(`/api/groups/${group.id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Não foi possível excluir este grupo.');
    return;
  }
  loadGroupList();
}

// =====================================================
// USUARIOS (criar, editar, trocar senha, excluir)
// =====================================================
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userId');
const userUsernameInput = document.getElementById('userUsername');
const userGroupIdInput = document.getElementById('userGroupId');
const userPasswordInput = document.getElementById('userPassword');
const userPasswordHint = document.getElementById('userPasswordHint');
const userFormTitleEl = document.getElementById('userFormTitle');
const userFormSuccess = document.getElementById('userFormSuccess');
const userFormError = document.getElementById('userFormError');
const cancelUserEditBtn = document.getElementById('cancelUserEditBtn');
const userListEl = document.getElementById('userList');

let usersCache = [];

function resetUserForm() {
  userForm.reset();
  userIdInput.value = '';
  userPasswordInput.placeholder = 'Mínimo 4 caracteres';
  userPasswordInput.required = false;
  userPasswordHint.style.display = 'none';
  userFormTitleEl.textContent = 'Adicionar novo usuário';
  cancelUserEditBtn.style.display = 'none';
}
cancelUserEditBtn.addEventListener('click', resetUserForm);

function showUserFormSuccess(msg) {
  userFormSuccess.textContent = msg;
  userFormSuccess.classList.add('show');
  userFormError.classList.remove('show');
  setTimeout(() => userFormSuccess.classList.remove('show'), 2500);
}
function showUserFormError(msg) {
  userFormError.textContent = msg;
  userFormError.classList.add('show');
  userFormSuccess.classList.remove('show');
}

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  userFormError.classList.remove('show');

  const id = userIdInput.value;
  const payload = {
    username: userUsernameInput.value.trim(),
    groupId: userGroupIdInput.value
  };
  if (userPasswordInput.value) payload.password = userPasswordInput.value;

  if (!id && !payload.password) {
    showUserFormError('Defina uma senha para o novo usuário');
    return;
  }

  try {
    const res = await fetch(id ? `/api/users/${id}` : '/api/users', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showUserFormError(data.error || 'Erro ao salvar usuário');
      return;
    }
    showUserFormSuccess(id ? 'Usuário atualizado!' : 'Usuário criado!');
    resetUserForm();
    loadUserList();
  } catch (err) {
    showUserFormError('Erro de conexão ao salvar.');
  }
});

function groupNameById(groupId) {
  const g = groupsCache.find(g => g.id === groupId);
  return g ? g.name : '—';
}

function renderUserList() {
  userListEl.innerHTML = '';
  if (!usersCache.length) {
    userListEl.innerHTML = '<div class="empty-admin">Nenhum usuário cadastrado.</div>';
    return;
  }

  usersCache.forEach(user => {
    const row = document.createElement('div');
    row.className = 'tile-row';

    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `<div class="t-title">${escapeHtml(user.username)}</div><div class="t-url">${escapeHtml(groupNameById(user.groupId))}</div>`;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = iconSvg('edit');
    editBtn.title = 'Editar';
    editBtn.addEventListener('click', () => editUser(user));

    const delBtn = document.createElement('button');
    delBtn.innerHTML = iconSvg('trash');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => deleteUser(user));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);
    userListEl.appendChild(row);
  });
}

async function loadUserList() {
  const res = await fetch('/api/users');
  usersCache = await res.json();
  renderUserList();
}

function editUser(user) {
  userIdInput.value = user.id;
  userUsernameInput.value = user.username;
  userGroupIdInput.value = user.groupId;
  userPasswordInput.value = '';
  userPasswordInput.placeholder = 'Deixe em branco para manter a atual';
  userPasswordHint.style.display = 'block';
  userFormTitleEl.textContent = 'Editar usuário';
  cancelUserEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteUser(user) {
  if (!confirm(`Excluir o usuário "${user.username}"?`)) return;
  const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Não foi possível excluir este usuário.');
    return;
  }
  loadUserList();
}

checkSession();
