require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const TILES_FILE = path.join(DATA_DIR, 'tiles.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const CLICKS_FILE = path.join(DATA_DIR, 'clicks.json');
const SEARCHES_FILE = path.join(DATA_DIR, 'searches.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const TI_TILES_FILE = path.join(DATA_DIR, 'ti-tiles.json');
const TI_NOTES_FILE = path.join(DATA_DIR, 'ti-notes.json');
const TI_CLICKS_FILE = path.join(DATA_DIR, 'ti-clicks.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const TI_UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'ti');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

// --- garantir pastas e arquivo de dados ---
for (const dir of [DATA_DIR, UPLOADS_DIR, TI_UPLOADS_DIR, SESSIONS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(TILES_FILE)) {
  fs.writeFileSync(TILES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(ALERTS_FILE)) {
  fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(CLICKS_FILE)) {
  fs.writeFileSync(CLICKS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(SEARCHES_FILE)) {
  fs.writeFileSync(SEARCHES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(TI_TILES_FILE)) {
  fs.writeFileSync(TI_TILES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(TI_NOTES_FILE)) {
  fs.writeFileSync(TI_NOTES_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(TI_CLICKS_FILE)) {
  fs.writeFileSync(TI_CLICKS_FILE, JSON.stringify([], null, 2));
}

// --- checagem de configuracao obrigatoria ---
if (!process.env.ADMIN_PASS_HASH) {
  console.error('\n[ERRO] Nenhuma senha de admin configurada.');
  console.error('Rode primeiro: npm run set-password\n');
  process.exit(1);
}

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;

// --- migracao para o sistema de grupos com permissoes (roda so o que for preciso) ---
let ADMIN_GROUP_ID = null;
let TI_GROUP_ID = null;

if (!fs.existsSync(GROUPS_FILE)) {
  ADMIN_GROUP_ID = crypto.randomUUID();
  TI_GROUP_ID = crypto.randomUUID();
  const initialGroups = [
    {
      id: ADMIN_GROUP_ID,
      name: 'Administradores',
      permissions: { admin: true, ti: true },
      createdAt: new Date().toISOString()
    },
    {
      id: TI_GROUP_ID,
      name: 'Equipe de TI',
      permissions: { admin: false, ti: true },
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(initialGroups, null, 2));
  console.log('[info] Grupos iniciais criados: "Administradores" e "Equipe de TI".');
} else {
  const existingGroups = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
  const adminGroup = existingGroups.find(g => g.permissions && g.permissions.admin && !g.permissions.ti);
  const tiGroup = existingGroups.find(g => g.permissions && g.permissions.ti && !g.permissions.admin);
  ADMIN_GROUP_ID = adminGroup ? adminGroup.id : (existingGroups[0] && existingGroups[0].id);
  TI_GROUP_ID = tiGroup ? tiGroup.id : (existingGroups[1] && existingGroups[1].id);
}

if (!fs.existsSync(USERS_FILE)) {
  const initialUsers = [
    {
      id: crypto.randomUUID(),
      username: ADMIN_USER,
      passwordHash: ADMIN_PASS_HASH,
      groupId: ADMIN_GROUP_ID,
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      username: 'ti',
      passwordHash: bcrypt.hashSync('jales.123', 10),
      groupId: TI_GROUP_ID,
      createdAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
  console.log('[info] Usuarios iniciais criados: "' + ADMIN_USER + '" (Administradores) e "ti" (Equipe de TI).');
} else {
  // migra usuarios antigos (com "role") para o novo sistema de grupos
  const existingUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  let changed = false;
  existingUsers.forEach(u => {
    if (!u.groupId) {
      u.groupId = u.role === 'ti' ? TI_GROUP_ID : ADMIN_GROUP_ID;
      delete u.role;
      changed = true;
    }
  });
  if (changed) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(existingUsers, null, 2));
    console.log('[info] Usuarios existentes migrados para o sistema de grupos.');
  }
}

// --- middlewares basicos ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({ path: SESSIONS_DIR, logFn: () => {} }),
  secret: process.env.SESSION_SECRET || 'troque-isso',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
    httpOnly: true,
    sameSite: 'lax'
  }
}));

function requireAdmin(req, res, next) {
  if (req.session && req.session.permissions && req.session.permissions.admin) return next();
  return res.status(401).json({ error: 'Nao autenticado' });
}

// exige permissao de acesso ao Painel de TI (definida no grupo do usuario)
function requireStaff(req, res, next) {
  if (req.session && req.session.permissions && req.session.permissions.ti) return next();
  return res.status(401).json({ error: 'Nao autenticado' });
}

// --- helpers de leitura/escrita de usuarios ---
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function publicUser(u) {
  return { id: u.id, username: u.username, groupId: u.groupId, createdAt: u.createdAt };
}

// --- helpers de leitura/escrita de grupos ---
function readGroups() {
  try {
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeGroups(groups) {
  fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
}
function getGroupPermissions(groupId) {
  const group = readGroups().find(g => g.id === groupId);
  return group ? group.permissions : { admin: false, ti: false };
}

function normalizeUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

function parseTags(raw) {
  if (!raw) return [];
  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(t => String(t).trim()).filter(Boolean);
      }
    } catch (e) {
      // se o JSON vier corrompido, cai no fallback abaixo
    }
  }

  return trimmed
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

// --- helpers de leitura/escrita dos tiles ---
function readTiles() {
  try {
    const raw = fs.readFileSync(TILES_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeTiles(tiles) {
  fs.writeFileSync(TILES_FILE, JSON.stringify(tiles, null, 2));
}

// --- helpers de leitura/escrita dos alertas ---
function readAlerts() {
  try {
    const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeAlerts(alerts) {
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

const ALERT_TYPES = ['info', 'warning', 'danger', 'success'];

// --- helpers de leitura/escrita de cliques e buscas (com limite de tamanho) ---
const MAX_CLICKS = 3000;
const MAX_SEARCHES = 1000;

function readClicks() {
  try {
    return JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeClicks(clicks) {
  const trimmed = clicks.slice(-MAX_CLICKS);
  fs.writeFileSync(CLICKS_FILE, JSON.stringify(trimmed, null, 2));
}

function readSearches() {
  try {
    return JSON.parse(fs.readFileSync(SEARCHES_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeSearches(searches) {
  const trimmed = searches.slice(-MAX_SEARCHES);
  fs.writeFileSync(SEARCHES_FILE, JSON.stringify(trimmed, null, 2));
}

// --- upload de imagens (multer) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});
const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Tipo de arquivo nao permitido'));
    }
    cb(null, true);
  }
});

// --- arquivos estaticos ---
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// ROTAS DE AUTENTICACAO
// =====================================================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario e senha sao obrigatorios' });
  }

  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }

  const permissions = getGroupPermissions(user.groupId);

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.groupId = user.groupId;
  req.session.permissions = permissions;
  res.json({ ok: true, permissions });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/api/session', (req, res) => {
  const permissions = (req.session && req.session.permissions) || null;
  res.json({
    loggedIn: !!permissions,
    permissions: permissions || { admin: false, ti: false },
    username: (req.session && req.session.username) || null,
    groupId: (req.session && req.session.groupId) || null,
    isAdmin: !!(permissions && permissions.admin) // mantido por compatibilidade
  });
});

// =====================================================
// ROTAS PUBLICAS DE TILES
// =====================================================
app.get('/api/tiles', (req, res) => {
  const tiles = readTiles().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  res.json(tiles);
});

// verifica se o alerta esta dentro da janela de agendamento (quando definida)
function isAlertScheduledNow(alert) {
  const now = Date.now();
  if (alert.startAt && now < new Date(alert.startAt).getTime()) return false;
  if (alert.endAt && now > new Date(alert.endAt).getTime()) return false;
  return true;
}

// alertas ativos (e dentro do agendamento, se houver), para exibir na pagina publica
app.get('/api/alerts', (req, res) => {
  const alerts = readAlerts()
    .filter(a => a.active && isAlertScheduledNow(a))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  res.json(alerts);
});

// confirmar leitura de um alerta ("Ciente") - publico, sem autenticacao
app.post('/api/alerts/:id/ack', (req, res) => {
  const { id } = req.params;
  const alerts = readAlerts();
  const alert = alerts.find(a => a.id === id);
  if (!alert) return res.status(404).json({ error: 'Alerta nao encontrado' });

  alert.ackCount = (alert.ackCount || 0) + 1;
  writeAlerts(alerts);
  res.json({ ackCount: alert.ackCount });
});

// registra um clique em um quadrado (usado para o ranking "mais acessados")
app.post('/api/track/click', (req, res) => {
  const { tileId } = req.body || {};
  if (!tileId) return res.status(400).json({ error: 'tileId obrigatorio' });

  const tiles = readTiles();
  const tile = tiles.find(t => t.id === tileId);
  const tileTitle = tile ? tile.title : '(acesso removido)';

  const clicks = readClicks();
  clicks.push({
    id: crypto.randomUUID(),
    tileId,
    tileTitle,
    timestamp: new Date().toISOString()
  });
  writeClicks(clicks);
  res.json({ ok: true });
});

// registra um termo buscado (usado para o historico de buscas no admin)
app.post('/api/track/search', (req, res) => {
  const { term } = req.body || {};
  const trimmed = (term || '').trim();
  if (!trimmed) return res.status(400).json({ error: 'term obrigatorio' });

  const searches = readSearches();
  searches.push({
    id: crypto.randomUUID(),
    term: trimmed,
    timestamp: new Date().toISOString()
  });
  writeSearches(searches);
  res.json({ ok: true });
});

// =====================================================
// ROTAS PROTEGIDAS (ADMIN)
// =====================================================
app.post('/api/tiles', requireAdmin, upload.single('image'), (req, res) => {
  const { title, url, color, imageUrl, tags } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'Titulo e URL sao obrigatorios' });
  }
  const tiles = readTiles();
  const maxOrder = tiles.reduce((m, t) => Math.max(m, t.order ?? 0), -1);

  let image = null;
  if (req.file) {
    image = '/uploads/' + req.file.filename;
  } else if (imageUrl) {
    image = imageUrl;
  }

  const tile = {
    id: crypto.randomUUID(),
    title,
    url: normalizeUrl(url),
    image,
    color: color || null,
    tags: parseTags(tags),
    order: maxOrder + 1
  };
  tiles.push(tile);
  writeTiles(tiles);
  res.json(tile);
});

app.put('/api/tiles/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const tiles = readTiles();
  const idx = tiles.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tile nao encontrado' });

  const { title, url, color, imageUrl, removeImage, tags } = req.body;
  const tile = tiles[idx];

  if (title !== undefined) tile.title = title;
  if (url !== undefined) tile.url = normalizeUrl(url);
  if (color !== undefined) tile.color = color || null;
  if (tags !== undefined) tile.tags = parseTags(tags);

  if (req.file) {
    // remove imagem antiga se era um upload local
    if (tile.image && tile.image.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, 'public', tile.image);
      fs.unlink(oldPath, () => {});
    }
    tile.image = '/uploads/' + req.file.filename;
  } else if (imageUrl) {
    tile.image = imageUrl;
  } else if (removeImage === 'true') {
    if (tile.image && tile.image.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, 'public', tile.image);
      fs.unlink(oldPath, () => {});
    }
    tile.image = null;
  }

  tiles[idx] = tile;
  writeTiles(tiles);
  res.json(tile);
});

app.delete('/api/tiles/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let tiles = readTiles();
  const tile = tiles.find(t => t.id === id);
  if (!tile) return res.status(404).json({ error: 'Tile nao encontrado' });

  if (tile.image && tile.image.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, 'public', tile.image);
    fs.unlink(oldPath, () => {});
  }

  tiles = tiles.filter(t => t.id !== id);
  writeTiles(tiles);
  res.json({ ok: true });
});

app.post('/api/tiles/reorder', requireAdmin, (req, res) => {
  const { order } = req.body; // array de ids na nova ordem
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order invalido' });

  const tiles = readTiles();
  const map = new Map(tiles.map(t => [t.id, t]));
  order.forEach((id, index) => {
    const t = map.get(id);
    if (t) t.order = index;
  });
  writeTiles(Array.from(map.values()));
  res.json({ ok: true });
});

// =====================================================
// ROTAS DE ALERTAS (ADMIN)
// =====================================================
app.get('/api/alerts/all', requireAdmin, (req, res) => {
  const alerts = readAlerts().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  res.json(alerts);
});

app.post('/api/alerts', requireAdmin, (req, res) => {
  const { title, message, type, active, startAt, endAt } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'A mensagem do alerta e obrigatoria' });
  }
  const alerts = readAlerts();
  const maxOrder = alerts.reduce((m, a) => Math.max(m, a.order ?? 0), -1);

  const alert = {
    id: crypto.randomUUID(),
    title: (title || '').trim() || null,
    message: message.trim(),
    type: ALERT_TYPES.includes(type) ? type : 'info',
    active: active === true || active === 'true',
    startAt: startAt ? new Date(startAt).toISOString() : null,
    endAt: endAt ? new Date(endAt).toISOString() : null,
    ackCount: 0,
    order: maxOrder + 1,
    createdAt: new Date().toISOString()
  };
  alerts.push(alert);
  writeAlerts(alerts);
  res.json(alert);
});

