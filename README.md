# SnapID - Hospedagem de Imagens

API minimalista para hospedagem de imagens desenvolvida com Node.js, Express e MongoDB.

## 🚀 Funcionalidades

- ✅ Upload de imagens (JPEG, PNG, GIF, WEBP)
- ✅ Geração de chaves de API
- ✅ Listagem de imagens por usuário
- ✅ Exclusão de imagens
- ✅ Expiração automática de imagens
- ✅ Interface web integrada

## 📋 Pré-requisitos

- Node.js 18+
- MongoDB 4.4+
- NPM ou Yarn

## ⚡ Instalação Local

```bash
# Clone o repositório
git clone https://github.com/levypa/snapid.git
cd snapid

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Inicie o servidor
npm start
```

## 🐳 Deploy com Docker (Recomendado)

### Início Rápido

```bash
# Clone o repositório
git clone https://github.com/levypa/snapid.git
cd snapid

# Inicie tudo (app + MongoDB)
docker compose up -d
```

A aplicação estará disponível em `http://localhost:3000`

### Comandos Docker

```bash
# Iniciar containers
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Ver logs apenas da aplicação
docker compose logs -f app

# Parar containers
docker compose down

# Parar e remover volumes (⚠️ apaga dados)
docker compose down -v

# Rebuild após mudanças no código
docker compose up -d --build

# Ver status dos containers
docker compose ps
```

### Configuração de Produção

1. Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000
BASE_URL=https://seudominio.com
```

2. Para produção com domínio próprio, use com Nginx/Traefik como reverse proxy.

### Estrutura Docker

| Container | Porta | Descrição |
|-----------|-------|-----------|
| `snapid-app` | 3000 | Aplicação Node.js |
| `snapid-mongo` | 27017 | Banco de dados MongoDB |

### Volumes Persistentes

- `snapid_uploads_data` - Imagens enviadas
- `snapid_mongo_data` - Dados do MongoDB

```bash
# Ver volumes
docker volume ls | grep snapid

# Backup do MongoDB
docker exec snapid-mongo mongodump --out /data/backup

# Copiar backup para host
docker cp snapid-mongo:/data/backup ./backup
```

---

## 🌐 Deploy em VPS (Manual)

### 1. Preparar o Servidor (Ubuntu/Debian)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node -v
npm -v
```

### 2. Instalar MongoDB

```bash
# Importar chave GPG do MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Adicionar repositório (Ubuntu 22.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Iniciar e habilitar o serviço
sudo systemctl start mongod
sudo systemctl enable mongod

# Verificar status
sudo systemctl status mongod
```

### 3. Configurar Aplicação

```bash
# Criar usuário para a aplicação (recomendado)
sudo useradd -m -s /bin/bash snapid
sudo su - snapid

# Clonar repositório
git clone https://github.com/levypa/snapid.git
cd snapid

# Instalar dependências
npm install --production

# Criar arquivo .env
nano .env
```

Conteúdo do `.env`:
```env
MONGO_URI=mongodb://localhost:27017/snapid
PORT=3000
BASE_URL=https://seudominio.com
```

### 4. Configurar PM2 (Process Manager)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicação com PM2
pm2 start server.js --name snapid

# Configurar inicialização automática
pm2 startup
pm2 save

# Comandos úteis
pm2 logs snapid     # Ver logs
pm2 restart snapid  # Reiniciar
pm2 stop snapid     # Parar
pm2 status          # Status
```

### 5. Configurar Nginx (Reverse Proxy)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuração do site
sudo nano /etc/nginx/sites-available/snapid
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    # Limite de upload (ajuste conforme necessário)
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/snapid /etc/nginx/sites-enabled/

# Remover configuração padrão
sudo rm /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 6. Configurar SSL (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d seudominio.com -d www.seudominio.com

# Renovação automática (já configurada, mas pode testar)
sudo certbot renew --dry-run
```

### 7. Configurar Firewall

```bash
# Permitir SSH, HTTP e HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 🔧 Configurações Adicionais

### Backup do MongoDB

```bash
# Criar script de backup
nano ~/backup-snapid.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/snapid/backups"
mkdir -p $BACKUP_DIR
mongodump --db snapid --out $BACKUP_DIR/snapid_$DATE
# Manter apenas últimos 7 dias
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

```bash
# Tornar executável e agendar
chmod +x ~/backup-snapid.sh
crontab -e
# Adicionar: 0 2 * * * /home/snapid/backup-snapid.sh
```

### Limpar Uploads Antigos

O sistema já possui um cron job interno que limpa imagens expiradas automaticamente.

## 📊 Monitoramento

```bash
# Logs da aplicação
pm2 logs snapid

# Uso de recursos
pm2 monit

# Status do MongoDB
sudo systemctl status mongod

# Espaço em disco
df -h
```

## 🔒 Segurança Recomendada

1. **Altere a porta SSH padrão**
2. **Use autenticação por chave SSH**
3. **Configure fail2ban**
4. **Mantenha o sistema atualizado**
5. **Configure backups regulares**

## 📝 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/key` | Gerar nova chave de API |
| POST | `/upload?key=` | Enviar imagem |
| GET | `/api/my-images?key=` | Listar minhas imagens |
| GET | `/image/:id` | Obter detalhes da imagem |
| DELETE | `/image/:id?key=` | Excluir imagem |

## 📄 Licença

MIT License - © 2026 LevyPA®

**Site:** [opengptx.com.br](https://opengptx.com.br)
