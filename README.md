# Acesso Rápido

Hub central de acessos para a sua empresa: uma página inicial com quadrados (tiles) que abrem os links do dia a dia, um painel admin para gerenciar tudo, uma área exclusiva para a equipe de TI e estatísticas de uso — tudo sem banco de dados externo, salvo em arquivos simples.

## Funcionalidades

**Página pública (`/`)**
- Grade de acessos responsiva, com paginação automática (24 por página).
- Busca por título ou tags (atalho de teclado `/`).
- Saudação e data/hora atuais no topo.
- Tema claro (padrão) e escuro, com a escolha salva no navegador.
- Banners de alertas com tipos (info, aviso, crítico, sucesso), agendamento de exibição e botão "Ciente".

**Painel admin (`/admin.html`)** — protegido por login com senha criptografada:
- **Acessos**: adicionar, editar, excluir e reordenar os quadrados; cada um pode ter imagem (upload ou URL — sem imagem, exibe as iniciais do título), cor de fundo e tags para a busca.
- **Alertas**: criar e agendar avisos exibidos na página inicial.
- **Usuários e grupos**: grupos com permissões (Painel Admin e/ou Painel de TI) e usuários vinculados a eles.
- **Estatísticas**: gráfico de cliques nos últimos 14 dias, ranking "mais acessados", histórico de cliques e de buscas.

**Área de TI (`/ti.html`)** — acesso para a equipe técnica:
- Atalhos próprios, separados dos da página pública.
- Anotações com anexos (imagens, vídeos, documentos, até 50MB) e controle de quais grupos podem ver cada anotação.

**Extras**
- Extensão para Chrome de nova aba (`public/chrome/`) apontando para a página inicial.
- Dados salvos em arquivos JSON em `data/` — backup é só copiar a pasta.

## Stack

- Node.js (18+) + Express
- Sessões em arquivo (`session-file-store`), senhas com bcrypt
- Uploads com Multer (imagens 5MB, anexos de TI 50MB)
- Frontend sem frameworks: HTML/CSS/JS puros, tema via CSS variables

## Estrutura de pastas

```
acesso-rapido/
  server.js              -> servidor Express (API + arquivos estaticos)
  scripts/set-password.js-> define o usuario/senha do admin no .env
  data/                  -> JSON files: tiles, alerts, clicks, searches,
                            users, groups, ti-tiles, ti-notes, ti-clicks, sessions
  public/
    index.html           -> pagina publica
    admin.html           -> login + painel admin
    ti.html              -> login + area de TI
    styles.css           -> estilos (tema claro/escuro)
    app.js / admin.js / ti.js -> logica das paginas
    network-bg.js, trim-image.js -> efeito de fundo e recorte de imagens
    assets/              -> logo e favicons
    uploads/             -> imagens dos tiles
    uploads/ti/          -> anexos das anotacoes da area de TI
    chrome/              -> extensao Chrome (nova aba)
  deploy/                -> exemplos de configuracao (systemd, nginx)
```

## Instalação

### 1. Pré-requisitos no Ubuntu

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v   # confira se é 18 ou mais novo; se estiver muito antigo, veja a nota abaixo
```

Se o Ubuntu instalar uma versão antiga do Node, use o NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Colocar o projeto no servidor

Copie a pasta para o servidor (via `scp`, `rsync`, git ou upload manual), por exemplo em `/var/www/acesso-rapido`, e instale as dependências:

```bash
cd /var/www/acesso-rapido
npm install
```

### 3. Definir o admin

```bash
npm run set-password
```

O comando pergunta o usuário e a senha e grava tudo (senha já criptografada) no `.env`. Rode de novo a qualquer momento para trocar. Na primeira execução, o servidor também cria os grupos "Administradores" e "Equipe de TI" e um usuário inicial da equipe de TI.

### 4. Rodar o site

```bash
npm start
```

Acesse `http://SEU_IP:3000`. O painel fica em `http://SEU_IP:3000/admin.html`.

## Rodando permanentemente (systemd)

1. Copie o exemplo:
   ```bash
   sudo cp deploy/acesso-rapido.service.example /etc/systemd/system/acesso-rapido.service
   ```
2. Edite `/etc/systemd/system/acesso-rapido.service` e ajuste `User` e `WorkingDirectory`.
3. Ative:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable acesso-rapido
   sudo systemctl start acesso-rapido
   sudo systemctl status acesso-rapido
   ```

## Domínio e HTTPS com Nginx (opcional, recomendado)

1. Instale o Nginx e o Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. Use `deploy/nginx.conf.example` como base, trocando `meudominio.com` pelo seu domínio, e salve em `/etc/nginx/sites-available/acesso-rapido`.
3. Ative o site e gere o certificado:
   ```bash
   sudo ln -s /etc/nginx/sites-available/acesso-rapido /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d meudominio.com
   ```

Sem domínio, dá para acessar direto por IP e porta (`http://SEU_IP:3000`) — o Nginx é só para ter URL bonita e HTTPS.

## Uso do dia a dia

- **Adicionar um acesso**: `/admin.html` → Acessos → preencha título, link, tags e imagem (opcional) → Salvar.
- **Editar/excluir/reordenar**: ícones de lápis, lixeira e setas na lista de acessos cadastrados.
- **Criar alerta**: categoria Alertas → tipo, mensagem e (opcional) janela de início/fim. Enquanto ativo, aparece no topo da página inicial.
- **Gerenciar usuários**: categoria Usuários e Grupos → crie grupos com as permissões desejadas e vincule usuários a eles.
- **Ver estatísticas**: categoria Estatísticas → gráfico, ranking e históricos.
- **Área de TI**: `/ti.html` → atalhos da equipe e anotações com anexos.
- **Trocar de tema**: botão de sol/lua no topo, em qualquer página.
- **Trocar a senha do admin**: rode `npm run set-password` de novo no servidor.

## Backup

Basta guardar uma cópia de `data/` (dados de tudo: acessos, alertas, usuários, estatísticas) e de `public/uploads/` (imagens e anexos).
