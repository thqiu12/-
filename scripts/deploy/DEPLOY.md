# senmon-nyuugaku デプロイ手順

対象環境: **さくらVPS 東京 2GB プラン / Ubuntu 24.04 LTS amd64**
本ガイドは VPS IP `160.16.132.198` (`tk2-402-42194.vs.sakura.ne.jp`) を例にしています。

---

## 0. 前提

| 項目 | 状態 |
|---|---|
| VPS 契約 | 完了 |
| OS | Ubuntu 24.04 LTS |
| SSH 鍵認証 | GitHub 経由で `ubuntu` ユーザーに設定済み |
| パケットフィルタ | 無効（または :22 :80 :443 許可） |
| ドメイン | **未取得でも IP で動作可能。HTTPS 化時に必要。** |

---

## 1. システムセットアップ（root 必要、10〜15分）

### 1-1. 手元の Mac からファイルを VPS に転送

リポジトリは `/tmp/review-repo/scripts/deploy/` に揃っているので、それを VPS に scp で送る。
（もしリポジトリを GitHub から clone 済みなら、後の Step 2 で一気に解決します）

```bash
# 手元の Mac で実行
cd /tmp/review-repo
scp -r scripts ubuntu@160.16.132.198:/tmp/
```

### 1-2. VPS にログインしてセットアップスクリプト実行

```bash
ssh ubuntu@160.16.132.198

# システム全体のセットアップ（root 必要）
sudo bash /tmp/scripts/deploy/01-system-setup.sh
```

このスクリプトが行うこと（冪等、再実行可）:
- スワップ 2GB 作成（RAM 2GB 環境必須）
- apt 更新 + 自動セキュリティ更新有効化
- Node.js 20 LTS + PM2 グローバル
- Chromium + Puppeteer 用フォント・依存
- nginx, certbot, fail2ban, ufw
- `deploy` ユーザー作成（GitHub 鍵で SSH 可能）
- `/srv/senmon/{app,private/uploads,backup}` ディレクトリ作成
- ufw で :22 :80 :443 だけ許可
- fail2ban で SSH ブルートフォース対策
- sshd: パスワード認証完全無効化
- PM2 を systemd で起動するよう登録

完了したら:
```bash
free -h           # Swap 2.0Gi が出る
node -v           # v20.x
google-chrome --version
systemctl status nginx fail2ban
ufw status        # 22,80,443 ALLOW
```

---

## 2. アプリのデプロイ（deploy ユーザー、5〜10分）

### 2-1. deploy ユーザーに切り替え

```bash
sudo -i -u deploy
cd /srv/senmon/app
```

### 2-2. リポジトリを clone

**重要**: GitHub のリポジトリが private なら、deploy ユーザーから GitHub に SSH できる必要があります。3 通りあります：

#### A. HTTPS + Personal Access Token（一番簡単・推奨）
GitHub で `Settings → Developer settings → Personal access tokens → Fine-grained tokens` から、`-` リポジトリへの **Read** 権限だけのトークンを発行。

```bash
git clone -b chore/security-hardening \
  https://x-access-token:<YOUR_TOKEN>@github.com/thqiu12/-.git .
```

#### B. リポジトリを public に切り替えてから clone
```bash
git clone -b chore/security-hardening https://github.com/thqiu12/-.git .
```
（テスト後 private に戻せます）

#### C. Deploy Key（SSH 鍵を VPS に作って GitHub に登録）
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# ↑ を GitHub の Repo Settings → Deploy keys → Add deploy key に貼り付け（Read-only）

git clone -b chore/security-hardening git@github.com:thqiu12/-.git .
```

### 2-3. アプリビルド + デプロイ

```bash
# デモデータも入れる場合（先生のテスト用）:
SEED_DEMO=1 bash scripts/deploy/02-app-deploy.sh

# デモデータ不要の場合（本番想定）:
bash scripts/deploy/02-app-deploy.sh
```

このスクリプトが行うこと:
- `git pull`
- `.env` 自動生成（SESSION_SECRET / CSRF_SECRET / 初期管理者パスワードを openssl で生成）
- `npm ci`
- `npx prisma generate && npx prisma db push`
- 初期管理者シード
- (SEED_DEMO=1 なら) デモデータシード
- `npm run build`
- PM2 起動 or zero-downtime reload
- `curl http://127.0.0.1:3000/api/health` でヘルスチェック

**⚠️ 必ずメモすること**: スクリプトが出力する `初期管理者パスワード` を控えてください。`.env` ファイル内にも記載されますが、初回ログイン後に管理画面から変更することを推奨。

---

## 3. nginx 設定（root 必要、1分）

```bash
exit  # deploy → ubuntu に戻る
sudo bash /tmp/scripts/deploy/03-nginx-setup.sh
```

これで http://160.16.132.198/ がブラウザで開けます。

---

## 4. ブラウザで動作確認

```
http://160.16.132.198/         → トップページ（学生用）
http://160.16.132.198/apply    → 出願フォーム
http://160.16.132.198/admin    → 管理画面ログイン（admin / 上記パスワード）
http://160.16.132.198/api/health  → {"status":"ok",...}
```

---

## 5. ドメイン + HTTPS 化（後でいつでも可、5分）

### 5-1. ドメイン取得（例: お名前.com / Cloudflare Registrar / Google Domains）

### 5-2. DNS A レコード設定

| Type | Name | Value | TTL |
|---|---|---|---|
| A | apply (or @) | 160.16.132.198 | 300 |

