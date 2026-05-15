/** 運用で使う正式コース名（4種） */
export const CANONICAL_COURSE_NAMES = ["Scratch", "Roblox", "ITオンライン部", "イラスト"] as const;

export type CanonicalCourseName = (typeof CANONICAL_COURSE_NAMES)[number];

/**
 * DB上のコース名（A:スクラッチ 等）を表示用の正式名に変換する。
 */
export function normalizeCourseName(courseName: string | null | undefined): string {
  if (!courseName) return "";

  // A:スクラッチ / B:＃ITオンライン部 などのクラス接頭辞のみ除去（Roblox の R は残す）
  const stripped = courseName.replace(/^[A-ZＡ-Ｚ]\s*[:：#＃]\s*/u, "").trim();
  const lower = stripped.toLowerCase();

  if (stripped.includes("スクラッチ") || lower.includes("scratch")) {
    return "Scratch";
  }
  if (stripped.includes("ロブロ") || lower.includes("roblox")) {
    return "Roblox";
  }
  if (stripped.includes("ITオンライン") || stripped.includes("オンライン部")) {
    return "ITオンライン部";
  }
  if (stripped.includes("イラスト")) {
    return "イラスト";
  }

  return stripped;
}

/** 表示・選択用に、正規化後の名前が重複するコースを1件にまとめる */
export function uniqueCoursesByCanonicalName<T extends { course_id: string; course_name: string }>(
  courses: T[]
): T[] {
  const map = new Map<string, T>();
  for (const course of courses) {
    const key = normalizeCourseName(course.course_name);
    if (!key || map.has(key)) continue;
    map.set(key, course);
  }
  return Array.from(map.values());
}
