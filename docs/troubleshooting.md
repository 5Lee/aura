# Aura Troubleshooting Handbook

本手册汇总当前项目高频失败模式，帮助新成员在本地快速恢复开发环境。

## 一键恢复顺序（推荐）

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run db:generate
npm run preflight -- --skip-db
```

如数据库已就绪，再执行：

```bash
npm run preflight:full
```

---

## 高频失败模式

### 1) Prisma `P1001`（数据库不可达）

**典型报错**
- `P1001: Can't reach database server`

**常见原因**
- MySQL 未启动
- `.env` 中 `DATABASE_URL` 配置错误
- 本地端口/账号密码不匹配

**排查与修复**
```bash
brew services start mysql
npm run db:push
npm run db:seed
```

如仍失败，检查 `.env`：
- `DATABASE_URL="mysql://<user>:<password>@localhost:3306/aura_db"`

---

### 2) `ENOTFOUND registry.npmjs.org`（网络/DNS 问题）

**典型报错**
- `getaddrinfo ENOTFOUND registry.npmjs.org`

**常见原因**
- 网络不可达或 DNS 异常
- 依赖命令使用 `npx` 临时安装在线包

**排查与修复**
```bash
npm config get registry
npm cache verify
npm ci --ignore-scripts --no-audit --no-fund
```

项目默认使用本地离线兼容链路：
- `npm run test:e2e`（本地 Playwright lite）
- `npm run test:perf`（本地 LHCI lite）

---

### 3) MCP 启动超时 / 循环卡住

**典型现象**
- 循环长时间无输出
- 日志出现 MCP startup timeout 或卡在启动阶段

**排查与修复**
```bash
CODEX_FEATURE_FILE=feature_list_phase2.json \
CODEX_CONTINUE_ON_ERROR=1 \
CODEX_MCP_FAIL_FAST=1 \
CODEX_MCP_FAIL_FAST_SEC=90 \
CODEX_MCP_RETRY_PER_RUN=1 \
./run_codex_loop.sh
```

查看最新诊断摘要：
```bash
./tools/loop-log-summary.sh
```

---

### 4) `npm run lint` 进入交互初始化

**典型现象**
- `next lint` 提示你选择 ESLint 配置，阻塞自动化流程

**原因**
- 缺少 ESLint 基线配置

**修复**
- 确认仓库存在 `.eslintrc.json`
- 使用无交互命令：
```bash
npm run lint
```

---

### 5) TypeScript 对 `.next/types` 依赖导致波动

**典型现象**
- clean 环境或删掉 `.next` 后，`tsc` 报 `.next/types` 缺失

**修复策略**
- 使用项目统一命令：
```bash
npm run typecheck
```
- 该命令固定使用 `tsconfig.typecheck.json`，不依赖 `.next` 产物。

---

## 新成员自检清单

新成员首次拉起环境后，按下列顺序确认：

1. `npm run preflight -- --skip-db` 通过  
2. 数据库可用后 `npm run preflight:full` 通过  
3. `npm run build` 通过  
4. 如启动循环任务，`./tools/loop-log-summary.sh` 可读到有效摘要
