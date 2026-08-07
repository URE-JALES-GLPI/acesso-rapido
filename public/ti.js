// ---------- tema ----------
const THEME_KEY = 'acesso-rapido-theme';
const root = document.documentElement;

function wireThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  if (!themeToggle) return;
  const SUN_PATH = '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>';
  const MOON_PATH = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  function applyIcon(theme) { themeIcon.innerHTML = theme === 'dark' ? MOON_PATH : SUN_PATH; }
  applyIcon(root.getAttribute('data-theme') || 'light');
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    applyIcon(next);
  });
}
wireThemeToggle();

// ---------- helpers compartilhados ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function iconSvg(name) {
  const icons = {
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"></path>',
    trash: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

// ---------- elementos de tela ----------
const loginScreen = document.getElementById('loginScreen');
const tiScreen = document.getElementById('tiScreen');
const tiSplit = document.getElementById('tiSplit');

// ---------- botao de ferramenta (modo gerenciar) ----------
const manageToggleBtn = document.getElementById('manageToggleBtn');
manageToggleBtn.addEventListener('click', () => {
  const isOn = tiSplit.classList.toggle('manage-mode');
  manageToggleBtn.classList.toggle('active', isOn);
});

// ---------- sessao / login ----------
let mySessionGroupId = null;

async function checkSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.loggedIn && data.permissions && data.permissions.ti) {
    loginScreen.style.display = 'none';
    tiScreen.style.display = 'block';
    mySessionGroupId = data.groupId || null;
    loadTiTiles();
    loadNotes();
    loadNoteGroupsChecklist();
  } else {
    loginScreen.style.display = 'flex';
    tiScreen.style.display = 'none';
  }
}

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
    if (!data.permissions || !data.permissions.ti) {
      loginError.textContent = 'Este usuário não tem acesso à área de TI.';
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

// =====================================================
// ATALHOS DA TI
// =====================================================
const tiTileForm = document.getElementById('tiTileForm');
const tiTileIdInput = document.getElementById('tiTileId');
const tiTitleInput = document.getElementById('tiTitle');
const tiUrlInput = document.getElementById('tiUrl');
const tiImageFileInput = document.getElementById('tiImageFile');
const tiImagePreview = document.getElementById('tiImagePreview');
const tiRemoveImageBtn = document.getElementById('tiRemoveImageBtn');
const tiCancelEditBtn = document.getElementById('tiCancelEditBtn');
const tiTileFormTitle = document.getElementById('tiTileFormTitle');
const tiTileFormSuccess = document.getElementById('tiTileFormSuccess');
const tiTileFormError = document.getElementById('tiTileFormError');
const tiTileList = document.getElementById('tiTileList');

let tiTilesCache = [];
let tiRemoveImageFlag = false;

tiImageFileInput.addEventListener('change', () => {
  const file = tiImageFileInput.files[0];
  if (!file) return;
  tiRemoveImageFlag = false;
  const reader = new FileReader();
  reader.onload = () => {
    tiImagePreview.innerHTML = `<img src="${reader.result}" alt="preview">`;
    tiRemoveImageBtn.style.display = 'inline-flex';
  };
  reader.readAsDataURL(file);
});
tiRemoveImageBtn.addEventListener('click', () => {
  tiImageFileInput.value = '';
  tiImagePreview.innerHTML = '—';
  tiRemoveImageBtn.style.display = 'none';
  tiRemoveImageFlag = true;
});

function resetTiTileForm() {
  tiTileForm.reset();
  tiTileIdInput.value = '';
  tiImagePreview.innerHTML = '—';
  tiRemoveImageBtn.style.display = 'none';
  tiRemoveImageFlag = false;
  tiTileFormTitle.textContent = 'Adicionar novo site';
  tiCancelEditBtn.style.display = 'none';
}
tiCancelEditBtn.addEventListener('click', resetTiTileForm);

function showTiTileSuccess(msg) {
  tiTileFormSuccess.textContent = msg;
  tiTileFormSuccess.classList.add('show');
  tiTileFormError.classList.remove('show');
  setTimeout(() => tiTileFormSuccess.classList.remove('show'), 2500);
}
function showTiTileError(msg) {
  tiTileFormError.textContent = msg;
  tiTileFormError.classList.add('show');
  tiTileFormSuccess.classList.remove('show');
}

tiTileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  tiTileFormError.classList.remove('show');
  const id = tiTileIdInput.value;
  const formData = new FormData();
  formData.append('title', tiTitleInput.value.trim());
  formData.append('url', tiUrlInput.value.trim());
  if (tiImageFileInput.files[0]) {
    formData.append('image', tiImageFileInput.files[0]);
  } else if (tiRemoveImageFlag) {
    formData.append('removeImage', 'true');
  }
  try {
    const res = await fetch(id ? `/api/ti/tiles/${id}` : '/api/ti/tiles', {
      method: id ? 'PUT' : 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      showTiTileError(data.error || 'Erro ao salvar');
      return;
    }
    showTiTileSuccess(id ? 'Site atualizado!' : 'Site adicionado!');
    resetTiTileForm();
    loadTiTiles();
  } catch (err) {
    showTiTileError('Erro de conexão ao salvar.');
  }
});

