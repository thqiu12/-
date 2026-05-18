#!/usr/bin/env bash
# =============================================================================
# install-cron.sh
#   deploy ユーザーで実行: バックアップを cron に登録。
#   毎日 03:00 (Asia/Tokyo) に backup-daily.sh を実行。
# =============================================================================
set -euo pipefail

if [ "$EUID" -eq 0 ]; then
  echo "deploy ユーザーで実行してください（root では実行しない）" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-daily.sh"
LOG_PATH="/srv/senmon/backup/backup.log"

chmod +x "$BACKUP_SCRIPT"

CRON_LINE="0 3 * * * $BACKUP_SCRIPT >> $LOG_PATH 2>&1"

# 既存 crontab を取得（空でも失敗しない）
CURRENT="$(crontab -l 2>/dev/null || true)"

if echo "$CURRENT" | grep -Fq "$BACKUP_SCRIPT"; then
  echo "バックアップ用 cron は既に登録済み（スキップ）"
else
  echo "バックアップ用 cron を登録"
  (echo "$CURRENT"; echo "$CRON_LINE") | crontab -
fi

echo "✓ 現在の crontab:"
crontab -l
