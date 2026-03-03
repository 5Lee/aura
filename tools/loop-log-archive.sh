#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_BASE="$ROOT_DIR/logs/codex-loop"
KEEP_DAYS=7
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  ./tools/loop-log-archive.sh [--keep-days <n>] [--dry-run]

Options:
  --keep-days <n>  Keep recent N days in place, archive older logs by date (default: 7).
  --dry-run        Print planned moves without changing files.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-days)
      KEEP_DAYS="${2:-}"
      if [[ -z "$KEEP_DAYS" ]]; then
        echo "[ERROR] --keep-days requires a value." >&2
        exit 1
      fi
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
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

if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] --keep-days must be a non-negative integer, got: $KEEP_DAYS" >&2
  exit 1
fi

python3 - <<'PY' "$LOG_BASE" "$KEEP_DAYS" "$DRY_RUN"
import datetime as dt
import os
import re
import shutil
import sys

log_base = sys.argv[1]
keep_days = int(sys.argv[2])
dry_run = sys.argv[3] == "1"

if not os.path.isdir(log_base):
    print(f"[ERROR] log directory not found: {log_base}", file=sys.stderr)
    sys.exit(1)

archive_root = os.path.join(log_base, "archive")
os.makedirs(archive_root, exist_ok=True)

today = dt.date.today()
cutoff = today - dt.timedelta(days=keep_days)
pattern = re.compile(r"^(\d{8})-\d{6}$")

moves = []
for entry in sorted(os.listdir(log_base)):
    path = os.path.join(log_base, entry)
    if not os.path.isdir(path):
        continue
    if entry == "archive":
        continue

    match = pattern.match(entry)
    if not match:
        continue

    date_text = match.group(1)
    date_value = dt.datetime.strptime(date_text, "%Y%m%d").date()
    if date_value >= cutoff:
        continue

    date_folder = f"{date_text[:4]}-{date_text[4:6]}-{date_text[6:8]}"
    target_dir = os.path.join(archive_root, date_folder)
    os.makedirs(target_dir, exist_ok=True)
    destination = os.path.join(target_dir, entry)
    moves.append((path, destination))

if not moves:
    print("No log directories to archive.")
    sys.exit(0)

for src, dst in moves:
    print(f"{'[DRY-RUN] ' if dry_run else ''}archive: {src} -> {dst}")
    if dry_run:
        continue
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.move(src, dst)
PY