let tiLinkStatusCache = {};

function tiLinkStatusDot(tileId) {
  const s = tiLinkStatusCache[tileId];
  if (!s) return '<span class="link-dot link-dot-unknown" title="Ainda não verificado"></span>';
  if (s.status === 'ok') return `<span class="link-dot link-dot-ok" title="Link OK (${s.httpStatus})"></span>`;
  return `<span class="link-dot link-dot-broken" title="Link pode estar fora do ar${s.httpStatus ? ' (' + s.httpStatus + ')' : ''}"></span>`;
}

function renderTiTileList() {
  tiTileList.innerHTML = '';
  if (!tiTilesCache.length) {
    tiTileList.innerHTML = '<div class="empty-admin">Nenhum site cadastrado ainda.</div>';
    return;
  }
  tiTilesCache.forEach(tile => {
    const row = document.createElement('div');
    row.className = 'tile-row';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.innerHTML = tile.image ? `<img src="${tile.image}" alt="${escapeHtml(tile.title)}">` : (tile.title || '?').slice(0, 2).toUpperCase();

    const info = document.createElement('a');
    info.className = 'info';
    info.href = tile.url;
    info.target = '_blank';
    info.rel = 'noopener noreferrer';
    info.style.textDecoration = 'none';
    info.style.color = 'inherit';
    info.innerHTML = `<div class="t-title">${tiLinkStatusDot(tile.id)}${escapeHtml(tile.title)}</div><div class="t-url">${escapeHtml(tile.url)}</div>`;
    info.addEventListener('click', () => {
      fetch('/api/ti/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId: tile.id }),
        keepalive: true
      }).catch(() => {});
    });

    const actions = document.createElement('div');
    actions.className = 'actions';
    const editBtn = document.createElement('button');
    editBtn.innerHTML = iconSvg('edit');
    editBtn.title = 'Editar';
    editBtn.addEventListener('click', () => editTiTile(tile));
    const delBtn = document.createElement('button');
    delBtn.innerHTML = iconSvg('trash');
    delBtn.title = 'Excluir';
    delBtn.addEventListener('click', () => deleteTiTile(tile));
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);
    tiTileList.appendChild(row);
  });
}

async function loadTiTiles() {
  const res = await fetch('/api/ti/tiles');
  tiTilesCache = await res.json();
  try {
    const statusRes = await fetch('/api/ti/tiles/link-status');
    tiLinkStatusCache = await statusRes.json();
  } catch (e) { /* ignora */ }
  renderTiTileGrid();
  renderTiTileList();
  loadTiStats();
}

document.getElementById('tiTileSearchInput').addEventListener('input', renderTiTileGrid);

const tiCheckLinksBtn = document.getElementById('tiCheckLinksBtn');
const tiLinkCheckHint = document.getElementById('tiLinkCheckHint');
tiCheckLinksBtn.addEventListener('click', async () => {
  tiCheckLinksBtn.disabled = true;
  tiCheckLinksBtn.textContent = 'Verificando...';
  tiLinkCheckHint.textContent = 'Isso pode levar alguns segundos.';
  try {
    const res = await fetch('/api/ti/tiles/check-links', { method: 'POST' });
    tiLinkStatusCache = await res.json();
    renderTiTileList();
    const brokenCount = Object.values(tiLinkStatusCache).filter(s => s.status === 'broken').length;
    tiLinkCheckHint.textContent = brokenCount
      ? `Verificação concluída: ${brokenCount} link(s) parecem fora do ar.`
      : 'Verificação concluída: todos os links responderam normalmente.';
  } catch (e) {
    tiLinkCheckHint.textContent = 'Não foi possível verificar os links agora.';
  }
  tiCheckLinksBtn.disabled = false;
  tiCheckLinksBtn.textContent = 'Verificar links';
});

