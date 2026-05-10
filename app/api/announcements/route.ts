import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import pLimit from "p-limit";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/security";
import { AnnouncementCreateSchema } from "@/lib/schemas";
import { logError, logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(announcements);
  } catch (error) {
    logError("GET /api/announcements", error);
    return NextResponse.json({ error: "一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const parsed = AnnouncementCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const announcement = await prisma.announcement.create({
      data: { ...parsed.data, createdBy: session?.userId ?? "管理者" },
    });
    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    logError("POST /api/announcements", error);
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");
    if (!id) return NextResponse.json({ error: "IDが必要です" }, { status: 400 });

    if (action === "send") {
      return await handleSend(id);
    }

    const body = await request.json();
    const updateSchema = AnnouncementCreateSchema.partial();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "入力エラー", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const updated = await prisma.announcement.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (error) {
    logError("PATCH /api/announcements", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

async function handleSend(id: string) {
  // 幂等：既送信なら拒否
  const claim = await prisma.announcement.updateMany({
    where: { id, sentAt: null },
    data: { sentAt: new Date() },
  });
  if (claim.count === 0) {
    return NextResponse.json({ error: "既に送信済みです" }, { status: 409 });
  }

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });
  }

  const where: Record<string, unknown> = {};
  if (announcement.targetType === "合格者") {
    where.status = { in: ["合格", "補欠合格"] };
  } else if (announcement.targetType === "specific_cohort" && announcement.targetCohortId) {
    where.cohortId = announcement.targetCohortId;
  } else if (announcement.targetType === "status_filter" && announcement.targetStatus) {
    where.status = announcement.targetStatus;
  }

  const recipients = await prisma.application.findMany({
    where,
    select: { email: true },
    distinct: ["email"],
  });
  const emails = recipients.map((r) => r.email);

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    await prisma.announcement.update({ where: { id }, data: { sentCount: 0 } });
    return NextResponse.json({
      success: true,
      smtpEnabled: false,
      targets: emails.length,
      sentCount: 0,
    });
  }

  const subject = `【お知らせ】${announcement.title}`;
  const titleSafe = escapeHtml(announcement.title);
  const contentSafe = escapeHtml(announcement.content);
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#f5f5f5; margin:0; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden;">
    <div style="background:#1e3a5f; color:#fff; padding:24px 32px;">
      <h1 style="margin:0; font-size:20px; font-weight:700;">${titleSafe}</h1>
      <p style="margin:4px 0 0; font-size:13px; opacity:0.8;">専門学校 入学出願システム</p>
    </div>
    <div style="padding:32px;">
      <div style="font-size:15px; line-height:1.8; color:#333; white-space:pre-line;">${contentSafe}</div>
    </div>
  </div>
</body></html>`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    pool: true,
    maxConnections: 5,
  });

  const limit = pLimit(5);
  let sentCount = 0;
  let failCount = 0;
  await Promise.all(
    emails.map((email) =>
      limit(async () => {
        try {
          await transporter.sendMail({ from: smtpFrom, to: email, subject, html });
          sentCount++;
        } catch (e) {
          failCount++;
          logError("announcement send failed", e, { email });
        }
      }),
    ),
  );
  transporter.close();

  await prisma.announcement.update({
    where: { id },
    data: { sentCount },
  });

  logger.info({ id, targets: emails.length, sentCount, failCount }, "announcement sent");
  return NextResponse.json({
    success: true,
    smtpEnabled: true,
    targets: emails.length,
    sentCount,
    failCount,
  });
}