app.put('/api/alerts/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const alerts = readAlerts();
  const idx = alerts.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Alerta nao encontrado' });

  const { title, message, type, active, startAt, endAt } = req.body || {};
  const alert = alerts[idx];

  if (title !== undefined) alert.title = (title || '').trim() || null;
  if (message !== undefined) {
    if (!message.trim()) return res.status(400).json({ error: 'A mensagem do alerta e obrigatoria' });
    alert.message = message.trim();
  }
  if (type !== undefined) alert.type = ALERT_TYPES.includes(type) ? type : 'info';
  if (startAt !== undefined) alert.startAt = startAt ? new Date(startAt).toISOString() : null;
  if (endAt !== undefined) alert.endAt = endAt ? new Date(endAt).toISOString() : null;
  if (active !== undefined) alert.active = active === true || active === 'true';

  alerts[idx] = alert;
  writeAlerts(alerts);
  res.json(alert);
});

app.delete('/api/alerts/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let alerts = readAlerts();
  const exists = alerts.some(a => a.id === id);
  if (!exists) return res.status(404).json({ error: 'Alerta nao encontrado' });

  alerts = alerts.filter(a => a.id !== id);
  writeAlerts(alerts);
  res.json({ ok: true });
});

// =====================================================
// ESTATISTICAS (ADMIN) - ranking de acessos, historico de cliques e buscas
// =====================================================
app.get('/api/track/clicks', requireAdmin, (req, res) => {
  const clicks = readClicks();

  const rankingMap = new Map();
  for (const c of clicks) {
    const key = c.tileId;
    if (!rankingMap.has(key)) {
      rankingMap.set(key, { tileId: c.tileId, tileTitle: c.tileTitle, count: 0 });
    }
    rankingMap.get(key).count++;
    // mantem o titulo mais recente (caso o acesso tenha sido renomeado)
    rankingMap.get(key).tileTitle = c.tileTitle;
  }
  const ranking = Array.from(rankingMap.values()).sort((a, b) => b.count - a.count);

  const history = [...clicks].reverse().slice(0, 200);

  res.json({ ranking, history });
});

