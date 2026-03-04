# Phase 4 Release Readiness

日期：2026-03-04

## 验收范围

- 功能链路：提示词创建、编辑、版本对比、回滚、发布流、批量操作、Prompt-as-Code。
- 权限边界：Owner / Editor / Reviewer / Viewer 角色能力矩阵与私有资源访问控制。
- 安全基线：模板渲染输入净化、注入防护、越权访问拦截。
- 性能目标：大列表分页、热点缓存、版本与评测查询优化。
- 移动端可用性：关键操作路径与导航可访问性回归。

## 验收矩阵

| 维度 | 验证方式 | 结果 | 证据 |
|---|---|---|---|
| 功能回归 | `npm run preflight:full`（含 typecheck/lint/test/build） | PASS | `total=8 pass=8 fail=0 skip=0` |
| 自动化回归 | `npm run test:e2e -- --reporter=line` | PASS | `7 passed, 0 failed, 0 skipped` |
| 权限边界 | E2E 历史权限缺陷复测记录 | PASS | `logs/e2e-mcp/20260304-round11-bugfix-final-retest/retest-report.json` |
| 安全与输入治理 | Week5-002 安全加固 + 单测回归 | PASS | `logs/phase4/20260304-week5-security-hardening/report.json` |
| 性能目标 | 1k+ 数据集压测（P95） | PASS | `logs/phase4/20260304-week5-performance-optimization/report.json` |
| 移动端关键路径 | MCP 终轮复测记录 | PASS | `logs/e2e-mcp/20260304-round11-bugfix-final-retest/retest-report.json` |

## Bug 台账闭环

- 台账文件：`docs/e2e-mcp-bug-tracker.md`
- 当前统计：7 个历史问题全部为 `CLOSED`，包含 1 个 P0（E2E-20260303-006）且已完成复测关闭。
- 终轮复测证据：`logs/e2e-mcp/20260304-round11-bugfix-final-retest/retest-report.json`

## 上线检查清单

- [x] 全量质量门禁通过（typecheck/lint/test/build）。
- [x] 核心 E2E 套件通过（auth/prompt-crud/prompt-evals/prompt-versioning）。
- [x] 已知高优缺陷全部关闭并附带复测证据。
- [x] 发布流与权限边界在回归中无新增阻断问题。
- [x] 性能目标（P95）达标并留档。
- [x] Phase 4 文档、日志、进度记录完成归档。

## 回滚预案

1. 应用回滚：将部署版本回退到上一个稳定 Tag（Week5-003 完成节点）。
2. 数据回滚：对 `prompts`/`prompt_versions` 使用上线前快照恢复；如仅需逻辑回滚，优先执行应用层回退避免直接改库。
3. 验证步骤：
   - 运行 `npm run preflight:fast -- --skip-db` 快速确认应用健康。
   - 执行关键烟雾路径（登录、列表、详情、编辑、发布）。
   - 抽检私有提示词权限接口（未登录/非成员/作者）返回码。
4. 决策门槛：若出现 P0 数据一致性或权限泄漏问题，直接触发全量回滚并暂停新发布。

## 结论

Phase 4 所有 20 个任务项已完成并通过验收，可进入发布窗口。
