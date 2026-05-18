#!/usr/bin/env bash
# =============================================================================
# 03-nginx-setup.sh
#   senmon-nyuugaku の nginx リバプロを構成。root で実行。
#
#   - sites-available/senmon を配置
#   - default サイトを無効化
#   - syntax check + reload
# =============================================================================
set -euo pipefail

log() { echo -e "\e[36m[nginx]\e[0m $*"; }
err() { echo -e "\e[31m[error]\e[0m $*" >&2; }

if [ "$EUID" -ne 0 ]; then
  err "このスクリプトは root で実行してください: sudo bash $0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF_SRC="$SCRIPT_DIR/nginx-senmon.conf"
CONF_DST="/etc/nginx/sites-available/senmon"

if [ ! -f "$CONF_SRC" ]; then
  err "$CONF_SRC が見つかりません"
  exit 1
fi

log "nginx 設定を /etc/nginx/sites-available/senmon に配置"
cp "$CONF_SRC" "$CONF_DST"

# default を無効化
if [ -L /etc/nginx/sites-enabled/default ]; then
  log "default サイトを無効化"
  rm -f /etc/nginx/sites-enabled/default
fi

# senmon を有効化
if [ ! -L /etc/nginx/sites-enabled/senmon ]; then
  ln -s "$CONF_DST" /etc/nginx/sites-enabled/senmon
fi

log "nginx -t（設定検証）"
nginx -t

log "nginx reload"
systemctl reload nginx

log "✓ nginx 設定反映完了"
log ""
log "確認: ブラウザで http://160.16.132.198 を開いてください"
log ""
log "次のステップ（ドメインを設定したら）:"
log "  sudo bash $SCRIPT_DIR/04-enable-https.sh your-domain.example.com"
