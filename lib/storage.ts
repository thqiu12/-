import path from "path";

// アップロード書類は public/ の外に保存し、認証付きのダウンロードAPI経由でのみ配信する。
// （public/ 配下に置くと Next が誰でもアクセス可能な静的ファイルとして配信してしまうため）
//
// UPLOAD_DIR を指定する場合も、必ず public/ の外を指すこと。
export const STORAGE_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "storage", "uploads");

/** 申請ID + 保存ファイル名から物理パスを組み立てる。 */
export function docPhysicalPath(applicationId: string, fileName: string): string {
  return path.join(STORAGE_ROOT, applicationId, fileName);
}

/** DBの filePath に保存する、保護されたダウンロードURL。 */
export function docDownloadUrl(documentId: string): string {
  return `/api/documents/${documentId}/file`;
}
