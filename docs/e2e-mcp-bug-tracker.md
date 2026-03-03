# Phase 3 E2E MCP Bug Tracker

## Usage

- 每个发现的 bug 新增一条记录，状态流转：`OPEN -> WAIT_USER -> IN_PROGRESS -> FIXED -> VERIFIED -> CLOSED`
- `WAIT_USER` 表示已询问用户是否修复，等待确认。
- 证据优先记录截图与复现路径。

## Bugs

| ID | Priority | Status | Feature | Title | Repro | Expected | Actual | Evidence | Fix Commit | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| E2E-20260303-001 | P3 | WAIT_USER | phase3-e2e-001 | 缺少 favicon 导致控制台 404 报错 | 打开 `/register` 或首页，观察控制台错误 | 控制台无资源 404 报错 | 持续出现 `GET /favicon.ico 404` | `logs/e2e-mcp/20260303-round1-auth/console-errors.log`, `logs/e2e-mcp/20260303-round1-auth/logout-home.png` | - | 不阻塞主流程，但影响质量门禁和可观测性 |