`dig apply.example.com` で IP が引けるか確認（DNS 伝播は最大数時間）。

### 5-3. Let's Encrypt 証明書取得

```bash
ssh ubuntu@160.16.132.198
sudo bash /tmp/scripts/deploy/04-enable-https.sh apply.example.com admin@example.com
```

スクリプトが自動で行うこと:
- DNS 解決チェック
- nginx の `server_name` を更新
- `.env` の `NEXT_PUBLIC_BASE_URL` を `https://...` に更新
- certbot で証明書取得（HTTP-01 認証）
- HTTPS 強制リダイレクト + HSTS 設定
- 証明書自動更新の dry-run テスト
- PM2 reload

完了後: `https://apply.example.com` でアクセス可能。

---

## 6. バックアップ設定（deploy ユーザー、1分）

```bash
sudo -i -u deploy
bash /srv/senmon/app/scripts/deploy/install-cron.sh
```

これで毎日 03:00 (JST) に:
- SQLite DB を `.backup` でホットコピー → gzip → `/srv/senmon/backup/db/`
- `private/uploads/` を rsync 差分コピー → `/srv/senmon/backup/uploads/`
- 7 日より古いバックアップを自動削除

ログ確認: `tail -f /srv/senmon/backup/backup.log`

**推奨**: さらに `rclone` でオブジェクトストレージへオフサイトバックアップ。設定例は本ドキュメント末尾参照。

---

## 7. 運用コマンドチートシート

```bash
# === deploy ユーザーで実行 ===

# プロセス確認
pm2 status
pm2 logs senmon-nyuugaku --lines 100
pm2 monit            # リアルタイム CPU/MEM

# 再起動
pm2 reload senmon-nyuugaku --update-env

# コードを最新に
cd /srv/senmon/app
bash scripts/deploy/02-app-deploy.sh

# 手動バックアップ
bash scripts/deploy/backup-daily.sh

# === ubuntu (sudo) で実行 ===

# nginx
sudo nginx -t && sudo systemctl reload nginx
sudo tail -f /var/log/nginx/senmon-error.log

# fail2ban で BAN されてる IP 確認
sudo fail2ban-client status sshd

# システム
free -h
df -h
top
```

---

## 8. トラブルシューティング

### Q. ブラウザで 502 Bad Gateway が出る
→ PM2 が落ちている。`pm2 status` で確認、`pm2 logs senmon-nyuugaku` でエラー確認。

### Q. PDF 生成が失敗する
→ Chromium パスを確認: `which chromium`。`.env` の `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` を確認。

### Q. ファイルアップロードで「ファイルサイズが大きすぎます」
→ nginx の `client_max_body_size 15M` と、`.env` の `MAX_FILE_SIZE_MB=10` の整合を確認。

### Q. SSH に入れなくなった
→ さくらVPS コントロールパネルの「コンソール」(VNC) から root ログイン → `/etc/ssh/sshd_config.d/99-hardening.conf` を確認。

### Q. swappiness を変えたい
→ `/etc/sysctl.d/99-swappiness.conf` 編集 → `sudo sysctl --system`。

### Q. メモリ不足で落ちる
→ 2G プランは Chromium 同時起動で詰まる可能性。`pm2 monit` で監視し、頻発するなら 4G プランへ移行。

### Q. fail2ban に自分が BAN された
→ `sudo fail2ban-client set sshd unbanip YOUR_IP`

---

## 9. セキュリティチェックリスト（リリース前）

- [ ] 初期管理者パスワードを **管理画面から変更** した
- [ ] `.env` ファイルの権限が `600` （`ls -la /srv/senmon/app/.env`）
- [ ] HTTPS で接続できる（証明書エラーなし）
- [ ] `https://apply.example.com/` の `Strict-Transport-Security` ヘッダが付いている
- [ ] `https://apply.example.com/admin` にアクセス制限がかかっている（未認証は弾かれる）
- [ ] `https://apply.example.com/uploads/...` が 404（直接ダウンロード不可）
- [ ] バックアップ cron が動いている（翌朝 `/srv/senmon/backup/db/` にファイルあり）
- [ ] `sudo ufw status` で 22, 80, 443 のみ allow
- [ ] `sudo fail2ban-client status sshd` で sshd jail が active
- [ ] パスワードログインが完全無効（`ssh -o PasswordAuthentication=yes ubuntu@<IP>` で弾かれる）

---

## 10. オフサイトバックアップ（推奨・任意）

さくらオブジェクトストレージや S3 互換へ毎日アップロード:

```bash
# deploy ユーザーで
sudo apt install -y rclone
rclone config  # 対話的に S3 互換 remote を設定（例: sakura）

# /srv/senmon/app/scripts/deploy/backup-daily.sh 末尾に追加:
echo "  オフサイト同期"
rclone sync "$BACKUP_DIR" sakura:senmon-backup/ --max-age 7d
```

---

## 付録: ファイル一覧

| ファイル | 役割 |
|---|---|
| `01-system-setup.sh` | OS 初期化（root） |
| `02-app-deploy.sh` | アプリビルド・デプロイ（deploy） |
| `03-nginx-setup.sh` | nginx 設定反映（root） |
| `04-enable-https.sh` | Let's Encrypt（root） |
| `backup-daily.sh` | 日次バックアップ（cron 経由） |
| `install-cron.sh` | バックアップを cron に登録 |
| `nginx-senmon.conf` | nginx 設定本体 |
| `DEPLOY.md` | このファイル |
