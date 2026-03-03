#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./run_codex_loop.sh [max_runs]

Arguments:
  [max_runs]  Optional positive integer. Safety cap for maximum runs.
              If omitted, it runs continuously until all pending features are done.

Environment overrides (optional):
  CODEX_BIN                  Codex command binary/path (default: codex).
  CODEX_PROMPT               Custom initial prompt for every run.
  CODEX_SANDBOX_MODE         Sandbox mode (default: danger-full-access).
  CODEX_APPROVAL_MODE        Approval policy (default: never).
  CODEX_DANGEROUS_BYPASS     1=add --dangerously-bypass-approvals-and-sandbox.
  CODEX_MODEL                Model name passed to Codex (optional).
  CODEX_CONTINUE_ON_ERROR    1=continue after a failed run, 0=stop immediately (default: 0).
  CODEX_FEATURE_FILE         Feature JSON file path (default: <repo>/feature_list_phase1.json).
  CODEX_MAX_NO_PROGRESS      Stop after N runs with no pending-task reduction (default: 3).
  CODEX_RUN_TIMEOUT_SEC      Hard timeout per run in seconds; 0=disabled (default: 0).
  CODEX_SKIP_PREFLIGHT       1=skip write-permission preflight check (default: 0).
  CODEX_PREFLIGHT_RETRIES    Retry count for preflight command failures (default: 3).
  CODEX_PREFLIGHT_RETRY_SEC  Seconds between preflight retries (default: 5).
  CODEX_MCP_STARTUP_TIMEOUT  Override playwright MCP startup timeout in seconds (default: 30).
  CODEX_MCP_FAIL_FAST        1=kill run when startup appears stuck (default: 1).
  CODEX_MCP_FAIL_FAST_SEC    Seconds with empty output before treating as MCP stall (default: 90).
  CODEX_MCP_RETRY_PER_RUN    Retry count when MCP startup fails in one run (default: 1).
  CODEX_MCP_RETRY_DELAY_SEC  Delay between MCP retries in seconds (default: 5).
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 1
fi

