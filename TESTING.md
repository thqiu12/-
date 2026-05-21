# テスト体系ガイド

このプロジェクトには 3 層のテストが整備されています。

```
                   ┌──────────────────────┐
                   │  Playwright E2E      │  ← ブラウザ自動操作
                   │  (UI 自動化テスト)   │     学生出願・管理画面
                   ├──────────────────────┤
                   │  Playwright API      │  ← HTTP リクエスト
                   │  (主要 API)          │     /api/admin/settings 等
                   ├──────────────────────┤
                   │  Vitest 単体テスト   │  ← 純粋関数
                   │  (lib/* + 業務ロジック) │   schemas / settings / password
                   └──────────────────────┘
```

## 構成

```
tests/
├── unit/                    # Vitest 単体テスト
│   ├── settings.test.ts          # lib/settings.ts
│   ├── password.test.ts          # lib/password.ts (bcrypt + legacy)
│   ├── schemas.test.ts           # lib/schemas.ts の zod スキーマ
│   ├── change-request-fields.test.ts  # 許可フィールド一覧
│   └── business-logic.test.ts    # ストッパー・重複検知・受験票発行可否
│
├── e2e/                     # Playwright E2E
│   ├── student-apply.spec.ts     # 出願フロー
│   ├── admin-status-guard.spec.ts # ステータス変更ストッパー
│   ├── fixtures/
│   │   └── seed.ts               # テスト前 seed
│   └── api/                 # API 単独テスト（Playwright request fixture）
│       ├── admin-settings.spec.ts
│       ├── applications.spec.ts
│       └── exam-ticket.spec.ts
│
├── vitest.setup.ts          # Vitest 共通セットアップ
└── vitest-fix-suggestions-reporter.ts  # 失敗時の自動診断
```

設定ファイル:
- `vitest.config.ts` — 単体テスト
- `playwright.config.ts` — E2E + API
- `.github/workflows/test.yml` — CI

---

## ローカル実行

### 単体テスト（Vitest）

```bash
# 全部
npm run test:unit

# ウォッチモード（コード変更で自動再実行）
npm run test:watch

# 特定ファイルだけ
npx vitest run tests/unit/settings.test.ts
```

### Playwright E2E + API

```bash
# 初回のみブラウザインストール
npx playwright install chromium

# 全部実行（dev サーバー自動起動）
npm run test:e2e

# ブラウザ表示しながら（デバッグ用）
npm run test:e2e:headed

# Playwright UI モード（最強デバッグ）
npm run test:e2e:ui

# 特定ファイルだけ
npx playwright test tests/e2e/student-apply.spec.ts

# リモート（本番 VPS）に対して実行
BASE_URL=http://160.16.132.198 npx playwright test
```

### 全部一括（CI と同じ）

```bash
npm run test:all
```

---

## CI（GitHub Actions）

`push` または `pull_request` で 3 つの job が走ります：

| Job | 内容 | 時間目安 |
|---|---|---|
| **unit** | Vitest 単体テスト + カバレッジ | 2〜3 分 |
| **typecheck** | `next build` 型・lint 検証 | 3〜5 分 |
| **e2e** | Playwright E2E + API | 8〜12 分 |

失敗時のアーティファクト:
- `playwright-report/` — HTML レポート（テスト結果一覧）
- `playwright-traces/` — 失敗時のトレース（タイムライン形式）
- `coverage/` — Vitest カバレッジ

ダウンロード方法: GitHub の Actions タブ → 該当 run → 下部の Artifacts。

---

## 失敗時の自動診断（カスタムレポーター）

Vitest 失敗時、`tests/vitest-fix-suggestions-reporter.ts` が以下のような出力を追加します：

```
══════════════════════════════════════════════════════════════════════
  失敗テスト 1 件 — 自動診断レポート
══════════════════════════════════════════════════════════════════════

✗ enrollmentYears を保存できる
  📁 tests/unit/settings.test.ts
  原因: Prisma クライアントが DB と整合してない、または connection が確立されていない
  修正: 1. `npx prisma generate` を実行
    2. `npx prisma db push` で test.db を作成・更新
    3. `process.env.DATABASE_URL` が `file:./test.db` を指しているか確認
══════════════════════════════════════════════════════════════════════
```

