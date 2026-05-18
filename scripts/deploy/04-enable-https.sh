#!/usr/bin/env bash
# =============================================================================
# 04-enable-https.sh DOMAIN [EMAIL]
#   Let's Encrypt 証明書を発行して HTTPS 化。root で実行。
#
#   - DNS の A レコードが事前に VPS の IP を指している必要があります
#   - certbot --nginx が自動的に nginx 設定を編集して 443 サーバーブロックを追加
#   - 自動更新は certbot の systemd timer で標準有効
#
# 実行例:
#   sudo bash 04-enable-https.sh apply.example.com admin@example.com
# =============================================================================
set -euo pipefail

log() { echo -e "\e[36m[https]\e[0m $*"; }
err() { echo -e "\e[31m[error]\e[0m $*" >&2; }

if [ "$EUID" -ne 0 ]; then
  err "root で実行してください"
  exit 1
fi

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  err "ドメイン名を指定してください: bash $0 apply.example.com [admin@example.com]"
  exit 1
fi

# DNS 解決チェック
log "DNS 解決確認: $DOMAIN"
RESOLVED_IP="$(dig +short "$DOMAIN" | tail -n1 || true)"
VPS_IP="$(curl -fsS https://ifconfig.me 2>/dev/null || true)"
if [ -z "$RESOLVED_IP" ]; then
  err "$DOMAIN は DNS で解決できません。A レコードを設定してください。"
  exit 1
fi
if [ -n "$VPS_IP" ] && [ "$RESOLVED_IP" != "$VPS_IP" ]; then
  err "警告: $DOMAIN は $RESOLVED_IP を指しています（この VPS は $VPS_IP）"
  err "DNS 伝播待ちかも知れません。続行する場合は 5 秒以内に Ctrl+C で中断、そうでなければ続行..."
  sleep 5
fi

# nginx 設定の server_name を更新
log "nginx の server_name を $DOMAIN に書き換え"
sed -i "s/^\s*server_name .*/    server_name $DOMAIN;/" /etc/nginx/sites-available/senmon
nginx -t
systemctl reload nginx

# .env の NEXT_PUBLIC_BASE_URL を https に更新（deploy ユーザーのアプリ）
if [ -f /srv/senmon/app/.env ]; then
  log "/srv/senmon/app/.env の NEXT_PUBLIC_BASE_URL を https://$DOMAIN に更新"
  sed -i "s|^NEXT_PUBLIC_BASE_URL=.*|NEXT_PUBLIC_BASE_URL=\"https://$DOMAIN\"|" /srv/senmon/app/.env
fi

# certbot 実行
CERTBOT_ARGS=(
  --nginx
  -d "$DOMAIN"
  --non-interactive
  --agree-tos
  --redirect              # HTTP → HTTPS 自動リダイレクト
  --hsts                  # HSTS ヘッダ追加
)
if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

log "certbot 実行中..."
certbot "${CERTBOT_ARGS[@]}"

# 自動更新のテスト
log "証明書の自動更新を dry-run でテスト"
certbot renew --dry-run

# アプリを再起動して新しい BASE_URL を反映
if su - deploy -c "pm2 describe senmon-nyuugaku >/dev/null 2>&1"; then
  log "PM2 アプリを reload して新しい BASE_URL を反映"
  su - deploy -c "pm2 reload senmon-nyuugaku --update-env"
fi

log "✓ HTTPS 化完了"
log ""
log "確認: ブラウザで https://$DOMAIN を開いてください"
log "証明書情報: certbot certificates"
log "次回更新予定: systemctl list-timers certbot.timer"
