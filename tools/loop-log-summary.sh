#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_BASE="$ROOT_DIR/logs/codex-loop"
TARGET_DIR=""
OUTPUT_JSON=0

usage() {
  cat <<'EOF'
Usage:
  ./tools/loop-log-summary.sh [--latest] [--dir <path>] [--json]

Options:
  --latest       Use latest log directory under logs/codex-loop (default behavior).
  --dir <path>   Use a specific loop log directory.
  --json         Output machine-readable JSON summary.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest)
      shift
      ;;
    --dir)
      TARGET_DIR="${2:-}"
      if [[ -z "$TARGET_DIR" ]]; then
        echo "[ERROR] --dir requires a value." >&2
        exit 1
      fi
      shift 2
      ;;
    --json)
      OUTPUT_JSON=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq is required but not found." >&2
  exit 1
fi

if [[ -z "$TARGET_DIR" ]]; then
  TARGET_DIR="$(
    find "$LOG_BASE" -maxdepth 1 -mindepth 1 -type d -name '20*' \
      | while read -r dir; do
          if [[ -f "$dir/runs.jsonl" ]]; then
            echo "$dir"
          fi
        done \
      | sort \
      | tail -n 1
  )"
fi

if [[ -z "${TARGET_DIR:-}" || ! -d "$TARGET_DIR" ]]; then
  echo "[ERROR] No loop log directory found." >&2
  exit 1
fi

RUNS_FILE="$TARGET_DIR/runs.jsonl"
STATE_FILE="$TARGET_DIR/loop_state.json"

if [[ ! -f "$RUNS_FILE" ]]; then
  echo "[ERROR] runs.jsonl not found in $TARGET_DIR" >&2
  echo "Hint: run with --dir <path> targeting a newer loop directory." >&2
  exit 1
fi

run_count="$(wc -l <"$RUNS_FILE" | tr -d ' ')"

if [[ "$run_count" -eq 0 ]]; then
  if [[ "$OUTPUT_JSON" -eq 1 ]]; then
    jq -n --arg dir "$TARGET_DIR" '{log_dir:$dir,runs:0}'
    exit 0
  fi
  echo "Log dir: $TARGET_DIR"
  echo "No runs found."
  exit 0
fi

summary_json="$(jq -s --arg dir "$TARGET_DIR" '
  . as $runs
  | {
      log_dir: $dir,
      run_count: ($runs | length),
      success_count: ($runs | map(select(.status == 0)) | length),
      failure_count: ($runs | map(select(.status != 0)) | length),
      latest_pending: ($runs[-1].pending_after),
      failure_reasons: (
        $runs
        | map(select(.status != 0))
        | group_by(.reason)
        | map({reason: .[0].reason, count: length})
      ),
      runs: $runs
    }
' "$RUNS_FILE")"

if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  if [[ -f "$STATE_FILE" ]]; then
    jq --argjson state "$(cat "$STATE_FILE")" '. + {state: $state}' <<<"$summary_json"
  else
    echo "$summary_json"
  fi
  exit 0
fi

echo "Log dir: $TARGET_DIR"
if [[ -f "$STATE_FILE" ]]; then
  echo "State : $(jq -r '.stop_reason + " | pending=" + (.pending_remaining|tostring)' "$STATE_FILE")"
fi
echo "Runs  : $(jq -r '.run_count|tostring' <<<"$summary_json")"
echo "OK/NG : $(jq -r '.success_count|tostring' <<<"$summary_json")/$(jq -r '.failure_count|tostring' <<<"$summary_json")"
echo "Remain: $(jq -r '.latest_pending|tostring' <<<"$summary_json")"
echo ""
echo "Per-run:"
echo "run status reason solved pending_after log"
jq -r '.runs[] | "\(.run_index) \(.status) \(.reason) \(.solved_this_run) \(.pending_after) \(.log_file)"' <<<"$summary_json"
echo ""
echo "Failure reasons:"
jq -r '.failure_reasons[]? | "- \(.reason): \(.count)"' <<<"$summary_json"

first_failure_log="$(jq -r '.runs[] | select(.status != 0) | .log_file' <<<"$summary_json" | head -n 1)"
if [[ -n "$first_failure_log" ]]; then
  echo ""
  echo "Inspect first failure:"
  echo "  tail -n 120 \"$first_failure_log\""
fi