if [[ $# -eq 1 ]] && ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] [max_runs] must be a positive integer when provided, got: $1" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="$ROOT_DIR/logs/codex-loop/$TIMESTAMP"
mkdir -p "$LOG_DIR"
MAX_RUNS="${1:-0}"

DEFAULT_PROMPT="请根据 AGENT_SESSION_GUIDE.md 的流程执行下一次开发循环：从 task 列表中选择一个新的最高优先级未完成任务（若无 task 目录则使用 feature_list_phase1.json），一次只完成一个任务，完成开发与测试，更新 CLAUDE_PROGRESS.md 和 feature_list_phase1.json（仅修改 passes 状态），并按 Conventional Commits 提交代码。"
CODEX_BIN="${CODEX_BIN:-codex}"
PROMPT="${CODEX_PROMPT:-$DEFAULT_PROMPT}"
SANDBOX_MODE="${CODEX_SANDBOX_MODE:-danger-full-access}"
APPROVAL_MODE="${CODEX_APPROVAL_MODE:-never}"
DANGEROUS_BYPASS="${CODEX_DANGEROUS_BYPASS:-0}"
CONTINUE_ON_ERROR="${CODEX_CONTINUE_ON_ERROR:-0}"
FEATURE_FILE="${CODEX_FEATURE_FILE:-$ROOT_DIR/feature_list_phase1.json}"
MAX_NO_PROGRESS="${CODEX_MAX_NO_PROGRESS:-3}"
RUN_TIMEOUT_SEC="${CODEX_RUN_TIMEOUT_SEC:-0}"
SKIP_PREFLIGHT="${CODEX_SKIP_PREFLIGHT:-0}"
PREFLIGHT_RETRIES="${CODEX_PREFLIGHT_RETRIES:-3}"
PREFLIGHT_RETRY_SEC="${CODEX_PREFLIGHT_RETRY_SEC:-5}"
MCP_STARTUP_TIMEOUT="${CODEX_MCP_STARTUP_TIMEOUT:-30}"
MCP_FAIL_FAST="${CODEX_MCP_FAIL_FAST:-1}"
MCP_FAIL_FAST_SEC="${CODEX_MCP_FAIL_FAST_SEC:-90}"
MCP_RETRY_PER_RUN="${CODEX_MCP_RETRY_PER_RUN:-1}"
MCP_RETRY_DELAY_SEC="${CODEX_MCP_RETRY_DELAY_SEC:-5}"

if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
  echo "[ERROR] codex command not found in PATH: $CODEX_BIN" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq is required but not found in PATH." >&2
  exit 1
fi

if [[ ! -f "$FEATURE_FILE" ]]; then
  echo "[ERROR] Feature file not found: $FEATURE_FILE" >&2
  exit 1
fi

if ! [[ "$MAX_NO_PROGRESS" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] CODEX_MAX_NO_PROGRESS must be a positive integer, got: $MAX_NO_PROGRESS" >&2
  exit 1
fi

if ! [[ "$RUN_TIMEOUT_SEC" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] CODEX_RUN_TIMEOUT_SEC must be a non-negative integer, got: $RUN_TIMEOUT_SEC" >&2
  exit 1
fi

if ! [[ "$PREFLIGHT_RETRIES" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] CODEX_PREFLIGHT_RETRIES must be a positive integer, got: $PREFLIGHT_RETRIES" >&2
  exit 1
fi

if ! [[ "$PREFLIGHT_RETRY_SEC" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] CODEX_PREFLIGHT_RETRY_SEC must be a non-negative integer, got: $PREFLIGHT_RETRY_SEC" >&2
  exit 1
fi

if ! [[ "$MCP_STARTUP_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] CODEX_MCP_STARTUP_TIMEOUT must be a positive integer, got: $MCP_STARTUP_TIMEOUT" >&2
  exit 1
fi

if ! [[ "$MCP_FAIL_FAST" =~ ^[01]$ ]]; then
  echo "[ERROR] CODEX_MCP_FAIL_FAST must be 0 or 1, got: $MCP_FAIL_FAST" >&2
  exit 1
fi

if ! [[ "$MCP_FAIL_FAST_SEC" =~ ^[1-9][0-9]*$ ]]; then
  echo "[ERROR] CODEX_MCP_FAIL_FAST_SEC must be a positive integer, got: $MCP_FAIL_FAST_SEC" >&2
  exit 1
fi

if ! [[ "$MCP_RETRY_PER_RUN" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] CODEX_MCP_RETRY_PER_RUN must be a non-negative integer, got: $MCP_RETRY_PER_RUN" >&2
  exit 1
fi

if ! [[ "$MCP_RETRY_DELAY_SEC" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] CODEX_MCP_RETRY_DELAY_SEC must be a non-negative integer, got: $MCP_RETRY_DELAY_SEC" >&2
  exit 1
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

count_pending_features() {
  jq '[.features[] | select(.passes == false)] | length' "$FEATURE_FILE"
}

get_head() {
  git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "N/A"
}

build_codex_cmd() {
  local prompt="$1"
  CODEX_CMD=("$CODEX_BIN")
  if [[ "$DANGEROUS_BYPASS" == "1" ]]; then
    CODEX_CMD+=(--dangerously-bypass-approvals-and-sandbox)
  else
    CODEX_CMD+=(-a "$APPROVAL_MODE" -s "$SANDBOX_MODE")
  fi
  if [[ -n "${CODEX_MODEL:-}" ]]; then
    CODEX_CMD+=(-m "$CODEX_MODEL")
  fi
  CODEX_CMD+=(-c "mcp_servers.playwright.startup_timeout_sec=$MCP_STARTUP_TIMEOUT")
  CODEX_CMD+=(exec -C "$ROOT_DIR" "$prompt")
}

is_mcp_failure_reason() {
  local reason="$1"
  [[ "$reason" == "mcp-startup-stall" || "$reason" == "mcp-startup-timeout" ]]
}

classify_failure_from_log() {
  local log_file="$1"
  if [[ ! -s "$log_file" ]]; then
    echo "empty-log"
    return
  fi

  if grep -Eiq 'mcp|playwright.*startup|startup.*timeout|timed out.*mcp' "$log_file"; then
    echo "mcp-startup-timeout"
    return
  fi

  echo "task-execution-failed"
}

run_codex_cmd_with_watchdog() {
  local out_log="$1"
  local context_label="$2"

  local status=0
  local reason="ok"
  local elapsed=0
  local start_ts
  start_ts="$(date +%s)"
  : >"$out_log"

  "${CODEX_CMD[@]}" >"$out_log" 2>&1 &
  local codex_pid=$!

  while kill -0 "$codex_pid" 2>/dev/null; do
    elapsed=$(( $(date +%s) - start_ts ))

    if [[ "$RUN_TIMEOUT_SEC" -gt 0 && "$elapsed" -ge "$RUN_TIMEOUT_SEC" ]]; then
      reason="run-timeout"
      log "[WARN] ${context_label}: hit CODEX_RUN_TIMEOUT_SEC=${RUN_TIMEOUT_SEC}s."
      break
    fi

    if [[ "$MCP_FAIL_FAST" == "1" && "$elapsed" -ge "$MCP_FAIL_FAST_SEC" && ! -s "$out_log" ]]; then
      reason="mcp-startup-stall"
      log "[WARN] ${context_label}: no output for ${MCP_FAIL_FAST_SEC}s, fail-fast triggered."
      break
    fi

    sleep 1
  done

  if [[ "$reason" != "ok" ]]; then
    pkill -TERM -P "$codex_pid" 2>/dev/null || true
    kill -TERM "$codex_pid" 2>/dev/null || true
    sleep 1
    pkill -KILL -P "$codex_pid" 2>/dev/null || true
    kill -KILL "$codex_pid" 2>/dev/null || true
  fi

  set +e
  wait "$codex_pid"
  status=$?
  set -e

  if [[ "$reason" == "ok" && "$status" -ne 0 ]]; then
    reason="$(classify_failure_from_log "$out_log")"
  fi

  cat "$out_log"
  RUN_CMD_STATUS="$status"
  RUN_CMD_REASON="$reason"
}

run_preflight_write_check() {
  local probe_file="$ROOT_DIR/.codex_write_probe"
  local probe_log="$LOG_DIR/preflight.log"
  local probe_prompt="预检：请只做一件事，在当前仓库根目录创建文件 .codex_write_probe，内容是 OK。完成后只回复 PRECHECK_OK。"
  local attempt=0

  while [[ "$attempt" -lt "$PREFLIGHT_RETRIES" ]]; do
    attempt=$((attempt + 1))
    rm -f "$probe_file"
    : >"$probe_log"

    log "Running preflight write check (attempt $attempt/$PREFLIGHT_RETRIES)..."
    build_codex_cmd "$probe_prompt"
    run_codex_cmd_with_watchdog "$probe_log" "preflight"
    local preflight_status="$RUN_CMD_STATUS"
    local preflight_reason="$RUN_CMD_REASON"

    if [[ "$preflight_status" -eq 0 && -f "$probe_file" ]]; then
      rm -f "$probe_file"
      log "Preflight write check passed."
      return 0
    fi

    if [[ "$preflight_status" -ne 0 ]]; then
      log "[WARN] Preflight command failed with exit code $preflight_status."
    fi
    if [[ ! -f "$probe_file" ]]; then
      log "[WARN] Preflight did not create .codex_write_probe."
    fi
    log "[WARN] Preflight failure reason: $preflight_reason"
    log "Preflight log: $probe_log"

    if [[ "$attempt" -lt "$PREFLIGHT_RETRIES" ]]; then
      if [[ "$PREFLIGHT_RETRY_SEC" -gt 0 ]]; then
        log "Retrying preflight in ${PREFLIGHT_RETRY_SEC}s..."
        sleep "$PREFLIGHT_RETRY_SEC"
      else
        log "Retrying preflight immediately..."
      fi
    fi
  done

  log "[ERROR] Preflight write check failed after $PREFLIGHT_RETRIES attempts."
  return 1
}

SUCCESS=0
FAILED=0
RUN_INDEX=0
NO_PROGRESS_STREAK=0
STOP_REASON="completed"
START_TS="$(date +%s)"
INITIAL_PENDING="$(count_pending_features)"

if ! [[ "$INITIAL_PENDING" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] Failed to read pending feature count from: $FEATURE_FILE" >&2
  exit 1
fi

if [[ "$INITIAL_PENDING" -eq 0 ]]; then
  log "No pending features found in $FEATURE_FILE. Nothing to do."
  exit 0
fi

log "Starting Codex loop."
log "Workspace: $ROOT_DIR"
log "Feature file: $FEATURE_FILE"
log "Initial pending features: $INITIAL_PENDING"
if [[ "$MAX_RUNS" -eq 0 ]]; then
  log "Max runs: unlimited (until pending features become 0)"
else
  log "Max runs: $MAX_RUNS"
fi
log "Logs: $LOG_DIR"
log "Codex binary: $CODEX_BIN"
log "Approval mode: $APPROVAL_MODE"
log "Sandbox mode: $SANDBOX_MODE"
log "Dangerous bypass: $DANGEROUS_BYPASS"
log "No-progress stop threshold: $MAX_NO_PROGRESS"
log "Run timeout (sec): $RUN_TIMEOUT_SEC"
log "MCP fail-fast: $MCP_FAIL_FAST (sec: $MCP_FAIL_FAST_SEC)"
log "MCP retry per run: $MCP_RETRY_PER_RUN (delay: ${MCP_RETRY_DELAY_SEC}s)"

if [[ "$SKIP_PREFLIGHT" != "1" ]]; then
  if ! run_preflight_write_check; then
    if [[ "$CONTINUE_ON_ERROR" == "1" ]]; then
      log "[WARN] Continuing despite preflight failure because CODEX_CONTINUE_ON_ERROR=1."
    else
      exit 3
    fi
  fi
else
  log "Skipping preflight write check (CODEX_SKIP_PREFLIGHT=1)."
fi

while true; do
  pending_before="$(count_pending_features)"
  if [[ "$pending_before" -eq 0 ]]; then
    STOP_REASON="completed"
    break
  fi

  if [[ "$MAX_RUNS" -gt 0 && "$RUN_INDEX" -ge "$MAX_RUNS" ]]; then
    STOP_REASON="max-runs-reached"
    break
  fi

  RUN_INDEX=$((RUN_INDEX + 1))
  run_log="$LOG_DIR/run-$(printf '%03d' "$RUN_INDEX").log"
  head_before="$(get_head)"
  build_codex_cmd "$PROMPT"

  log "------------------------------------------------------------"
  log "Run #$RUN_INDEX started."
  log "Pending before run: $pending_before"
  log "Git HEAD before run: $head_before"
  log "Output file: $run_log"
  log "Command: $(printf '%q ' "${CODEX_CMD[@]}")"

  status=1
  failure_reason="task-execution-failed"
  attempt=0
  max_attempts=$((MCP_RETRY_PER_RUN + 1))

  while [[ "$attempt" -lt "$max_attempts" ]]; do
    attempt=$((attempt + 1))
    attempt_log="$run_log"
    if [[ "$attempt" -gt 1 ]]; then
      attempt_log="$LOG_DIR/run-$(printf '%03d' "$RUN_INDEX")-attempt-$(printf '%02d' "$attempt").log"
    fi

    build_codex_cmd "$PROMPT"
    if [[ "$attempt" -gt 1 ]]; then
      log "Retry attempt #$attempt/$max_attempts for run #$RUN_INDEX."
      log "Retry output file: $attempt_log"
      log "Command: $(printf '%q ' "${CODEX_CMD[@]}")"
    fi

    run_codex_cmd_with_watchdog "$attempt_log" "run #$RUN_INDEX attempt #$attempt"
    status="$RUN_CMD_STATUS"
    failure_reason="$RUN_CMD_REASON"

    if [[ "$status" -eq 0 ]]; then
      break
    fi

    if is_mcp_failure_reason "$failure_reason" && [[ "$attempt" -lt "$max_attempts" ]]; then
      log "[WARN] Run #$RUN_INDEX MCP startup issue detected ($failure_reason)."
      if [[ "$MCP_RETRY_DELAY_SEC" -gt 0 ]]; then
        log "Retrying MCP startup in ${MCP_RETRY_DELAY_SEC}s..."
        sleep "$MCP_RETRY_DELAY_SEC"
      fi
      continue
    fi

    break
  done

  pending_after="$(count_pending_features)"
  solved_this_run=$((pending_before - pending_after))
  total_done=$((INITIAL_PENDING - pending_after))
  progress=$((total_done * 100 / INITIAL_PENDING))
  head_after="$(get_head)"
  head_changed="no"
  if [[ "$head_before" != "$head_after" ]]; then
    head_changed="yes"
  fi

  if [[ $status -eq 0 ]]; then
    SUCCESS=$((SUCCESS + 1))
    log "Run #$RUN_INDEX finished successfully."
  else
    FAILED=$((FAILED + 1))
    log "Run #$RUN_INDEX failed with exit code: $status"
    log "Failure reason: $failure_reason"
    if [[ "$CONTINUE_ON_ERROR" != "1" ]]; then
      log "Stopping early. Set CODEX_CONTINUE_ON_ERROR=1 to continue on failures."
      STOP_REASON="$failure_reason"
      break
    fi
  fi

  log "Pending after run: $pending_after"
  log "Tasks completed this run: $solved_this_run"
  log "Overall progress: ${total_done}/${INITIAL_PENDING} (${progress}%)"
  log "Git HEAD after run: $head_after (changed: $head_changed)"

  if [[ "$solved_this_run" -gt 0 ]]; then
    NO_PROGRESS_STREAK=0
  else
    NO_PROGRESS_STREAK=$((NO_PROGRESS_STREAK + 1))
    log "No task-status progress detected (${NO_PROGRESS_STREAK}/${MAX_NO_PROGRESS})."
    if [[ "$NO_PROGRESS_STREAK" -ge "$MAX_NO_PROGRESS" ]]; then
      STOP_REASON="no-progress-threshold"
      log "Stopping to avoid infinite loop; pending count did not decrease."
      break
    fi
  fi
done

END_TS="$(date +%s)"
ELAPSED=$((END_TS - START_TS))
REMAINING="$(count_pending_features)"

log "============================================================"
log "Codex loop complete."
log "Stop reason: $STOP_REASON"
log "Total runs executed: $RUN_INDEX"
log "Succeeded: $SUCCESS"
log "Failed: $FAILED"
log "Remaining pending features: $REMAINING"
log "Elapsed: ${ELAPSED}s"
log "Log directory: $LOG_DIR"

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi

if [[ "$REMAINING" -gt 0 ]]; then
  exit 2
fi
