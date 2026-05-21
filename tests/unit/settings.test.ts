/**
 * lib/settings.ts の単体テスト。
 * - getEnrollmentYears: 未保存時はデフォルト、保存時は正規化
 * - setSetting / getSetting: JSON 往復が正しく動く
 * - 異常な値が DB にあった場合のフォールバック
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getSetting,
  setSetting,
  getEnrollmentYears,
} from "@/lib/settings";

describe("lib/settings", () => {
  beforeEach(async () => {
    await prisma.systemSetting.deleteMany({});
  });

  describe("getEnrollmentYears", () => {
    it("未保存時は現在年〜+2年を返す", async () => {
      const years = await getEnrollmentYears();
      const currentYear = new Date().getFullYear();
      expect(years).toEqual([
        String(currentYear),
        String(currentYear + 1),
        String(currentYear + 2),
      ]);
    });

    it("保存した値が返る（昇順・重複除去）", async () => {
      await setSetting("enrollmentYears", ["2028", "2026", "2027", "2026"]);
      const years = await getEnrollmentYears();
      expect(years).toEqual(["2026", "2027", "2028"]);
    });

    it("4桁数字でない値はフィルタされる", async () => {
      // 直接 DB に invalid な値を入れて、getter が防御してることを確認
      await prisma.systemSetting.upsert({
        where: { key: "enrollmentYears" },
        create: {
          key: "enrollmentYears",
          value: JSON.stringify(["2026", "20a6", "abc", "2027"]),
        },
        update: { value: JSON.stringify(["2026", "20a6", "abc", "2027"]) },
      });
      const years = await getEnrollmentYears();
      expect(years).toEqual(["2026", "2027"]);
    });

    it("空配列が保存されていたらデフォルトにフォールバック", async () => {
      await setSetting("enrollmentYears", []);
      const years = await getEnrollmentYears();
      expect(years.length).toBeGreaterThan(0);
    });

    it("壊れた JSON が DB にあってもクラッシュしない", async () => {
      await prisma.systemSetting.upsert({
        where: { key: "enrollmentYears" },
        create: { key: "enrollmentYears", value: "{not json" },
        update: { value: "{not json" },
      });
      const years = await getEnrollmentYears();
      expect(years.length).toBeGreaterThan(0);
    });
  });

  describe("setSetting / getSetting", () => {
    it("文字列値を保存して取得できる", async () => {
      await setSetting("enrollmentMonth", "10");
      const v = await getSetting("enrollmentMonth");
      expect(v).toBe("10");
    });

    it("updatedBy が記録される", async () => {
      await setSetting("enrollmentMonth", "9", "test-admin");
      const row = await prisma.systemSetting.findUnique({
        where: { key: "enrollmentMonth" },
      });
      expect(row?.updatedBy).toBe("test-admin");
    });

    it("既存設定を上書き更新できる", async () => {
      await setSetting("enrollmentMonth", "4");
      await setSetting("enrollmentMonth", "9");
      const v = await getSetting("enrollmentMonth");
      expect(v).toBe("9");
    });
  });
});