app.get('/api/track/searches', requireAdmin, (req, res) => {
  const searches = [...readSearches()].reverse().slice(0, 200);
  res.json(searches);
});

// cliques agrupados por dia, para o grafico (ultimos 14 dias)
app.get('/api/track/clicks/daily', requireAdmin, (req, res) => {
  const DAYS = 14;
  const clicks = readClicks();

  const dayKeys = [];
  const counts = {};
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    dayKeys.push(key);
    counts[key] = 0;
  }

  clicks.forEach(c => {
    const key = (c.timestamp || '').slice(0, 10);
    if (counts[key] !== undefined) counts[key]++;
  });

  const series = dayKeys.map(key => ({ date: key, count: counts[key] }));
  res.json(series);
});

// =====================================================
// ROTAS DE GRUPOS (SOMENTE ADMIN)
// =====================================================
app.get('/api/groups', requireAdmin, (req, res) => {
  res.json(readGroups());
});

// versao enxuta para a area de TI usar no seletor de visibilidade das anotacoes
app.get('/api/ti/groups', requireStaff, (req, res) => {
  const groups = readGroups()
    .filter(g => g.permissions && g.permissions.ti)
    .map(g => ({ id: g.id, name: g.name }));
  res.json(groups);
});

app.post('/api/groups', requireAdmin, (req, res) => {
  const { name, permissions } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nome do grupo e obrigatorio' });
  }
  const groups = readGroups();
  const group = {
    id: crypto.randomUUID(),
    name: name.trim(),
    permissions: {
      admin: !!(permissions && permissions.admin),
      ti: !!(permissions && permissions.ti)
    },
    createdAt: new Date().toISOString()
  };
  groups.push(group);
  writeGroups(groups);
  res.json(group);
});

