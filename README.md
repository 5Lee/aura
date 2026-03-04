# Aura - AI 提示词管理平台

一个强大的 AI 提示词收集、管理和分享工具。

## 功能特性

- 🔐 用户认证系统（注册/登录）
- 📝 提示词 CRUD（创建、编辑、删除、查看）
- 🏷️ 分类和标签管理
- 🔍 搜索功能
- ⭐ 收藏和收藏夹
- 👥 公开/私有提示词分享
- 🎨 现代化 UI 设计（shadcn/ui）

## 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: shadcn/ui + Tailwind CSS
- **数据库**: MySQL 8.0+
- **ORM**: Prisma
- **认证**: NextAuth.js
- **部署**: Docker + Nginx

## 快速开始

### 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd Aura
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接：
```
DATABASE_URL="mysql://username:password@localhost:3306/aura_db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

4. 初始化数据库
```bash
npx prisma migrate dev
npx prisma db seed
```

5. 启动开发服务器
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## Docker 部署

### 使用 Docker Compose

1. 配置环境变量
```bash
cp .env.docker .env
# 修改 .env 中的密码和密钥
```

2. 启动服务
```bash
cd docker
docker-compose up -d
```

3. 运行数据库迁移
```bash
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed
```

### VPS 部署步骤

1. 安装 Docker 和 Docker Compose
2. 上传项目到 VPS
3. 配置域名解析
4. 运行 `docker-compose up -d`
5. 配置 SSL 证书（可选）

### 企业私有化模板化交付

- 私有化部署模板：`deploy/private-template/`
- 一键预检脚本：`tools/enterprise-deploy-preflight.sh`
- 私有化部署说明：`docs/enterprise-private-deployment.md`
- 升级与回滚手册：`docs/enterprise-upgrade-rollback-runbook.md`

## 默认账号

种子数据会创建一个测试账号：
- 邮箱: demo@aura.ai
- 密码: demo123456

## 项目结构

```
Aura/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证页面
│   ├── (dashboard)/       # 仪表板
│   └── api/               # API Routes
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 组件
│   └── prompts/          # 提示词组件
├── lib/                  # 工具函数
├── prisma/               # 数据库
└── docker/               # Docker 配置
```

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npx prisma studio    # 打开数据库管理界面
```

## CI 质量门禁

主分支统一质量门禁覆盖以下命令：

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

配置见 `.github/workflows/quality-gate.yml`，规则说明见 `docs/quality-gate.md`。

## 故障排查

常见环境/网络/循环任务故障与修复命令见 `docs/troubleshooting.md`。

## License

MIT
