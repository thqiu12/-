/**
 * 初期 super_admin（または任意の管理者）を作成するスクリプト。
 *
 * バックドア廃止後、最初の管理者はこのスクリプトで作成する必要がある。
 *
 * 使い方:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD='強いパスワード' ADMIN_NAME='管理者' \
 *   npx ts-node scripts/create-admin.ts
 *
 *   ROLE を指定しない場合は super_admin。
 *   既に同じ username が存在する場合はパスワードを更新する。
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { promisify } from "util";

const prisma = new PrismaClient();
const scryptAsync = promisify(crypto.scrypt) as (p: string, s: string, k: number) => Promise<Buffer>;

async function hashPassword(pwd: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pwd, salt, 64)).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME || username;
  const role = process.env.ROLE || "super_admin";

  if (!username || !password) {
    console.error("ADMIN_USERNAME と ADMIN_PASSWORD を環境変数で指定してください。");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("パスワードは8文字以上にしてください。");
    process.exit(1);
  }
  if (!["super_admin", "admin", "interviewer"].includes(role)) {
    console.error("ROLE は super_admin / admin / interviewer のいずれか。");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.adminUser.findUnique({ where: { username } });

  if (existing) {
    await prisma.adminUser.update({
      where: { username },
      data: { passwordHash, displayName: displayName!, role, isActive: true },
    });
    console.log(`既存ユーザー「${username}」のパスワード/ロールを更新しました（${role}）。`);
  } else {
    await prisma.adminUser.create({
      data: {
        id: crypto.randomUUID(),
        username,
        passwordHash,
        displayName: displayName!,
        role,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    console.log(`管理者「${username}」を作成しました（${role}）。`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
