// ---------- tema ----------
const THEME_KEY = 'acesso-rapido-theme';
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

const SUN_PATH = '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>';
const MOON_PATH = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

function applyThemeIcon(theme) {
  themeIcon.innerHTML = theme === 'dark' ? MOON_PATH : SUN_PATH;
}
applyThemeIcon(root.getAttribute('data-theme') || 'dark');

themeToggle.addEventListener('click', () => {
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  applyThemeIcon(next);
});

document.getElementById('adminBtn').addEventListener('click', () => {
  window.location.href = '/admin.html';
});

// ---------- saudacao e data ----------
(function () {
  const greetingText = document.getElementById('greetingText');
  const greetingDate = document.getElementById('greetingDate');
  if (!greetingText || !greetingDate) return;

  const hour = new Date().getHours();
  let saudacao = 'Boa noite';
  if (hour >= 5 && hour < 12) saudacao = 'Bom dia';
  else if (hour >= 12 && hour < 18) saudacao = 'Boa tarde';

  greetingText.textContent = `${saudacao}!`;

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  function tick() {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    greetingDate.textContent = `${dataFormatada} — ${hora}`;
  }
  tick();
  setInterval(tick, 1000);
})();

// ---------- alertas ----------
const ALERT_ICONS = {
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
  danger: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
  success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
};

const ACKED_ALERTS_KEY = 'acesso-rapido-acked-alerts';

function getAckedAlerts() {
  try {
    return JSON.parse(localStorage.getItem(ACKED_ALERTS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}
function markAlertAsAcked(alertId) {
  const acked = getAckedAlerts();
  if (!acked.includes(alertId)) {
    acked.push(alertId);
    localStorage.setItem(ACKED_ALERTS_KEY, JSON.stringify(acked));
  }
}

async function loadAlerts() {
  const container = document.getElementById('alertsContainer');
  if (!container) return;
  try {
    const res = await fetch('/api/alerts');
    const alerts = await res.json();
    const acked = getAckedAlerts();
    container.innerHTML = '';
    alerts.forEach(alert => {
      const div = document.createElement('div');
      div.className = `alert-banner alert-${alert.type}`;
      const jaConfirmou = acked.includes(alert.id);
      div.innerHTML = `
        <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ALERT_ICONS[alert.type] || ALERT_ICONS.info}</svg>
        <div class="alert-content">
          ${alert.title ? `<div class="alert-title"></div>` : ''}
          <div class="alert-message"></div>
        </div>
        <button class="alert-ack-btn" ${jaConfirmou ? 'disabled' : ''}>${jaConfirmou ? '✓ Confirmado' : 'Ciente'}</button>`;
      if (alert.title) div.querySelector('.alert-title').textContent = alert.title;
      div.querySelector('.alert-message').textContent = alert.message;

      const ackBtn = div.querySelector('.alert-ack-btn');
      ackBtn.addEventListener('click', async () => {
        ackBtn.disabled = true;
        ackBtn.textContent = '✓ Confirmado';
        markAlertAsAcked(alert.id);
        try {
          await fetch(`/api/alerts/${alert.id}/ack`, { method: 'POST' });
        } catch (e) {
          // se falhar, ainda assim deixamos marcado localmente
        }
      });

      container.appendChild(div);
    });
  } catch (e) {
    // silenciosamente ignora - alertas nao sao criticos para a pagina funcionar
  }
}

loadAlerts();

// ---------- atalho de teclado "/" para focar a busca ----------
document.addEventListener('keydown', (e) => {
  if (e.key !== '/') return;
  const activeTag = document.activeElement ? document.activeElement.tagName : '';
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
  e.preventDefault();
  const input = document.getElementById('searchInput');
  if (input) input.focus();
});

// ---------- tiles ----------
const grid = document.getElementById('tileGrid');
const searchInput = document.getElementById('searchInput');
const paginationEl = document.getElementById('pagination');
const pageDotsEl = document.getElementById('pageDots');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');

const ITEMS_PER_PAGE = 24;
let allTiles = [];
let filteredTiles = [];
let currentPage = 0;

function initials(title) {
  return (title || '?').trim().slice(0, 2).toUpperCase();
}

function renderTilesPage() {
  grid.innerHTML = '';

  if (!allTiles.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="big">Nenhum acesso cadastrado ainda</div>
        <div>Entre no <a href="/admin.html">painel admin</a> para adicionar seus primeiros links.</div>
      </div>`;
    paginationEl.style.display = 'none';
    return;
  }

  if (!filteredTiles.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="big">Nenhum resultado encontrado</div>
        <div>Tente buscar por outro termo.</div>
      </div>`;
    paginationEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(filteredTiles.length / ITEMS_PER_PAGE);
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  if (currentPage < 0) currentPage = 0;

  const start = currentPage * ITEMS_PER_PAGE;
  const pageTiles = filteredTiles.slice(start, start + ITEMS_PER_PAGE);

  pageTiles.forEach(tile => {
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

      // tenta cortar as bordas vazias da imagem para deixar o tamanho visual mais parecido entre os quadrados
      window.autoTrimImage(tile.image).then((trimmedUrl) => {
        if (trimmedUrl) img.src = trimmedUrl;
      });
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'tile-fallback';
      if (tile.color) fallback.style.background = tile.color;
      fallback.textContent = initials(tile.title);
      imageWrap.appendChild(fallback);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.textContent = tile.title;

    a.appendChild(imageWrap);
    a.appendChild(titleEl);
    a.addEventListener('click', () => {
      // registra o clique para o ranking "mais acessados" no admin (nao bloqueia a navegacao)
      fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileId: tile.id }),
        keepalive: true
      }).catch(() => {});
    });
    grid.appendChild(a);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  paginationEl.style.display = 'flex';
  pageDotsEl.innerHTML = '';

  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('button');
    dot.className = 'page-dot' + (i === currentPage ? ' active' : '');
    dot.setAttribute('aria-label', `Página ${i + 1}`);
    dot.addEventListener('click', () => {
      currentPage = i;
      renderTilesPage();
    });
    pageDotsEl.appendChild(dot);
  }

  prevPageBtn.disabled = currentPage === 0;
  nextPageBtn.disabled = currentPage === totalPages - 1;
}

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 0) { currentPage--; renderTilesPage(); }
});
nextPageBtn.addEventListener('click', () => {
  currentPage++; renderTilesPage();
});

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim().toLowerCase();
  filteredTiles = term
    ? allTiles.filter(t => {
        const titleMatch = (t.title || '').toLowerCase().includes(term);
        const tagsMatch = (t.tags || []).some(tag => tag.toLowerCase().includes(term));
        return titleMatch || tagsMatch;
      })
    : allTiles;
  currentPage = 0;
  renderTilesPage();
  scheduleSearchTracking(searchInput.value.trim());
});

// registra o termo buscado (para o admin ver o que o pessoal procura), com debounce
let searchTrackTimeout = null;
let lastTrackedSearchTerm = '';
function scheduleSearchTracking(term) {
  clearTimeout(searchTrackTimeout);
  if (!term || term.length < 2) return;
  searchTrackTimeout = setTimeout(() => {
    if (term.toLowerCase() === lastTrackedSearchTerm.toLowerCase()) return;
    lastTrackedSearchTerm = term;
    fetch('/api/track/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term })
    }).catch(() => {});
  }, 1000);
}

async function loadTiles() {
  try {
    const res = await fetch('/api/tiles');
    allTiles = await res.json();
    filteredTiles = allTiles;
    renderTilesPage();
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Não foi possível carregar os acessos.</div>';
  }
}

loadTiles();