function trackTiClick(tileId) {
  fetch('/api/ti/track/click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tileId }),
    keepalive: true
  }).catch(() => {});
}

function renderTiTileGrid() {
  const grid = document.getElementById('tiTileGrid');
  const term = (document.getElementById('tiTileSearchInput').value || '').trim().toLowerCase();
  const list = term ? tiTilesCache.filter(t => (t.title || '').toLowerCase().includes(term)) : tiTilesCache;

  grid.innerHTML = '';
  if (!tiTilesCache.length) {
    grid.innerHTML = '<div class="empty-state"><div class="big">Nenhum atalho cadastrado ainda</div><div>Clique na ferramenta no topo para adicionar o primeiro.</div></div>';
    return;
  }
  if (!list.length) {
    grid.innerHTML = '<div class="empty-state"><div class="big">Nenhum resultado encontrado</div></div>';
    return;
  }
  list.forEach(tile => {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = tile.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = tile.title;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'tile-image-wrap';
    if (tile.image) {
      const img = document.createElement('img');
      img.src = tile.image;
      img.alt = tile.title;
      img.loading = 'lazy';
      imageWrap.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'tile-fallback';
      fallback.textContent = (tile.title || '?').slice(0, 2).toUpperCase();
      imageWrap.appendChild(fallback);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.textContent = tile.title;

    a.appendChild(imageWrap);
    a.appendChild(titleEl);
    a.addEventListener('click', () => trackTiClick(tile.id));
    grid.appendChild(a);
  });
}

function formatDateTimeBr(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function loadTiStats() {
  try {
    const res = await fetch('/api/ti/track/clicks');
    const data = await res.json();
    renderTiRanking(data.ranking || []);
    renderTiClicksHistory(data.history || []);
  } catch (e) {
    // estatisticas nao sao criticas, ignora
  }
}

function renderTiRanking(ranking) {
  const el = document.getElementById('tiRankingList');
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

function renderTiClicksHistory(history) {
  const el = document.getElementById('tiClicksHistoryList');
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
      <span class="history-time">${formatDateTimeBr(item.timestamp)}</span>`;
    el.appendChild(row);
  });
}

function editTiTile(tile) {
  tiTileIdInput.value = tile.id;
  tiTitleInput.value = tile.title;
  tiUrlInput.value = tile.url;
  tiImageFileInput.value = '';
  tiImagePreview.innerHTML = tile.image ? `<img src="${tile.image}" alt="preview">` : '—';
  tiRemoveImageBtn.style.display = tile.image ? 'inline-flex' : 'none';
  tiRemoveImageFlag = false;
  tiTileFormTitle.textContent = 'Editar site';
  tiCancelEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteTiTile(tile) {
  if (!confirm(`Excluir "${tile.title}"?`)) return;
  await fetch(`/api/ti/tiles/${tile.id}`, { method: 'DELETE' });
  loadTiTiles();
}

// =====================================================
// ANOTACOES (bloco de notas com anexos)
// =====================================================
const noteForm = document.getElementById('noteForm');
const noteIdInput = document.getElementById('noteId');
const noteTitleInput = document.getElementById('noteTitle');
const noteContentInput = document.getElementById('noteContent');
const noteFilesInput = document.getElementById('noteFiles');
const notePendingFiles = document.getElementById('notePendingFiles');
const existingAttachmentsEl = document.getElementById('existingAttachments');
const noteFormTitle = document.getElementById('noteFormTitle');
const noteFormSuccess = document.getElementById('noteFormSuccess');
const noteFormError = document.getElementById('noteFormError');
const noteCancelEditBtn = document.getElementById('noteCancelEditBtn');
const notesListEl = document.getElementById('notesList');

let notesCache = [];
let removeAttachmentIds = [];
let ti_groupsCache = [];

async function loadNoteGroupsChecklist() {
  try {
    const res = await fetch('/api/ti/groups');
    ti_groupsCache = await res.json();
    const el = document.getElementById('noteGroupsChecklist');
    if (!ti_groupsCache.length) {
      el.innerHTML = '<div class="hint">Nenhum outro grupo com acesso à TI além do seu.</div>';
      return;
    }
    el.innerHTML = ti_groupsCache.map(g => `
      <label>
        <input type="checkbox" class="note-group-checkbox" value="${g.id}">
        <span>${escapeHtml(g.name)}</span>
      </label>`).join('');
  } catch (e) {
    // ignora silenciosamente
  }
}

function getSelectedGroupIds() {
  return Array.from(document.querySelectorAll('.note-group-checkbox:checked')).map(cb => cb.value);
}
function setSelectedGroupIds(ids) {
  document.querySelectorAll('.note-group-checkbox').forEach(cb => {
    cb.checked = (ids || []).includes(cb.value);
  });
}

noteFilesInput.addEventListener('change', () => {
  const files = Array.from(noteFilesInput.files);
  notePendingFiles.textContent = files.length ? `${files.length} arquivo(s) selecionado(s): ${files.map(f => f.name).join(', ')}` : '';
});

function resetNoteForm() {
  noteForm.reset();
  noteIdInput.value = '';
  notePendingFiles.textContent = '';
  existingAttachmentsEl.innerHTML = '';
  removeAttachmentIds = [];
  setSelectedGroupIds([]);
  noteFormTitle.textContent = 'Nova anotação';
  noteCancelEditBtn.style.display = 'none';
}
noteCancelEditBtn.addEventListener('click', resetNoteForm);

function showNoteSuccess(msg) {
  noteFormSuccess.textContent = msg;
  noteFormSuccess.classList.add('show');
  noteFormError.classList.remove('show');
  setTimeout(() => noteFormSuccess.classList.remove('show'), 2500);
}
function showNoteError(msg) {
  noteFormError.textContent = msg;
  noteFormError.classList.add('show');
  noteFormSuccess.classList.remove('show');
}

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  noteFormError.classList.remove('show');
  const id = noteIdInput.value;
  const formData = new FormData();
  formData.append('title', noteTitleInput.value.trim());
  formData.append('content', noteContentInput.value.trim());
  formData.append('visibleGroupIds', JSON.stringify(getSelectedGroupIds()));
  Array.from(noteFilesInput.files).forEach(file => formData.append('attachments', file));
  if (removeAttachmentIds.length) formData.append('removeAttachmentIds', JSON.stringify(removeAttachmentIds));

  try {
    const res = await fetch(id ? `/api/ti/notes/${id}` : '/api/ti/notes', {
      method: id ? 'PUT' : 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      showNoteError(data.error || 'Erro ao salvar anotação');
      return;
    }
    showNoteSuccess(id ? 'Anotação atualizada!' : 'Anotação criada!');
    resetNoteForm();
    loadNotes();
  } catch (err) {
    showNoteError('Erro de conexão ao salvar.');
  }
});

function attachmentPreviewHtml(att, removable) {
  const removeBtn = removable ? `<button type="button" class="attachment-remove" data-id="${att.id}">×</button>` : '';
  if (att.type === 'image') {
    return `<div class="attachment-item">${removeBtn}<img src="${att.url}" alt="${escapeHtml(att.originalName)}"><div class="attachment-name">${escapeHtml(att.originalName)}</div></div>`;
  }
  if (att.type === 'video') {
    return `<div class="attachment-item">${removeBtn}<video src="${att.url}" controls></video><div class="attachment-name">${escapeHtml(att.originalName)}</div></div>`;
  }
  return `<div class="attachment-item attachment-file">${removeBtn}<a href="${att.url}" target="_blank" rel="noopener noreferrer">📄 ${escapeHtml(att.originalName)}</a></div>`;
}

function groupNamesForNote(note) {
  if (!note.visibleGroupIds || !note.visibleGroupIds.length) return 'Visível para todos os grupos com acesso à TI';
  const names = note.visibleGroupIds.map(id => {
    const g = ti_groupsCache.find(g => g.id === id);
    return g ? g.name : null;
  }).filter(Boolean);
  return names.length ? 'Visível para: ' + names.join(', ') : 'Visível para todos os grupos com acesso à TI';
}

const expandedNoteIds = new Set();

function renderNotesList() {
  notesListEl.innerHTML = '';
  const term = (document.getElementById('noteSearchInput').value || '').trim().toLowerCase();
  const list = term
    ? notesCache.filter(n => (n.title || '').toLowerCase().includes(term) || (n.content || '').toLowerCase().includes(term))
    : notesCache;

  if (!notesCache.length) {
    notesListEl.innerHTML = '<div class="panel-card"><div class="empty-admin">Nenhuma anotação ainda. Clique na ferramenta no topo para criar a primeira.</div></div>';
    return;
  }
  if (!list.length) {
    notesListEl.innerHTML = '<div class="panel-card"><div class="empty-admin">Nenhum resultado encontrado.</div></div>';
    return;
  }
  list.forEach(note => {
    const isExpanded = expandedNoteIds.has(note.id);
    const card = document.createElement('div');
    card.className = 'panel-card note-card';
    const dateStr = new Date(note.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const attachmentsHtml = note.attachments && note.attachments.length
      ? `<div class="attachment-grid">${note.attachments.map(a => attachmentPreviewHtml(a, false)).join('')}</div>`
      : '';
    card.innerHTML = `
      <div class="note-card-header">
        <div>
          ${note.title ? `<h2 style="margin-bottom:4px;">${escapeHtml(note.title)}</h2>` : ''}
          <div class="hint">Por ${escapeHtml(note.author || '—')} · atualizado em ${dateStr}${note.attachments && note.attachments.length ? ` · 📎 ${note.attachments.length}` : ''}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <button class="note-toggle-btn" title="${isExpanded ? 'Recolher' : 'Expandir'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${isExpanded ? '180' : '0'}deg); transition: transform 0.15s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            <span>${isExpanded ? 'Recolher' : 'Expandir'}</span>
          </button>
          <div class="actions manage-only">
            <button class="note-edit-btn" title="Editar">${iconSvg('edit')}</button>
            <button class="note-delete-btn" title="Excluir">${iconSvg('trash')}</button>
          </div>
        </div>
      </div>
      <div class="note-content ${isExpanded ? '' : 'collapsed'}">${escapeHtml(note.content)}</div>
      <div class="note-extra" style="${isExpanded ? '' : 'display:none;'}">
        ${attachmentsHtml}
        <div class="note-visibility-tag manage-only">${escapeHtml(groupNamesForNote(note))}</div>
      </div>
    `;
    card.querySelector('.note-edit-btn').addEventListener('click', () => editNote(note));
    card.querySelector('.note-delete-btn').addEventListener('click', () => deleteNote(note));
    card.querySelector('.note-toggle-btn').addEventListener('click', () => {
      if (expandedNoteIds.has(note.id)) {
        expandedNoteIds.delete(note.id);
      } else {
        expandedNoteIds.add(note.id);
      }
      renderNotesList();
    });
    notesListEl.appendChild(card);
  });
}

async function loadNotes() {
  const res = await fetch('/api/ti/notes');
  notesCache = await res.json();
  renderNotesList();
}

document.getElementById('noteSearchInput').addEventListener('input', renderNotesList);

function editNote(note) {
  noteIdInput.value = note.id;
  noteTitleInput.value = note.title || '';
  noteContentInput.value = note.content;
  noteFilesInput.value = '';
  notePendingFiles.textContent = '';
  removeAttachmentIds = [];
  setSelectedGroupIds(note.visibleGroupIds || []);

  existingAttachmentsEl.innerHTML = (note.attachments || []).map(a => attachmentPreviewHtml(a, true)).join('');
  existingAttachmentsEl.querySelectorAll('.attachment-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      removeAttachmentIds.push(id);
      btn.closest('.attachment-item').remove();
    });
  });

  noteFormTitle.textContent = 'Editar anotação';
  noteCancelEditBtn.style.display = 'inline-flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteNote(note) {
  if (!confirm('Excluir esta anotação e todos os anexos dela?')) return;
  await fetch(`/api/ti/notes/${note.id}`, { method: 'DELETE' });
  loadNotes();
}

checkSession();
