# Codex Loop Resilience Guide

`run_codex_loop.sh` 提供了针对 MCP 启动卡住、无进展循环和长时间阻塞的防护。

## Fail-Fast 与恢复参数

- `CODEX_MCP_FAIL_FAST=1|0`  
  是否启用 MCP 启动卡住快速失败（默认 `1`）。
- `CODEX_MCP_FAIL_FAST_SEC=<seconds>`  
  若 Codex 进程在该时间内没有任何输出，判定为启动卡住（默认 `90`）。
- `CODEX_MCP_RETRY_PER_RUN=<n>`  
  单轮任务内，MCP 失败自动重试次数（默认 `1`）。
- `CODEX_MCP_RETRY_DELAY_SEC=<seconds>`  
  MCP 重试前等待时间（默认 `5`）。
- `CODEX_RUN_TIMEOUT_SEC=<seconds>`  
  单轮硬超时；`0` 表示禁用（默认 `0`）。
- `CODEX_DIRTY_WORKTREE_POLICY=stop|warn`  
  每轮启动前工作区卫生策略（默认 `stop`）。
- `CODEX_MAX_TASKS_PER_RUN=<n>`  
  单轮最大允许完成任务数（默认 `1`），超出即中止防止混提。
- `CODEX_MAX_CONSECUTIVE_FAILURES=<n>`  
  连续失败阈值（默认 `2`），达到后中止并等待人工处理。

## 日志中的失败分类

- `mcp-startup-stall`: 启动阶段长时间无输出，被 fail-fast 截断。
- `mcp-startup-timeout`: 日志出现 MCP/启动超时关键字。
- `run-timeout`: 超过 `CODEX_RUN_TIMEOUT_SEC`。
- `task-execution-failed`: 非 MCP 类任务执行失败。
- `empty-log`: 进程失败但未产生输出。
- `dirty-worktree`: 启动前工作区非干净状态且策略为 `stop`。
- `task-isolation-violation`: 单轮完成任务数超阈值。
- `consecutive-failure-threshold`: 连续失败达到阈值。

## 停止策略

- 脚本会在以下条件停止：
  - 待办任务归零（`completed`）
  - 达到 `max_runs`
  - 连续无进展达到 `CODEX_MAX_NO_PROGRESS`
  - 失败且 `CODEX_CONTINUE_ON_ERROR=0`
- 当 `CODEX_CONTINUE_ON_ERROR=1` 时，会记录失败并继续下一轮，避免整个循环因单次异常中断。

## 中断后继续执行

- 每轮会写入状态文件：`logs/codex-loop/<timestamp>/loop_state.json`
- 每轮会追加摘要：`logs/codex-loop/<timestamp>/runs.jsonl`
- 若因 `dirty-worktree` 或 `task-isolation-violation` 中止：
  1. 先处理工作区（提交/整理改动）  
  2. 重新执行 `run_codex_loop.sh`，继续使用同一个 `CODEX_FEATURE_FILE`
- 若因 MCP 失败中止，可先提高 `CODEX_MCP_FAIL_FAST_SEC` 或 `CODEX_MCP_RETRY_PER_RUN` 再重启循环。

## 诊断与归档工具

- 一键查看最新轮次摘要：

```bash
./tools/loop-log-summary.sh
```

- 查看指定轮次目录（支持 JSON）：

```bash
./tools/loop-log-summary.sh --dir logs/codex-loop/<timestamp> --json
```

- 按日期归档旧日志（默认保留最近 7 天）：

```bash
./tools/loop-log-archive.sh --keep-days 7
```

- 预览归档动作（不执行）：

```bash
./tools/loop-log-archive.sh --keep-days 7 --dry-run
```

## 建议启动方式

```bash
CODEX_FEATURE_FILE=feature_list_phase2.json \
CODEX_CONTINUE_ON_ERROR=1 \
CODEX_MCP_FAIL_FAST=1 \
CODEX_MCP_FAIL_FAST_SEC=90 \
CODEX_MCP_RETRY_PER_RUN=1 \
CODEX_MAX_NO_PROGRESS=3 \
./run_codex_loop.sh
```
