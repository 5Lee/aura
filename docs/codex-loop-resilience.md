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

## 日志中的失败分类

- `mcp-startup-stall`: 启动阶段长时间无输出，被 fail-fast 截断。
- `mcp-startup-timeout`: 日志出现 MCP/启动超时关键字。
- `run-timeout`: 超过 `CODEX_RUN_TIMEOUT_SEC`。
- `task-execution-failed`: 非 MCP 类任务执行失败。
- `empty-log`: 进程失败但未产生输出。

## 停止策略

- 脚本会在以下条件停止：
  - 待办任务归零（`completed`）
  - 达到 `max_runs`
  - 连续无进展达到 `CODEX_MAX_NO_PROGRESS`
  - 失败且 `CODEX_CONTINUE_ON_ERROR=0`
- 当 `CODEX_CONTINUE_ON_ERROR=1` 时，会记录失败并继续下一轮，避免整个循环因单次异常中断。

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
