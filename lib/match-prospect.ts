import { prisma } from "@/lib/prisma";

/**
 * 希望者リスト（Prospect）と Application の自動マッチング。
 *
 * 優先順位:
 *  1. email 完全一致（最強の識別子）
 *  2. lastName + firstName + birthDate 一致（メール変更時の保険）
 *  3. lastName + firstName のみ一致（最終手段。複数ヒット時はマッチ無し扱い）
 *
 * 既にマッチ済みの Prospect は除外。複数候補ヒット時は最古を採用（最初の渠道優先）。
 */

export interface MatchInput {
  applicationId: string;
  email: string;
  lastName: string;
  firstName: string;
  birthDate?: string | null;
}

export interface MatchResult {
  prospect: { id: string; agentId: string; agentName: string } | null;
  matchType: "email" | "name-birth" | "name-only" | "none";
  candidates: number;
}

export async function matchProspect(input: MatchInput): Promise<MatchResult> {
  // Step 1: email 一致
  if (input.email) {
    const byEmail = await prisma.prospect.findFirst({
      where: {
        email: input.email,
        matchedApplicationId: null,
      },
      orderBy: { referredAt: "asc" },
      include: { agent: { select: { name: true } } },
    });
    if (byEmail) {
      return {
        prospect: { id: byEmail.id, agentId: byEmail.agentId, agentName: byEmail.agent.name },
        matchType: "email",
        candidates: 1,
      };
    }
  }

  // Step 2: 氏名 + 生年月日
  if (input.birthDate) {
    const byNameBirth = await prisma.prospect.findMany({
      where: {
        lastName: input.lastName,
        firstName: input.firstName,
        birthDate: input.birthDate,
        matchedApplicationId: null,
      },
      orderBy: { referredAt: "asc" },
      include: { agent: { select: { name: true } } },
    });
    if (byNameBirth.length >= 1) {
      const first = byNameBirth[0];
      return {
        prospect: { id: first.id, agentId: first.agentId, agentName: first.agent.name },
        matchType: "name-birth",
        candidates: byNameBirth.length,
      };
    }
  }

  // Step 3: 氏名のみ。複数ヒットは曖昧なのでマッチ無し扱い（admin が手動紐付け）
  const byName = await prisma.prospect.findMany({
    where: {
      lastName: input.lastName,
      firstName: input.firstName,
      matchedApplicationId: null,
    },
    orderBy: { referredAt: "asc" },
    include: { agent: { select: { name: true } } },
  });
  if (byName.length === 1) {
    return {
      prospect: { id: byName[0].id, agentId: byName[0].agentId, agentName: byName[0].agent.name },
      matchType: "name-only",
      candidates: 1,
    };
  }

  return { prospect: null, matchType: "none", candidates: byName.length };
}

/**
 * Application 作成後に Prospect をマッチして紐付ける。
 * Application.agentId にも prospect.agentId をセット（紐付け成功時のみ）。
 */
export async function linkProspectToApplication(input: MatchInput): Promise<MatchResult> {
  const result = await matchProspect(input);
  if (result.prospect) {
    await prisma.$transaction([
      prisma.prospect.update({
        where: { id: result.prospect.id },
        data: {
          matchedApplicationId: input.applicationId,
          matchedAt: new Date(),
          matchedBy: "auto",
          status: "出願済",
        },
      }),
      prisma.application.update({
        where: { id: input.applicationId },
        data: { agentId: result.prospect.agentId },
      }),
    ]);
  }
  return result;
}

/**
 * 重複検知: 同じ学生（email or 氏名+誕生日）が複数の渠道から登録されているか調べる。
 * 名前のアルファベット順でソートして返す。
 */
export interface DuplicateGroup {
  key: string;
  reason: "email" | "name-birth" | "name";
  prospects: Array<{
    id: string;
    lastName: string;
    firstName: string;
    email: string | null;
    birthDate: string | null;
    agentName: string;
    referredAt: Date;
    status: string;
  }>;
}

export async function findDuplicateProspects(): Promise<DuplicateGroup[]> {
  const all = await prisma.prospect.findMany({
    where: { status: { not: "無効" } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { referredAt: "asc" }],
    include: { agent: { select: { name: true } } },
  });

  const byEmail = new Map<string, typeof all>();
  const byNameBirth = new Map<string, typeof all>();
  const byName = new Map<string, typeof all>();

  for (const p of all) {
    if (p.email) {
      const list = byEmail.get(p.email) || [];
      list.push(p);
      byEmail.set(p.email, list);
    }
    if (p.birthDate) {
      const key = `${p.lastName}|${p.firstName}|${p.birthDate}`;
      const list = byNameBirth.get(key) || [];
      list.push(p);
      byNameBirth.set(key, list);
    }
    const nameKey = `${p.lastName}|${p.firstName}`;
    const list = byName.get(nameKey) || [];
    list.push(p);
    byName.set(nameKey, list);
  }

  const groups: DuplicateGroup[] = [];
  const seenIds = new Set<string>();

  type RowT = typeof all[number];
  const toSummary = (p: RowT) => ({
    id: p.id, lastName: p.lastName, firstName: p.firstName,
    email: p.email, birthDate: p.birthDate, agentName: p.agent.name,
    referredAt: p.referredAt, status: p.status,
  });

  // Email 重複 (最も信頼性高い)
  Object.entries(Object.fromEntries(byEmail)).forEach(([email, list]) => {
    if (list.length > 1) {
      groups.push({
        key: email,
        reason: "email",
        prospects: list.map(toSummary),
      });
      list.forEach((p: RowT) => seenIds.add(p.id));
    }
  });

  // 氏名+誕生日 重複（既に email 重複で計上済みは除外）
  Object.entries(Object.fromEntries(byNameBirth)).forEach(([key, list]) => {
    if (list.length > 1 && !list.every((p: RowT) => seenIds.has(p.id))) {
      groups.push({
        key, reason: "name-birth",
        prospects: list.map(toSummary),
      });
      list.forEach((p: RowT) => seenIds.add(p.id));
    }
  });

  // 氏名のみ重複 (要 admin 判断)
  Object.entries(Object.fromEntries(byName)).forEach(([key, list]) => {
    if (list.length > 1 && !list.every((p: RowT) => seenIds.has(p.id))) {
      groups.push({
        key, reason: "name",
        prospects: list.map(toSummary),
      });
    }
  });

  // 名前アルファベット順
  groups.sort((a, b) => {
    const aName = a.prospects[0]?.lastName + a.prospects[0]?.firstName;
    const bName = b.prospects[0]?.lastName + b.prospects[0]?.firstName;
    return aName.localeCompare(bName);
  });

  return groups;
}
