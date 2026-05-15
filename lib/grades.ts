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

export function formatGrade(grade: string | null | undefined): string {
  return normalizeGrade(grade) ?? "-";
}
