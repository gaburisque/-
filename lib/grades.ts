export const gradeOptions = [
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3"
] as const;

export type GradeOption = (typeof gradeOptions)[number];

const GRADE_ORDER = gradeOptions as readonly string[];

/**
 * DBに入っている様々な表記を「小1」「中1」「高1」形式に揃える。
 */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade) return null;

  const g = grade.trim();
  if (!g) return null;

  if (/^[小中高][1-6]$/.test(g)) {
    return g;
  }

  const elementary = g.match(/^(?:小学|小)?([1-6])年?$/u);
  if (elementary) {
    return `小${elementary[1]}`;
  }

  const middle = g.match(/^(?:中学|中)([1-3])年?$/u);
  if (middle) {
    return `中${middle[1]}`;
  }

  const high = g.match(/^(?:高校|高)([1-3])年?$/u);
  if (high) {
    return `高${high[1]}`;
  }

  const bareYear = g.match(/^([1-6])年$/u);
  if (bareYear) {
    return `小${bareYear[1]}`;
  }

  return g;
}

/**
 * 1学年進める。高3 → null（卒業）。
 */
export function nextGrade(grade: string | null | undefined): string | null {
  const normalized = normalizeGrade(grade);
  if (!normalized) return null;
  const idx = GRADE_ORDER.indexOf(normalized);
  if (idx === -1) return normalized;
  if (idx === GRADE_ORDER.length - 1) return null; // 高3 → 卒業
  return GRADE_ORDER[idx + 1];
}

/**
 * 生年月日から現在の年齢を返す。
 */
export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * 学年を表示する。grade が null で birth_date があれば年齢を表示する。
 */
export function formatGradeOrAge(
  grade: string | null | undefined,
  birthDate: string | null | undefined
): string {
  const normalized = normalizeGrade(grade);
  if (normalized) return normalized;
  const age = calcAge(birthDate);
  if (age !== null) return `${age}歳`;
  return "-";
}

export function formatGrade(grade: string | null | undefined): string {
  return normalizeGrade(grade) ?? "-";
}
