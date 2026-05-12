import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStudentOwnership } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { generateExamTicketPDF } from "@/lib/pdf/exam-ticket";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (!checkRateLimit(`exam-ticket:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "リクエストが多すぎます" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const applicationNo = searchParams.get("applicationNo");
    const email = searchParams.get("email");
    if (!applicationNo || !email) {
      return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 });
    }

    const ownership = await verifyStudentOwnership(applicationNo, email);
    if (!ownership.valid) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }

    const app = await prisma.application.findUnique({
      where: { id: ownership.applicationId },
      include: {
        documents: {
          where: { docType: "証明写真（3×3cm）" },
          orderBy: { uploadedAt: "desc" },
          take: 1,
          select: { filePath: true },
        },
      },
    });
    if (!app) {
      return NextResponse.json({ error: "申請が見つかりません" }, { status: 404 });
    }

    // 受験票は「受付中・書類確認中・面接待ち」の学生が対象
    const eligible = ["受付中", "書類確認中", "面接待ち"];
    if (!eligible.includes(app.status)) {
      return NextResponse.json(
        { error: "受験票は受付完了後にダウンロードできます" },
        { status: 403 },
      );
    }

    const issueDate = new Date().toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric",
    });

    const pdfBuffer = await generateExamTicketPDF({
      applicationNo: app.applicationNo,
      applicantName: `${app.lastName} ${app.firstName}`,
      applicantNameKana: `${app.lastNameKana} ${app.firstNameKana}`,
      nationality: app.nationality,
      birthDate: app.birthDate,
      gender: app.gender,
      schoolName: app.schoolName,
      department: app.department,
      course: app.course || "",
      enrollmentYear: app.enrollmentYear,
      enrollmentMonth: app.enrollmentMonth,
      examMode: app.examMode || "一般",
      interviewDate: app.interviewDate,
      interviewTime: app.interviewTime,
      interviewPlace: app.interviewPlace,
      interviewNotes: app.interviewNotes,
      photoFilePath: app.documents[0]?.filePath ?? null,
      issueDate,
    });

    const fileName = `受験票_${applicationNo}.pdf`;
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    logError("GET /api/documents/exam-ticket", error);
    return NextResponse.json({ error: "PDF生成に失敗しました" }, { status: 500 });
  }
}
