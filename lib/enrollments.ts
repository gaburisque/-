import { normalizeCourseName } from "@/lib/courses";
import { one } from "@/lib/relations";
import type { Enrollment } from "@/lib/types";

/**
 * 同一曜日・同一時間帯で A/B クラスなど重複登録されている受講を1行にまとめる。
 */
export function dedupeEnrollmentsByStudentCourseTime(enrollments: Enrollment[]): Enrollment[] {
  const visible: Enrollment[] = [];
  const seen = new Set<string>();

  for (const enrollment of enrollments) {
    const studentId = one(enrollment.students)?.student_id;
    const normalizedCourse = normalizeCourseName(one(enrollment.courses)?.course_name);
    const startTime = enrollment.start_time ?? "";

    if (!studentId || !normalizedCourse) {
      visible.push(enrollment);
      continue;
    }

    const key = `${studentId}::${normalizedCourse}::${startTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    visible.push(enrollment);
  }

  return visible;
}
