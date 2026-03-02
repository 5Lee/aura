#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./run_codex_loop.sh <times>

Arguments:
  <times>   Positive integer. How many full Codex development runs to execute.

Environment overrides (optional):
  CODEX_PROMPT             Custom initial prompt for every run.
  CODEX_SANDBOX_MODE       Sandbox mode (default: danger-full-access).
  CODEX_APPROVAL_MODE      Approval policy (default: never).
  CODEX_MODEL              Model name passed to Codex (optional).
  CODEX_CONTINUE_ON_ERROR  1=continue after a failed run, 0=stop immediately (default: 0).
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

if ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] <times> must be a positive integer, got: $1" >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "[ERROR] codex command not found in PATH." >&2
  exit 1
fi

RUNS="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT_DIR/logs/codex-loop/$TIMESTAMP"
mkdir -p "$LOG_DIR"

DEFAULT_PROMPT="请根据 AGENT_SESSION_GUIDE.md 的流程执行下一次开发循环：从 task 列表中选择一个新的最高优先级未完成任务（若无 task 目录则使用 feature_list_phase1.json），一次只完成一个任务，完成开发与测试，更新 CLAUDE_PROGRESS.md 和 feature_list_phase1.json（仅修改 passes 状态），并按 Conventional Commits 提交代码。"
PROMPT="${CODEX_PROMPT:-$DEFAULT_PROMPT}"
SANDBOX_MODE="${CODEX_SANDBOX_MODE:-danger-full-access}"
APPROVAL_MODE="${CODEX_APPROVAL_MODE:-never}"
CONTINUE_ON_ERROR="${CODEX_CONTINUE_ON_ERROR:-0}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

SUCCESS=0
FAILED=0
START_TS="$(date +%s)"

log "Starting Codex loop."
log "Workspace: $ROOT_DIR"
log "Total runs: $RUNS"
log "Logs: $LOG_DIR"
log "Approval mode: $APPROVAL_MODE"
log "Sandbox mode: $SANDBOX_MODE"

for ((i = 1; i <= RUNS; i++)); do
  run_log="$LOG_DIR/run-$(printf '%03d' "$i").log"
  progress=$((i * 100 / RUNS))
  cmd=(codex -a "$APPROVAL_MODE" -s "$SANDBOX_MODE")
  if [[ -n "${CODEX_MODEL:-}" ]]; then
    cmd+=(-m "$CODEX_MODEL")
  fi
  cmd+=(exec -C "$ROOT_DIR" "$PROMPT")

  log "------------------------------------------------------------"
  log "Run $i/$RUNS (${progress}%) started."
  log "Output file: $run_log"
  log "Command: $(printf '%q ' "${cmd[@]}")"

  set +e
  "${cmd[@]}" 2>&1 | tee "$run_log"
  status=${PIPESTATUS[0]}
  set -e

  if [[ $status -eq 0 ]]; then
    SUCCESS=$((SUCCESS + 1))
    log "Run $i/$RUNS finished successfully."
  else
    FAILED=$((FAILED + 1))
    log "Run $i/$RUNS failed with exit code: $status"
    if [[ "$CONTINUE_ON_ERROR" != "1" ]]; then
      log "Stopping early. Set CODEX_CONTINUE_ON_ERROR=1 to continue on failures."
      break
    fi
  fi
done

END_TS="$(date +%s)"
ELAPSED=$((END_TS - START_TS))

log "============================================================"
log "Codex loop complete."
log "Succeeded: $SUCCESS"
log "Failed: $FAILED"
log "Elapsed: ${ELAPSED}s"
log "Log directory: $LOG_DIR"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi
