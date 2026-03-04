# Phase 4 GitHub 对标与差距矩阵

## 对标项目

- [langfuse/langfuse](https://github.com/langfuse/langfuse)
  - 可借鉴点：Prompt 版本管理、Playground 试验、线上追踪与评测闭环。
- [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo)
  - 可借鉴点：断言驱动评测、回归基线、CI 门禁接入。
- [open-webui/open-webui](https://github.com/open-webui/open-webui)
  - 可借鉴点：多角色协作、权限治理、可扩展工作流。
- [PromptStack/promptstack](https://github.com/PromptStack/promptstack)
  - 可借鉴点：模板化变量、提示词复用与知识库式组织。

## 能力矩阵（五维）

| 维度 | 对标能力 | Aura 当前 | Aura 目标 | 对应任务 |
|---|---|---|---|---|
| 功能 | 版本历史 + 回滚 | 仅当前态，缺少版本链路 | 可查看历史、diff、一键回滚 | `phase4-week1-002`, `phase4-week2-001`, `phase4-week2-002` |
| 功能 | 变量模板 + 渲染预览 | 文本为主，变量管理薄弱 | 支持变量定义、校验、渲染 | `phase4-week1-003`, `phase4-week2-003` |
| 协作 | 发布流 + 角色权限 | 单角色主导，协作弱 | 草稿/审核/发布 + 角色矩阵 | `phase4-week4-001`, `phase4-week4-002` |
| 测试 | Prompt Evals + 回归 | 主要是功能 E2E | 提示词断言回归 + CI 门禁 | `phase4-week3-001`, `phase4-week3-002`, `phase4-week3-003` |
| 治理 | 审计日志 + 风险追踪 | 变更可追溯能力不足 | 全链路操作审计 + 质量看板 | `phase4-week1-004`, `phase4-week3-004` |

## Aura 差距结论

1. 提示词资产层缺少“可恢复历史”，导致变更风险高、回滚慢。
2. 提示词质量层缺少“机器可执行标准”，难以稳定迭代。
3. 协作治理层缺少“发布与权限机制”，多人场景下不稳。
4. 操作效率层缺少“批量与高级筛选”，规模化管理成本高。
5. 发布保障层缺少“Prompt 回归门禁”，上线风险暴露过晚。

## 执行优先级与依赖

- P0（必须先做）
  - `phase4-week1-002` 版本模型
  - `phase4-week1-003` 模板变量模型
  - `phase4-week1-004` 审计日志基线
- P1（依赖 P0）
  - `phase4-week2-001` 历史与 diff
  - `phase4-week2-002` 回滚机制
  - `phase4-week3-001` 测试用例管理
  - `phase4-week3-002` 评测执行器
  - `phase4-week3-003` CI 门禁
- P2（体验与放大）
  - `phase4-week2-004` 高级检索
  - `phase4-week4-003` 批量操作
  - `phase4-week4-004` Prompt-as-Code
  - `phase4-week5-*` 性能、安全、上线验收

## 对应任务清单

- 见：`feature_list_phase4_product_optimization.json`
