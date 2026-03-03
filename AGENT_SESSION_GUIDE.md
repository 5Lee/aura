# Aura Agent Session Guide

> 基于 Anthropic 的 "Effective Harnesses for Long-Running Agents" 最佳实践

本文档定义了每个 Coding Agent Session 的启动流程和工作规范。

---

## 🚀 Session 启动流程

每个新的开发会话必须按以下顺序执行：

### Step 1: 环境检查
```bash
pwd                    # 确认当前工作目录
git status             # 检查代码状态
git log --oneline -5   # 查看最近的提交
```

### Step 2: 阅读项目状态
1. 阅读 `CLAUDE_PROGRESS.md` - 了解已完成的工作
2. 阅读 `feature_list_phase1.json` - 查看待完成的功能
3. 选择 **一个** 最高优先级的未完成功能

### Step 3: 启动开发环境
```bash
./init.sh              # 启动开发服务器
```

### Step 4: 验证现有功能
在实现新功能前，先运行基本测试确保现有功能正常：
```bash
npm run typecheck      # 运行 TypeScript 检查（不依赖 .next/types）
npm test               # 运行单元测试
npm run test:e2e       # 运行 E2E 测试 (本地离线兼容 Playwright runner)
```

### Step 5: 实现功能
- 只专注于 **一个** 功能
- 编写代码 + 编写测试
- 手动验证功能正常工作

### Step 6: 提交更改
```bash
git add <specific-files>
git commit -m "feat: 描述功能"
```

### Step 7: 更新进度文档
1. 更新 `CLAUDE_PROGRESS.md` 记录完成的工作
2. 更新 `feature_list_phase1.json` 标记功能为 `passes: true`

---

## 📋 功能列表结构

功能列表使用 JSON 格式存储，每个功能包含：

```json
{
  "id": "phase1-week1-001",
  "category": "loading",
  "priority": 1,
  "week": 1,
  "description": "功能描述",
  "steps": [
    "步骤 1",
    "步骤 2",
    "验证步骤"
  ],
  "passes": false
}
```

### 优先级定义
- **P1**: 必须完成，影响核心功能
- **P2**: 重要，显著提升用户体验
- **P3**: 优化项，有时间再做

### 标记功能完成的标准
只有满足以下条件才能将 `passes` 设为 `true`：
1. 代码已编写并通过编译
2. 单元测试通过（如适用）
3. 手动 E2E 测试通过
4. 已提交到 git

---

## 🎨 使用 Frontend Design Skill

在实现 UI 相关功能时，使用 `web-design-guidelines` skill 进行设计审查：

### 触发时机
- 开始新的 UI 组件开发前
- 完成主要 UI 变更后
- 每个 Week 结束时的设计审查

### 使用方式
```
/web-design-guidelines
```

该 skill 会：
1. 检查 UI 是否符合 Web Interface Guidelines
2. 审查可访问性问题
3. 提供设计优化建议

---

## ⚠️ 失败模式预防

| 问题 | 预防措施 |
|------|----------|
| 过早声明完成 | 必须完成所有 steps 中的验证步骤 |
| 遗留 Bug | 每个 session 开始时运行现有测试 |
| 功能未测试 | 只在 E2E 测试通过后标记 passes: true |
| 环境问题 | 使用 init.sh 脚本确保环境一致 |

---

## 📁 项目文件结构

```
/Users/liguangliang/nas/personal_folder/aicode/Aura/
├── app/                      # Next.js App Router 页面
├── components/               # React 组件
├── lib/                      # 工具函数
├── prisma/                   # 数据库 schema 和迁移
├── styles/                   # 全局样式
├── feature_list.json         # MVP 功能列表 (已完成)
├── feature_list_phase1.json  # Phase 1 功能列表
├── CLAUDE_PROGRESS.md        # 开发进度记录
├── init.sh                   # 开发环境启动脚本
└── AGENT_SESSION_GUIDE.md    # 本文档
```

---

## 🔄 Session 结束检查清单

在结束每个 session 前，确认：

- [ ] 代码已提交到 git
- [ ] `CLAUDE_PROGRESS.md` 已更新
- [ ] `feature_list_phase1.json` 已更新（如功能完成）
- [ ] 开发服务器已停止
- [ ] 没有遗留的控制台错误

---

## 🧪 测试规范

### 单元测试
- 使用 Jest + React Testing Library
- 测试文件放在 `__tests__/` 目录
- 命名规范：`ComponentName.test.tsx`

### E2E 测试
- 使用 Playwright
- 测试文件放在 `e2e/` 目录
- 每个关键用户流程都应有 E2E 测试

### TypeScript 类型检查
- 使用 `npm run typecheck`（执行 `tsc --noEmit -p tsconfig.typecheck.json`）
- 默认不依赖 `.next/types` 生成产物，clean 环境可直接执行
- 如需验证 Next.js 路由增强类型，再运行 `npm run dev` 或 `npm run build`

### Playwright MCP 浏览器调试
使用 Playwright MCP 进行实时浏览器调试和测试：

#### 配置
项目已配置 `.mcp.json` 文件：
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-playwright"]
    }
  }
}
```

#### 使用场景
- **实时调试**: 在开发过程中实时查看页面状态
- **功能验证**: 验证 UI 交互和用户流程
- **截图对比**: 捕获页面截图进行视觉验证
- **表单测试**: 自动填写和提交表单
- **响应式测试**: 测试不同视口尺寸

#### 在开发中使用
每个 session 在实现 UI 功能后，应使用 Playwright MCP 进行验证：

1. **启动测试**
   ```
   请使用 Playwright MCP 打开 http://localhost:3000 并截图
   ```

2. **测试用户流程**
   ```
   使用 Playwright MCP 测试登录流程：
   1. 导航到 /login
   2. 填写邮箱 demo@aura.ai
   3. 填写密码 demo123456
   4. 点击登录按钮
   5. 验证跳转到 /dashboard
   ```

3. **验证 UI 变更**
   ```
   使用 Playwright MCP 截取 /browse 页面的截图，
   验证卡片悬停效果是否正确
   ```

### 运行测试
```bash
# TypeScript 类型检查
npm run typecheck

# 单元测试
npm test

# E2E 测试
npm run test:e2e

# 测试覆盖率
npm test -- --coverage

# 使用 Playwright MCP 调试 (在 Claude Code 中)
# 直接描述你要测试的功能，Agent 会使用 MCP 工具
```

---

## 📝 提交信息规范

使用 Conventional Commits 格式：

```
feat: 添加页面加载动画
fix: 修复登录表单验证问题
docs: 更新 README 文档
style: 统一按钮圆角样式
refactor: 重构卡片组件
test: 添加 Button 组件单元测试
chore: 更新依赖版本
```

---

## 💡 最佳实践

1. **增量开发**: 每次只做一个功能
2. **测试驱动**: 先写测试，再写代码
3. **保持清洁**: 提交前确保代码无 lint 错误
4. **文档同步**: 代码变更后更新相关文档
5. **设计一致**: 使用 Frontend Design skill 确保 UI 一致性