検出パターン（`vitest-fix-suggestions-reporter.ts` の `SUGGESTIONS` 配列）:
- Prisma 関連エラー → schema 同期手順
- ENV ファイル不在 → 配置・権限
- セッション署名不一致 → SECRET 同期
- Zod 検証エラー → schema 制約確認
- SQLite ロック → 並列実行の問題
- モジュール解決失敗 → npm ci / @/ パス
- bcrypt エラー → バージョン整合
- タイムアウト → await 漏れ / 計測延長
- アサーション失敗 → diff 確認手順

新しいパターンを追加する場合は SUGGESTIONS 配列に `{ detect, cause, fix }` を足してください。

---

## テスト用 DB

- **本番**: `prisma/data.db` （Application、ApplicationSchool 等の本データ）
- **テスト**: `prisma/test.db` （CI とローカルテストで使用）

`vitest.setup.ts` がテスト開始前に `test.db` を削除して `prisma db push` でクリーン状態にします。
本番 DB は一切汚しません。

E2E は Playwright の `webServer` 設定で `npm run dev` に `DATABASE_URL=file:./test.db` を渡して起動するので、これも本番 DB に影響しません。

---

## 新しいテストの追加方法

### 単体テスト（純粋関数）

`tests/unit/<モジュール名>.test.ts` を作成し、以下のテンプレートで開始：

```ts
import { describe, it, expect } from "vitest";
import { someFunction } from "@/lib/your-module";

describe("someFunction", () => {
  it("正常ケース", () => {
    expect(someFunction(1, 2)).toBe(3);
  });

  it("エッジケース", () => {
    expect(() => someFunction(null as never, 2)).toThrow();
  });
});
```

DB を使うテストは `beforeEach` で `prisma.<model>.deleteMany({})` でクリーンアップ。

### API テスト

`tests/e2e/api/<endpoint>.spec.ts` を作成：

```ts
import { test, expect } from "@playwright/test";

test("POST /api/your-endpoint", async ({ request }) => {
  const res = await request.post("/api/your-endpoint", {
    data: { foo: "bar" },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
});
```

管理者認証が必要な場合は `loginAsAdmin()` ヘルパー（既存ファイルからコピー）を使用。

### UI E2E テスト

`tests/e2e/<flow>.spec.ts` を作成：

```ts
import { test, expect } from "@playwright/test";

test("ユーザーがログインできる", async ({ page }) => {
  await page.goto("/admin");
  await page.locator("input[name='username']").fill("admin");
  await page.locator("input[type='password']").fill("TestAdmin2026!");
  await page.getByRole("button", { name: /ログイン/ }).click();
  await expect(page.getByText(/ダッシュボード/)).toBeVisible();
});
```

---

## トラブルシューティング

### Vitest が `Cannot find module '@/lib/...'` で失敗

`vitest.config.ts` に `tsconfigPaths()` プラグインが入っているか確認。`npm ci` 再実行も。

### Playwright が `Browser is not installed`

```bash
npx playwright install chromium
```

### `SQLITE_BUSY: database is locked`

複数テストが同じ DB を同時に握ってる。Vitest は `singleThread: true` 設定済みのはずだが、もし発生したら：

```bash
rm prisma/prisma/test.db
npm run test:unit
```

### CI が GitHub で失敗する

- まず `npm run test:all` をローカル成功させる
- それでも CI だけ落ちる → GitHub Actions の `playwright-traces` artifact をダウンロードして trace.zip を `npx playwright show-trace trace.zip` で開く
- env 違いの可能性 → `.github/workflows/test.yml` の env: と比較

### 新規 zod スキーマ追加でテストが落ちる

`tests/unit/schemas.test.ts` に対応するケースを追加。スキーマの境界条件（min/max/regex）を漏らさず書く。
