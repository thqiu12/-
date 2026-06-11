# オフサイト暗号化バックアップ（Cloudflare R2）

本番DB(SQLite)とアップロード書類を **gpg(AES256) で暗号化**し、毎日 **Cloudflare R2** へ送る。
サーバーが丸ごと失われても、別ロケーションに暗号化済みコピーが残る。

> ⚠️ **最重要**：暗号化パスフレーズは**サーバーの外**（パスワードマネージャ等）にも必ず控えること。
> サーバーごと失った場合、これが無いと R2 のバックアップを復号できません。

---

## A. あなたの作業（Cloudflare R2 を用意）

1. Cloudflare アカウント作成 → ダッシュボード左メニュー **R2**。
2. **Create bucket**：名前を `senmon-backup`（任意）で作成。リージョンは自動でOK。
3. **Manage R2 API Tokens** → **Create API Token**：
   - 権限：**Object Read & Write**
   - 対象バケット：`senmon-backup` のみ（最小権限）
   - 作成後に表示される以下を控える（**この画面でしか出ない**）：
     - **Access Key ID**
     - **Secret Access Key**
     - **エンドポイント** `https://<アカウントID>.r2.cloudflarestorage.com`
4. 上記4点（Access Key / Secret / エンドポイント / バケット名）を担当（私）に共有。

---

## B. VPS 側セットアップ（接続情報を受領後に実施）

```bash
# 1) rclone インストール
sudo apt-get update && sudo apt-get install -y rclone gnupg

# 2) rclone に R2 リモートを登録（~/.config/rclone/rclone.conf）
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf <<'EOF'
[r2]
type = s3
provider = Cloudflare
access_key_id = <ACCESS_KEY_ID>
secret_access_key = <SECRET_ACCESS_KEY>
endpoint = https://<アカウントID>.r2.cloudflarestorage.com
acl = private
EOF
chmod 600 ~/.config/rclone/rclone.conf

# 3) 暗号化パスフレーズを作成（ランダム生成）
sudo mkdir -p /srv/senmon/secrets
openssl rand -base64 32 | sudo tee /srv/senmon/secrets/backup.pass >/dev/null
sudo chmod 600 /srv/senmon/secrets/backup.pass
#   ↑ このファイルの中身を「パスワードマネージャ等サーバー外」に必ずコピー保管！

# 4) 疎通テスト（バケットが見えるか）
rclone lsd r2:

# 5) 初回バックアップを手動実行
bash /srv/senmon/app/scripts/deploy/offsite-backup.sh
tail -5 /srv/senmon/backup/offsite.log
rclone ls r2:senmon-backup/db/     # アップロードされたか確認

# 6) cron に日次登録（毎日 3:30）
( crontab -l 2>/dev/null; echo "30 3 * * * BACKUP_PASS_FILE=/srv/senmon/secrets/backup.pass bash /srv/senmon/app/scripts/deploy/offsite-backup.sh" ) | crontab -
```

---

## C. 復元（リストア）

```bash
# 一覧
bash /srv/senmon/app/scripts/deploy/offsite-restore.sh list

# DB を復元（ダウンロード→復号→展開。本番は自動上書きしない）
bash /srv/senmon/app/scripts/deploy/offsite-restore.sh db data-YYYYMMDD-HHMMSS.db.gz.gpg
#   → /srv/senmon/backup/restore/ に .db を出力。整合性チェック後、表示される手順で本番反映。

# 書類(uploads) を復元
bash /srv/senmon/app/scripts/deploy/offsite-restore.sh uploads uploads-YYYYMMDD-HHMMSS.tar.gz.gpg
```

### サーバーを完全に失った場合（DR）
新サーバーで rclone を設定（同じR2トークン）＋ **控えておいたパスフレーズ**で `backup.pass` を再作成 → 上記 restore。
パスフレーズがサーバー外に無いと復号不能なので、A の保管を徹底すること。

---

## C-2. 失敗通知（任意・推奨）

バックアップが失敗したら気づけるよう、メール通知と死活監視を設定できる。
`/srv/senmon/secrets/backup-alert.env` を作るだけ（無ければ通知なしで通常動作）。

```bash
sudo tee /srv/senmon/secrets/backup-alert.env >/dev/null <<'EOF'
RESEND_API_KEY="re_..."           # 送信用（アプリの .env と同じキーで可）
RESEND_FROM="専門学校 入学係 <no-reply@認証済みドメイン>"
ALERT_EMAIL="you@example.com"     # 失敗時の通知先
# 任意: 死活監視（healthchecks.io 等）。成功pingが途絶えると先方が通知してくれる
# ＝「cron 自体が動かなくなった」ケースも検知できる
# HEALTHCHECK_URL="https://hc-ping.com/xxxxxxxx"
EOF
sudo chown "$USER:$USER" /srv/senmon/secrets/backup-alert.env
sudo chmod 600 /srv/senmon/secrets/backup-alert.env
```

- 失敗時：`ALERT_EMAIL` 宛にメール。
- `HEALTHCHECK_URL` を設定した場合：成功で ping、失敗で `/fail` ping。
  healthchecks.io（無料）でチェックを1つ作り、期待間隔を「1日 + 余裕」にすると、
  バックアップが来ない＝サーバー停止/cron停止も検知できる（dead man's switch）。

## D. 保管設計
- 保存先：`r2:senmon-backup/db/` と `/uploads/`、ファイル名は日時付き。
- 世代管理：R2 上で **90日**より古いものを自動削除（`KEEP_DAYS` で変更可）。
- ローカル(VPS)には平文の一時ファイルを残さない（暗号化後に即削除）。
- 既存の**ローカル日次バックアップ(backup-daily.sh)はそのまま併用**（誤デプロイ等の即時復旧用）。本オフサイトは「サーバー喪失」への保険。
