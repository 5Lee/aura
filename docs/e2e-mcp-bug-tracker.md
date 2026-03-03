# Phase 3 E2E MCP Bug Tracker

## Usage

- 每个发现的 bug 新增一条记录，状态流转：`OPEN -> WAIT_USER -> IN_PROGRESS -> FIXED -> VERIFIED -> CLOSED`
- `WAIT_USER` 表示已询问用户是否修复，等待确认。
- 证据优先记录截图与复现路径。

## Bugs

| ID | Priority | Status | Feature | Title | Repro | Expected | Actual | Evidence | Fix Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-20260303-001 | P3 | WAIT_USER | phase3-e2e-001 | 缺少 favicon 导致控制台 404 报错 | 打开 `/register` 或首页，观察控制台错误 | 控制台无资源 404 报错 | 持续出现 `GET /favicon.ico 404` | `logs/e2e-mcp/20260303-round1-auth/console-errors.log`, `logs/e2e-mcp/20260303-round1-auth/logout-home.png` | - | 不阻塞主流程，但影响质量门禁和可观测性 |
| E2E-20260303-002 | P2 | WAIT_USER | phase3-e2e-002 | 登录页空提交未展示自定义校验文案 | 打开 `/login`，不填写字段直接点“登录” | 展示“请输入邮箱地址 / 请输入密码”内联提示 | 表单被原生 `required` 拦截，页面无自定义错误提示 | `logs/e2e-mcp/20260303-round2-auth-negative/empty-submit.png`, `logs/e2e-mcp/20260303-round2-auth-negative/round2-report.json` | - | 用户可继续操作，但提示一致性与可测试性较弱 |
| E2E-20260303-003 | P3 | WAIT_USER | phase3-e2e-002 | 未登录访问 `/dashboard` 会先出现加载态再跳转登录 | 未登录直接访问 `/dashboard` | 直接进入登录页或立即重定向，无中间态闪烁 | 先停留在 `/dashboard` 并显示 “Aura 正在准备内容...”，随后跳转 `/login` | `logs/e2e-mcp/20260303-round2-auth-negative/dashboard-unauth-initial.png`, `logs/e2e-mcp/20260303-round2-auth-negative/dashboard-unauth-final.png`, `logs/e2e-mcp/20260303-round2-auth-negative/round2-report.json` | - | 体验问题，不阻塞功能 |
| E2E-20260303-004 | P3 | WAIT_USER | phase3-e2e-002 | 错误密码场景产生控制台 401 错误日志 | `/login` 输入正确邮箱+错误密码并提交 | 登录失败提示可见，控制台无额外 error 级噪音 | 浏览器控制台出现 `Failed to load resource ... 401` | `logs/e2e-mcp/20260303-round2-auth-negative/wrong-password.png`, `logs/e2e-mcp/20260303-round2-auth-negative/console-errors.log`, `logs/e2e-mcp/20260303-round2-auth-negative/network-requests.log` | - | 失败行为符合预期，但观测面存在噪音 |
