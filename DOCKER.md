# Docker 部署指南

本文档介绍如何使用 Docker 部署 Aura 应用。

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+

## 快速开始

### 1. 配置环境变量

```bash
cp .env.docker .env
```

编辑 `.env` 文件，修改以下配置：

```env
# MySQL 配置
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=aura_db
MYSQL_USER=aura
MYSQL_PASSWORD=your_secure_password

# 应用配置
DATABASE_URL=mysql://aura:your_secure_password@mysql:3306/aura_db
NEXTAUTH_SECRET=your_nextauth_secret_key_change_this
NEXTAUTH_URL=http://your-domain.com
```

### 2. 使用部署脚本（推荐）

```bash
cd docker
./deploy.sh
```

部署脚本会自动完成以下操作：
- 构建 Docker 镜像
- 启动所有服务（MySQL、应用、Nginx）
- 运行数据库迁移
- 导入种子数据

### 3. 手动部署

```bash
cd docker

# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 运行迁移
docker-compose exec app npx prisma migrate deploy

# 导入种子数据
docker-compose exec app npx prisma db seed
```

## 服务说明

部署后包含以下服务：

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| MySQL | aura_mysql | 3306 | 数据库 |
| App | aura_app | 3000 | Next.js 应用 |
| Nginx | aura_nginx | 80, 443 | 反向代理 |

## 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 进入应用容器
docker-compose exec app sh

# 运行 Prisma Studio
docker-compose exec app npx prisma studio
```

## 生产环境部署

### 域名配置

1. 更新 `.env` 中的 `NEXTAUTH_URL` 为你的域名：
   ```
   NEXTAUTH_URL=https://your-domain.com
   ```

2. 配置 DNS 解析指向你的服务器

### SSL 证书配置

1. 在 `docker/ssl/` 目录放置证书文件：
   ```
   docker/ssl/cert.pem
   docker/ssl/key.pem
   ```

2. Nginx 配置会自动使用这些证书

### 数据库备份

```bash
# 备份数据库
docker-compose exec mysql mysqldump -u root -p aura_db > backup.sql

# 恢复数据库
docker-compose exec -T mysql mysql -u root -p aura_db < backup.sql
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs app

# 检查容器状态
docker ps -a
```

### 数据库连接失败

1. 确保 MySQL 容器正在运行
2. 检查 `DATABASE_URL` 配置是否正确
3. 等待 MySQL 完全启动（约 10 秒）

### 清理和重新部署

```bash
# 停止并删除所有容器
docker-compose down -v

# 删除镜像
docker rmi aura_app

# 重新部署
./deploy.sh
```

## 默认账号

部署后可使用以下账号登录：

- 邮箱: `demo@aura.ai`
- 密码: `demo123456`

**重要**: 生产环境请立即修改或删除此账号！
