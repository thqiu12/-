/**
 * Vitest カスタムレポーター。
 * テスト失敗時に「原因」と「修正提案」をパターンマッチで自動表示する。
 *
 * 使い方: vitest.config.ts の reporters: [..., "./tests/vitest-fix-suggestions-reporter.ts"]
 */
import type { File, Reporter, Task, TaskResultPack } from "vitest";

interface Suggestion {
  detect: (msg: string) => boolean;
  cause: string;
  fix: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    detect: (m) => /PrismaClientKnownRequestError|PrismaClient/.test(m),
    cause: "Prisma クライアントが DB と整合してない、または connection が確立されていない",
    fix:
      "1. `npx prisma generate` を実行\n" +
      "  2. `npx prisma db push` で test.db を作成・更新\n" +
      "  3. `process.env.DATABASE_URL` が `file:./test.db` を指しているか確認",
  },
  {
    detect: (m) => /ENOENT.*\.env|EACCES.*\.env/.test(m),
    cause: ".env ファイルが読めない（パスまたは権限）",
    fix:
      "1. プロジェクトルートに .env が存在するか確認\n" +
      "  2. `chmod 600 .env` で権限を deploy ユーザーに揃える\n" +
      "  3. vitest.setup.ts で env を上書きしている場合は process.env を確認",
  },
  {
    detect: (m) => /SessionInvalid|verifyToken|signature.*invalid/i.test(m),
    cause: "セッション署名検証失敗 — SESSION_SECRET が不一致",
    fix:
      "1. tests/vitest.setup.ts で process.env.SESSION_SECRET が固定値か確認\n" +
      "  2. makeSessionToken と getSession で同じ SECRET を使っているか確認",
  },
  {
    detect: (m) => /ZodError|invalid_type|invalid_string|too_small/.test(m),
    cause: "Zod schema 検証エラー — テストデータがスキーマを満たしていない",
    fix:
      "1. テストの入力値を lib/schemas.ts の定義と照合\n" +
      "  2. min/max/regex 制約を確認\n" +
      "  3. optional / nullable がない必須フィールドが空になっていないか",
  },
  {
    detect: (m) => /SQLITE_BUSY|database is locked/i.test(m),
    cause: "テスト DB のロック衝突 — 並列実行が原因",
    fix:
      "vitest.config.ts の poolOptions.threads.singleThread を true にする（設定済みなら他テストが DB を握っていないか確認）",
  },
  {
    detect: (m) => /Cannot find module|MODULE_NOT_FOUND/.test(m),
    cause: "import パスの解決失敗",
    fix:
      "1. `npm ci` を再実行（node_modules 破損の可能性）\n" +
      "  2. import パスのタイポ・@/ エイリアスを確認\n" +
      "  3. vitest.config.ts に tsconfigPaths プラグインがあるか確認",
  },
  {
    detect: (m) => /bcrypt|argon2/i.test(m),
    cause: "パスワードハッシュ関連エラー",
    fix:
      "1. lib/password.ts の PWD_VERSION_BCRYPT との整合を確認\n" +
      "  2. ハッシュ生成時の cost (12) と一致しているか",
  },
  {
    detect: (m) => /timeout|exceeded \d+ms/i.test(m),
    cause: "テストタイムアウト — DB 操作が想定より遅い、または無限ループ",
    fix:
      "1. await が抜けていないか確認\n" +
      "  2. テストごとの timeout を上げる: `it('...', async () => {...}, 30000)`\n" +
      "  3. seed データが大きすぎないか確認",
  },
  {
    detect: (m) => /assertion|expected.*to equal|toMatchObject/i.test(m),
    cause: "期待値と実際の値が一致しない（通常のアサーション失敗）",
    fix:
      "1. 上の diff 出力を読み、どのフィールドが違うか確認\n" +
      "  2. テスト前に DB をリセットしているか確認（前テストのデータが残っている可能性）\n" +
      "  3. async/await の漏れで race condition が起きていないか",
  },
];

function findSuggestion(message: string): Suggestion | null {
  for (const s of SUGGESTIONS) {
    if (s.detect(message)) return s;
  }
  return null;
}

function walkTasks(tasks: Task[]): Task[] {
  const out: Task[] = [];
  for (const t of tasks) {
    if (t.type === "test") out.push(t);
    else if (t.type === "suite" && t.tasks) out.push(...walkTasks(t.tasks));
  }
  return out;
}

// Vitest はカスタムレポーターを class として new するので、クラス形式で export する
export default class FixSuggestionsReporter implements Reporter {
  onFinished(files?: File[]) {
    if (!files) return;
    const allTests = files.flatMap((f) => walkTasks(f.tasks));
    const failed = allTests.filter((t) => t.result?.state === "fail");
    if (failed.length === 0) return;

    process.stdout.write("\n");
    process.stdout.write("\x1b[31m" + "═".repeat(70) + "\x1b[0m\n");
    process.stdout.write(
      "\x1b[31m" + `  失敗テスト ${failed.length} 件 — 自動診断レポート` + "\x1b[0m\n",
    );
    process.stdout.write("\x1b[31m" + "═".repeat(70) + "\x1b[0m\n\n");

    for (const t of failed) {
      const errors = t.result?.errors || [];
      const msg = errors.map((e) => `${e.name || ""}: ${e.message || ""}`).join("\n");
      const suggestion = findSuggestion(msg);

      const filename = t.file?.name?.replace(process.cwd() + "/", "") || "?";
      process.stdout.write(`\x1b[33m✗ ${t.name}\x1b[0m\n`);
      process.stdout.write(`  📁 ${filename}\n`);
      if (suggestion) {
        process.stdout.write(`  \x1b[36m原因:\x1b[0m ${suggestion.cause}\n`);
        process.stdout.write(`  \x1b[32m修正:\x1b[0m ${suggestion.fix}\n`);
      } else {
        process.stdout.write(
          `  \x1b[90m(パターン未登録のエラー — 上の stack trace を確認)\x1b[0m\n`,
        );
      }
      process.stdout.write("\n");
    }
    process.stdout.write("\x1b[31m" + "═".repeat(70) + "\x1b[0m\n");
  }

  // 必須インターフェイスだが noop
  onTaskUpdate(_packs: TaskResultPack[]) { /* noop */ }
}
