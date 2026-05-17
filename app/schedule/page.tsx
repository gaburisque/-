import { AppShell } from "@/components/app-shell";
import { normalizeCourseName } from "@/lib/courses";
import { dedupeEnrollmentsByStudentCourseTime } from "@/lib/enrollments";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, Staff } from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";
import { ScheduleGrid } from "./schedule-grid";

export default async function SchedulePage() {
  const supabase = await createClient();

  const [enrollmentsResult, staffResult, assignmentsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "enrollment_id,weekday,start_time,students(student_id,last_name,first_name,grade),courses(course_name)"
      )
      .eq("status", "active")
      .in("weekday", weekdayOptions)
      .order("start_time", { ascending: true, nullsFirst: true }),
    supabase.from("staff").select("staff_id,name").order("name"),
    supabase.from("lesson_assignments").select("assignment_id,enrollment_id,staff_id,staff(name)")
  ]);

  const allEnrollments = (enrollmentsResult.data ?? []) as Enrollment[];
  const enrollments = dedupeEnrollmentsByStudentCourseTime(allEnrollments);

  const staffList = (staffResult.data ?? []) as Staff[];

  const assignmentMap = new Map<
    string,
    { assignment_id: string | null; staff_id: string; staff_name: string }
  >(
    (assignmentsResult.data ?? []).map((a) => [
      a.enrollment_id,
      {
        assignment_id: a.assignment_id,
        staff_id: a.staff_id,
        staff_name: ((a.staff as unknown) as { name: string } | null)?.name ?? ""
      }
    ])
  );

  // 担当割当は重複登録された受講にも引き当てる
  function enrollmentKey(enrollment: Enrollment) {
    const studentId = one(enrollment.students)?.student_id ?? "";
    const course = normalizeCourseName(one(enrollment.courses)?.course_name);
    const startTime = enrollment.start_time ?? "";
    const weekday = enrollment.weekday ?? "";
    return `${weekday}::${studentId}::${course}::${startTime}`;
  }

  const enrollmentIdsByKey = new Map<string, string[]>();
  for (const e of allEnrollments) {
    const studentId = one(e.students)?.student_id;
    const course = normalizeCourseName(one(e.courses)?.course_name);
    if (studentId && course) {
      const key = enrollmentKey(e);
      const ids = enrollmentIdsByKey.get(key) ?? [];
      ids.push(e.enrollment_id);
      enrollmentIdsByKey.set(key, ids);
    }
  }

  // 表示用に、重複グループ内のどこかに割当があれば見えるようにする
  const resolvedAssignmentMap = new Map(assignmentMap);
  for (const enrollment of enrollments) {
    if (resolvedAssignmentMap.has(enrollment.enrollment_id)) continue;
    const ids = enrollmentIdsByKey.get(enrollmentKey(enrollment)) ?? [];
    for (const id of ids) {
      const a = assignmentMap.get(id);
      if (a) {
        resolvedAssignmentMap.set(enrollment.enrollment_id, a);
        break;
      }
    }
  }

  // 実際に使われている時間帯を収集してソート
  const timeSet = new Set<string>();
  for (const e of enrollments) {
    if (e.start_time) timeSet.add(e.start_time.slice(0, 5));
  }
  const timeSlots = Array.from(timeSet).sort();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">スケジュール</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            週次の授業スケジュールと担当割り当て。コマをクリックして担当を編集できます。
          </p>
        </div>

        <ScheduleGrid
          enrollments={enrollments}
          assignmentMap={resolvedAssignmentMap}
          staffList={staffList}
          timeSlots={timeSlots}
        />
      </div>
    </AppShell>
  );
}
