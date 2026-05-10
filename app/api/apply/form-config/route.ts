import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FORM_FIELD_DEFAULTS } from "@/lib/formFieldDefaults";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SELECT = {
  fieldKey: true,
  label: true,
  fieldType: true,
  isEnabled: true,
  isRequired: true,
  displayOrder: true,
  section: true,
  description: true,
} as const;

function fallback() {
  return FORM_FIELD_DEFAULTS.map((f) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    fieldType: f.fieldType,
    isEnabled: true,
    isRequired: f.isRequired,
    displayOrder: f.displayOrder,
    section: f.section,
    description: null,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || null;

    const [globalConfigs, schoolConfigs] = await Promise.all([
      prisma.formFieldConfig.findMany({
        where: { schoolId: null, isEnabled: true },
        orderBy: { displayOrder: "asc" },
        select: SELECT,
      }),
      schoolId
        ? prisma.formFieldConfig.findMany({
            where: { schoolId },
            orderBy: { displayOrder: "asc" },
            select: SELECT,
          })
        : Promise.resolve([]),
    ]);

    if (!schoolId) {
      return NextResponse.json(globalConfigs.length > 0 ? globalConfigs : fallback());
    }

    if (schoolConfigs.length === 0) {
      return NextResponse.json(globalConfigs.length > 0 ? globalConfigs : fallback());
    }

    const globalMap = new Map(globalConfigs.map((c) => [c.fieldKey, c]));
    const schoolMap = new Map(schoolConfigs.map((c) => [c.fieldKey, c]));
    const allKeys = new Set([
      ...FORM_FIELD_DEFAULTS.map((f) => f.fieldKey),
      ...Array.from(globalMap.keys()),
      ...Array.from(schoolMap.keys()),
    ]);

    const merged = Array.from(allKeys)
      .map((key) => {
        const s = schoolMap.get(key);
        if (s) return s;
        const g = globalMap.get(key);
        if (g) return g;
        const def = FORM_FIELD_DEFAULTS.find((f) => f.fieldKey === key);
        if (!def) return null;
        return {
          fieldKey: def.fieldKey,
          label: def.label,
          fieldType: def.fieldType,
          isEnabled: true,
          isRequired: def.isRequired,
          displayOrder: def.displayOrder,
          section: def.section,
          description: null,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null && c.isEnabled)
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    return NextResponse.json(merged);
  } catch (e) {
    logError("GET /api/apply/form-config", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
