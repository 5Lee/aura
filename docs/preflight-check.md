# Preflight Check

统一 preflight 检查命令用于人工与代理在开始开发前快速确认环境状态。

脚本位置：`tools/preflight-check.sh`

## 用法

```bash
# 快速模式（默认）
npm run preflight

# 显式快速模式
npm run preflight:fast

# 完整模式
npm run preflight:full

# 跳过数据库检查
bash ./tools/preflight-check.sh --mode fast --skip-db
```

## 检查项

- 依赖检查：`node` / `npm` / `node_modules`
- 数据库检查：`prisma db execute` ping
- 类型检查：`npm run typecheck`
- 测试检查：
  - fast: `npm test -- __tests__/feature-list-meta-consistency.test.js`
  - full: `npm test`
- full 模式额外检查：`npm run lint`、`npm run build`

## 输出格式

脚本输出固定前缀，便于不同机器和代理环境统一解析：

- `[RUN ] <step-id> | <desc>`
- `[PASS] <step-id>`
- `[FAIL] <step-id>`
- `[SKIP] <step-id> | <desc>`
- 最后输出 `total/pass/fail/skip` 汇总。