app.put('/api/groups/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const groups = readGroups();
  const group = groups.find(g => g.id === id);
  if (!group) return res.status(404).json({ error: 'Grupo nao encontrado' });

  const { name, permissions } = req.body || {};
  if (name !== undefined && name.trim()) group.name = name.trim();
  if (permissions !== undefined) {
    group.permissions = {
      admin: !!permissions.admin,
      ti: !!permissions.ti
    };
  }

  writeGroups(groups);

  // atualiza a sessao de quem estiver logado nesse grupo neste exato momento nao e possivel
  // (sessoes ficam em arquivo separado); a mudanca vale a partir do proximo login.
  res.json(group);
});

app.delete('/api/groups/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const groups = readGroups();
  const group = groups.find(g => g.id === id);
  if (!group) return res.status(404).json({ error: 'Grupo nao encontrado' });

  const usersInGroup = readUsers().filter(u => u.groupId === id);
  if (usersInGroup.length > 0) {
    return res.status(400).json({ error: `Existem ${usersInGroup.length} usuario(s) nesse grupo. Mude o grupo deles antes de excluir.` });
  }

  writeGroups(groups.filter(g => g.id !== id));
  res.json({ ok: true });
});

// =====================================================
// ROTAS DE USUARIOS (SOMENTE ADMIN)
// =====================================================
app.get('/api/users', requireAdmin, (req, res) => {
  const users = readUsers().map(publicUser);
  res.json(users);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, groupId } = req.body || {};
  if (!username || !username.trim() || !password || password.length < 4) {
    return res.status(400).json({ error: 'Usuario e senha (min. 4 caracteres) sao obrigatorios' });
  }
  const groups = readGroups();
  if (!groupId || !groups.some(g => g.id === groupId)) {
    return res.status(400).json({ error: 'Selecione um grupo valido' });
  }
  const users = readUsers();
  if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Ja existe um usuario com esse nome' });
  }
  const user = {
    id: crypto.randomUUID(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    groupId,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);
  res.json(publicUser(user));
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const users = readUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

  const { username, password, groupId } = req.body || {};

  if (username !== undefined && username.trim()) {
    const clash = users.some(u => u.id !== id && u.username.toLowerCase() === username.trim().toLowerCase());
    if (clash) return res.status(400).json({ error: 'Ja existe um usuario com esse nome' });
    user.username = username.trim();
  }
  if (groupId !== undefined) {
    const groups = readGroups();
    if (!groups.some(g => g.id === groupId)) return res.status(400).json({ error: 'Selecione um grupo valido' });
    user.groupId = groupId;
  }
  if (password) {
    if (password.length < 4) return res.status(400).json({ error: 'Senha muito curta (min. 4 caracteres)' });
    user.passwordHash = bcrypt.hashSync(password, 10);
  }

  writeUsers(users);
  res.json(publicUser(user));
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const users = readUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

  const permissions = getGroupPermissions(user.groupId);
  if (permissions.admin) {
    const remainingAdmins = users.filter(u => u.id !== id && getGroupPermissions(u.groupId).admin);
    if (remainingAdmins.length === 0) {
      return res.status(400).json({ error: 'Nao e possivel excluir o unico usuario com acesso de administrador' });
    }
  }

  writeUsers(users.filter(u => u.id !== id));
  res.json({ ok: true });
});

