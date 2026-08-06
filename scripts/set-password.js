// Script utilitario para definir a senha do admin.
// Uso: npm run set-password
// Ele pede a senha desejada, gera um hash bcrypt e grava/atualiza o arquivo .env

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

function readEnvFile(p) {
  if (!fs.existsSync(p)) return {};
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    obj[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return obj;
}

function writeEnvFile(p, obj) {
  const lines = [
    '# Porta em que o servidor vai rodar',
    `PORT=${obj.PORT || 3000}`,
    '',
    '# Segredo usado para assinar o cookie de sessao (troque por um valor aleatorio)',
    `SESSION_SECRET=${obj.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex')}`,
    '',
    '# Usuario do painel admin',
    `ADMIN_USER=${obj.ADMIN_USER || 'admin'}`,
    '',
    '# Hash da senha (gerado automaticamente, nao editar a mao)',
    `ADMIN_PASS_HASH=${obj.ADMIN_PASS_HASH || ''}`,
    ''
  ];
  fs.writeFileSync(p, lines.join('\n'));
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('=== Configuracao do Acesso Rapido ===');

let current = readEnvFile(fs.existsSync(envPath) ? envPath : envExamplePath);

rl.question(`Usuario admin [${current.ADMIN_USER || 'admin'}]: `, (user) => {
  const adminUser = (user && user.trim()) || current.ADMIN_USER || 'admin';

  rl.question('Nova senha do admin: ', (pass) => {
    if (!pass || pass.trim().length < 4) {
      console.log('Senha muito curta. Use pelo menos 4 caracteres. Cancelando.');
      rl.close();
      process.exit(1);
    }
    const hash = bcrypt.hashSync(pass.trim(), 10);
    current.ADMIN_USER = adminUser;
    current.ADMIN_PASS_HASH = hash;
    if (!current.SESSION_SECRET) {
      current.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
    }
    if (!current.PORT) current.PORT = 3000;

    writeEnvFile(envPath, current);
    console.log('Pronto! Usuario e senha salvos em .env');
    console.log(`Usuario: ${adminUser}`);
    rl.close();
  });
});
