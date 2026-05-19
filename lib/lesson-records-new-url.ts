/** Builds `/lesson-records/new` URLs with stable query merging (omit empty / deleted overrides). */

function omitEmpty(obj: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export function buildLessonRecordsNewPath(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const merged = omitEmpty({ ...base });
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete merged[k];
    else merged[k] = v;
  }
  const q = new URLSearchParams(merged).toString();
  return q ? `/lesson-records/new?${q}` : "/lesson-records/new";
}

export type LessonRecordsNewNavFields = {
  weekday: string;
  date: string;
  enrollmentId?: string;
  studentId?: string;
  hash?: string;
  message?: string;
};

/** Convenience helper for server components and links */
export function lessonRecordsNewHrefFromFields(fields: LessonRecordsNewNavFields): string {
  const base: Record<string, string | undefined> = {
    weekday: fields.weekday,
    date: fields.date,
    enrollment_id: fields.enrollmentId,
    student_id: fields.studentId,
    message: fields.message
  };
  const path = buildLessonRecordsNewPath(base, {});
  return fields.hash ? `${path}${fields.hash}` : path;
}