// =====================================================
// AREA DE TI - TILES (equipe de TI + admin)
// =====================================================
function readTiTiles() {
  try {
    return JSON.parse(fs.readFileSync(TI_TILES_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeTiTiles(tiles) {
  fs.writeFileSync(TI_TILES_FILE, JSON.stringify(tiles, null, 2));
}

app.get('/api/ti/tiles', requireStaff, (req, res) => {
  const tiles = readTiTiles().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  res.json(tiles);
});

app.post('/api/ti/tiles', requireStaff, upload.single('image'), (req, res) => {
  const { title, url, color, imageUrl, tags } = req.body;
  if (!title || !url) {
    return res.status(400).json({ error: 'Titulo e URL sao obrigatorios' });
  }
  const tiles = readTiTiles();
  const maxOrder = tiles.reduce((m, t) => Math.max(m, t.order ?? 0), -1);

  let image = null;
  if (req.file) {
    image = '/uploads/' + req.file.filename;
  } else if (imageUrl) {
    image = imageUrl;
  }

  const tile = {
    id: crypto.randomUUID(),
    title,
    url: normalizeUrl(url),
    image,
    color: color || null,
    tags: parseTags(tags),
    order: maxOrder + 1
  };
  tiles.push(tile);
  writeTiTiles(tiles);
  res.json(tile);
});

app.put('/api/ti/tiles/:id', requireStaff, upload.single('image'), (req, res) => {
  const { id } = req.params;
  const tiles = readTiTiles();
  const idx = tiles.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Tile nao encontrado' });

  const { title, url, color, imageUrl, removeImage, tags } = req.body;
  const tile = tiles[idx];

  if (title !== undefined) tile.title = title;
  if (url !== undefined) tile.url = normalizeUrl(url);
  if (color !== undefined) tile.color = color || null;
  if (tags !== undefined) tile.tags = parseTags(tags);

  if (req.file) {
    if (tile.image && tile.image.startsWith('/uploads/')) {
      fs.unlink(path.join(__dirname, 'public', tile.image), () => {});
    }
    tile.image = '/uploads/' + req.file.filename;
  } else if (imageUrl) {
    tile.image = imageUrl;
  } else if (removeImage === 'true') {
    if (tile.image && tile.image.startsWith('/uploads/')) {
      fs.unlink(path.join(__dirname, 'public', tile.image), () => {});
    }
    tile.image = null;
  }

  tiles[idx] = tile;
  writeTiTiles(tiles);
  res.json(tile);
});

app.delete('/api/ti/tiles/:id', requireStaff, (req, res) => {
  const { id } = req.params;
  let tiles = readTiTiles();
  const tile = tiles.find(t => t.id === id);
  if (!tile) return res.status(404).json({ error: 'Tile nao encontrado' });

  if (tile.image && tile.image.startsWith('/uploads/')) {
    fs.unlink(path.join(__dirname, 'public', tile.image), () => {});
  }

  tiles = tiles.filter(t => t.id !== id);
  writeTiTiles(tiles);
  res.json({ ok: true });
});

// --- cliques nos atalhos da area de TI (ranking proprio, separado do publico) ---
function readTiClicks() {
  try {
    return JSON.parse(fs.readFileSync(TI_CLICKS_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeTiClicks(clicks) {
  const trimmed = clicks.slice(-MAX_CLICKS);
  fs.writeFileSync(TI_CLICKS_FILE, JSON.stringify(trimmed, null, 2));
}

app.post('/api/ti/track/click', requireStaff, (req, res) => {
  const { tileId } = req.body || {};
  if (!tileId) return res.status(400).json({ error: 'tileId obrigatorio' });

  const tiles = readTiTiles();
  const tile = tiles.find(t => t.id === tileId);
  const tileTitle = tile ? tile.title : '(acesso removido)';

  const clicks = readTiClicks();
  clicks.push({
    id: crypto.randomUUID(),
    tileId,
    tileTitle,
    timestamp: new Date().toISOString()
  });
  writeTiClicks(clicks);
  res.json({ ok: true });
});

app.get('/api/ti/track/clicks', requireStaff, (req, res) => {
  const clicks = readTiClicks();

  const rankingMap = new Map();
  for (const c of clicks) {
    if (!rankingMap.has(c.tileId)) {
      rankingMap.set(c.tileId, { tileId: c.tileId, tileTitle: c.tileTitle, count: 0 });
    }
    rankingMap.get(c.tileId).count++;
    rankingMap.get(c.tileId).tileTitle = c.tileTitle;
  }
  const ranking = Array.from(rankingMap.values()).sort((a, b) => b.count - a.count);
  const history = [...clicks].reverse().slice(0, 100);

  res.json({ ranking, history });
});

// =====================================================
// AREA DE TI - ANOTACOES (equipe de TI + admin)
// =====================================================
function readTiNotes() {
  try {
    return JSON.parse(fs.readFileSync(TI_NOTES_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}
function writeTiNotes(notes) {
  fs.writeFileSync(TI_NOTES_FILE, JSON.stringify(notes, null, 2));
}

function attachmentType(ext) {
  const e = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(e)) return 'image';
  if (['.mp4', '.webm', '.mov', '.ogg'].includes(e)) return 'video';
  return 'file';
}

const tiNotesUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TI_UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomBytes(12).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB por arquivo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.webm', '.mov', '.ogg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.txt', '.csv'];
    if (!allowed.includes(ext)) return cb(new Error('Tipo de arquivo nao permitido'));
    cb(null, true);
  }
}).array('attachments', 10);

app.get('/api/ti/notes', requireStaff, (req, res) => {
  const myGroupId = req.session.groupId;
  const notes = readTiNotes()
    .filter(n => !n.visibleGroupIds || n.visibleGroupIds.length === 0 || n.visibleGroupIds.includes(myGroupId))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(notes);
});

app.post('/api/ti/notes', requireStaff, tiNotesUpload, (req, res) => {
  const { title, content, visibleGroupIds } = req.body || {};
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Escreva algo na anotacao' });
  }

  const attachments = (req.files || []).map(f => ({
    id: crypto.randomUUID(),
    filename: f.filename,
    originalName: f.originalname,
    url: '/uploads/ti/' + f.filename,
    type: attachmentType(path.extname(f.filename))
  }));

  let parsedGroupIds = [];
  if (visibleGroupIds) {
    try {
      const parsed = JSON.parse(visibleGroupIds);
      if (Array.isArray(parsed)) parsedGroupIds = parsed;
    } catch (e) { /* ignora */ }
  }

  const notes = readTiNotes();
  const note = {
    id: crypto.randomUUID(),
    title: (title || '').trim() || null,
    content: content.trim(),
    attachments,
    visibleGroupIds: parsedGroupIds,
    author: req.session.username,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  notes.push(note);
  writeTiNotes(notes);
  res.json(note);
});

app.put('/api/ti/notes/:id', requireStaff, tiNotesUpload, (req, res) => {
  const { id } = req.params;
  const notes = readTiNotes();
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Anotacao nao encontrada' });

  const { title, content, removeAttachmentIds, visibleGroupIds } = req.body || {};
  const note = notes[idx];

  if (title !== undefined) note.title = (title || '').trim() || null;
  if (content !== undefined) {
    if (!content.trim()) return res.status(400).json({ error: 'Escreva algo na anotacao' });
    note.content = content.trim();
  }
  if (visibleGroupIds !== undefined) {
    try {
      const parsed = JSON.parse(visibleGroupIds);
      if (Array.isArray(parsed)) note.visibleGroupIds = parsed;
    } catch (e) { /* ignora */ }
  }

  if (removeAttachmentIds) {
    try {
      const idsToRemove = JSON.parse(removeAttachmentIds);
      if (Array.isArray(idsToRemove) && idsToRemove.length) {
        note.attachments.forEach(att => {
          if (idsToRemove.includes(att.id)) {
            fs.unlink(path.join(__dirname, 'public', att.url), () => {});
          }
        });
        note.attachments = note.attachments.filter(att => !idsToRemove.includes(att.id));
      }
    } catch (e) {
      // ignora se vier mal formado
    }
  }

  const newAttachments = (req.files || []).map(f => ({
    id: crypto.randomUUID(),
    filename: f.filename,
    originalName: f.originalname,
    url: '/uploads/ti/' + f.filename,
    type: attachmentType(path.extname(f.filename))
  }));
  note.attachments = [...note.attachments, ...newAttachments];
  note.updatedAt = new Date().toISOString();

  notes[idx] = note;
  writeTiNotes(notes);
  res.json(note);
});

app.delete('/api/ti/notes/:id', requireStaff, (req, res) => {
  const { id } = req.params;
  let notes = readTiNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return res.status(404).json({ error: 'Anotacao nao encontrada' });

  (note.attachments || []).forEach(att => {
    fs.unlink(path.join(__dirname, 'public', att.url), () => {});
  });

  notes = notes.filter(n => n.id !== id);
  writeTiNotes(notes);
  res.json({ ok: true });
});

// tratamento de erro do multer (ex: arquivo grande demais)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Erro no upload' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Acesso Rapido rodando em http://localhost:${PORT}`);
});
