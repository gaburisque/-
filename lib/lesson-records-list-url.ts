/** Builds `/lesson-records` list URLs with stable query merging (omit empty / undefined). */
export function buildLessonRecordsListPath(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const merged = { ...base, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `/lesson-records?${q}` : "/lesson-records";
}
