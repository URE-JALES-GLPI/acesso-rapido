# Acesso Rápido

Hub central para os seus sites: uma página com quadrados (tiles) que abrem seus links, com um painel admin protegido por login para gerenciar tudo, e alternância entre tema escuro (padrão) e tema claro.

## O que vem pronto

- Página pública (`/`) com a grade de acessos, responsiva (o layout se adapta sozinho conforme você adiciona mais quadrados).
- Painel admin (`/admin.html`) com login, onde você adiciona, edita, exclui e reordena os quadrados.
- Cada quadrado pode ter uma imagem (upload de arquivo ou URL); a imagem se ajusta automaticamente ao tamanho do quadrado. Sem imagem, ele mostra as iniciais do título.
- Tema escuro por padrão, com botão para alternar para o claro (a escolha fica salva no navegador).
- Sua logo já aplicada como marca do site e como favicon (ícone da aba do navegador).
- Dados salvos em arquivos simples (`data/tiles.json`), sem precisar de banco de dados externo.

## 1. Pré-requisitos no Ubuntu

```bash
sudo apt update
sudo apt install -y nodejs npm
node -v   # confira se e 18 ou mais novo; se estiver muito antigo, veja a nota abaixo
```

Se o Ubuntu instalar uma versão muito antiga do Node, use o NodeSource para uma versão atual:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Colocar o projeto no servidor

Copie esta pasta inteira para o seu servidor, por exemplo em `/var/www/acesso-rapido` (via `scp`, `rsync`, git, ou upload manual).

```bash
cd /var/www/acesso-rapido
npm install
```

## 3. Definir o usuário e a senha do admin

```bash
npm run set-password
```

Isso vai perguntar o usuário e a senha desejados e gravar tudo (já criptografado) no arquivo `.env`. Você pode rodar esse comando de novo a qualquer momento para trocar a senha.

## 4. Rodar o site

Para testar:

```bash
npm start
```

Acesse `http://SEU_IP:3000` no navegador. O painel fica em `http://SEU_IP:3000/admin.html`.

## 5. Deixar rodando permanentemente (systemd)

1. Copie o arquivo de exemplo:
   ```bash
   sudo cp deploy/acesso-rapido.service.example /etc/systemd/system/acesso-rapido.service
   ```
2. Edite `/etc/systemd/system/acesso-rapido.service` e ajuste `User` e `WorkingDirectory` para o seu caso.
3. Ative o serviço:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable acesso-rapido
   sudo systemctl start acesso-rapido
   sudo systemctl status acesso-rapido
   ```

## 6. (Opcional, recomendado) Domínio e HTTPS com Nginx

1. Instale o Nginx e o Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
2. Use `deploy/nginx.conf.example` como base, trocando `meudominio.com` pelo seu domínio.
3. Ative o site e gere o certificado:
   ```bash
   sudo ln -s /etc/nginx/sites-available/acesso-rapido /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d meudominio.com
   ```

Se você não tiver domínio, pode acessar direto pelo IP e porta (`http://SEU_IP:3000`), sem Nginx — o passo acima é só para ter uma URL bonita e HTTPS.

## Uso do dia a dia

- **Adicionar um site**: entre em `/admin.html`, faça login, preencha título e link, opcionalmente envie uma imagem, e clique em Salvar.
- **Editar/excluir**: use os ícones de lápis e lixeira na lista de acessos cadastrados.
- **Reordenar**: use as setinhas para cima/baixo em cada item da lista.
- **Trocar de tema**: o botão de sol/lua no topo, tanto na página pública quanto no admin.
- **Trocar a senha**: rode `npm run set-password` novamente no servidor.

## Estrutura de pastas

```
acesso-rapido/
  server.js              -> servidor Express (API + arquivos estaticos)
  scripts/set-password.js-> utilitario para definir usuario/senha do admin
  data/tiles.json         -> onde os quadrados ficam salvos
  public/
    index.html            -> pagina publica
    admin.html             -> login + painel admin
    styles.css             -> estilos (tema claro/escuro)
    app.js / admin.js      -> logica das paginas
    assets/logo.png        -> sua logo
    assets/favicon-*.png   -> favicon gerado a partir da sua logo
    uploads/                -> imagens enviadas pelos quadrados
  deploy/                  -> exemplos de configuracao (systemd, nginx)
```

## Backup

Para fazer backup de tudo que você cadastrou, basta guardar uma cópia de:
- `data/tiles.json`
- `public/uploads/`
