import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { upsertLessonAssignment } from "@/app/actions";
import { normalizeCourseName } from "@/lib/courses";
import { dedupeEnrollmentsByStudentCourseTime } from "@/lib/enrollments";
import { formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, Staff } from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";

export default async function SchedulePage({
  searchParams
}: {
  searchParams: Promise<{ weekday?: string }>;
}) {
  const params = await searchParams;
  const selectedWeekday = params.weekday && weekdayOptions.includes(params.weekday) ? params.weekday : weekdayOptions[0];

  const supabase = await createClient();

  const [enrollmentsResult, staffResult, assignmentsResult] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "enrollment_id,weekday,start_time,students(student_id,last_name,first_name,grade),courses(course_name)"
      )
      .eq("weekday", selectedWeekday)
      .eq("status", "active")
      .order("start_time", { ascending: true, nullsFirst: true }),
    supabase.from("staff").select("staff_id,name").order("name"),
    supabase
      .from("lesson_assignments")
      .select("assignment_id,enrollment_id,staff_id,staff(name)")
  ]);

  const allEnrollments = (enrollmentsResult.data ?? []) as Enrollment[];
  const enrollments = dedupeEnrollmentsByStudentCourseTime(allEnrollments);

  const staffList = (staffResult.data ?? []) as Staff[];

  const assignmentMap = new Map(
    (assignmentsResult.data ?? []).map((a) => [
      a.enrollment_id,
      { assignment_id: a.assignment_id, staff_id: a.staff_id, staff: a.staff }
    ])
  );

  function enrollmentKey(enrollment: Enrollment) {
    const studentId = one(enrollment.students)?.student_id ?? "";
    const course = normalizeCourseName(one(enrollment.courses)?.course_name);
    const startTime = enrollment.start_time ?? "";
    return `${studentId}::${course}::${startTime}`;
  }

  const enrollmentIdsByKey = new Map<string, string[]>();
  for (const enrollment of allEnrollments) {
    const studentId = one(enrollment.students)?.student_id;
    const course = normalizeCourseName(one(enrollment.courses)?.course_name);
    const key = enrollmentKey(enrollment);
    if (studentId && course) {
      const ids = enrollmentIdsByKey.get(key) ?? [];
      ids.push(enrollment.enrollment_id);
      enrollmentIdsByKey.set(key, ids);
    }
  }

  function findAssignment(enrollment: Enrollment) {
    const ids = enrollmentIdsByKey.get(enrollmentKey(enrollment)) ?? [enrollment.enrollment_id];
    for (const id of ids) {
      const assignment = assignmentMap.get(id);
      if (assignment) return assignment;
    }
    return undefined;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">曜日ごとの担当割り当てを確認・設定します。全員が閲覧できます。</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {weekdayOptions.map((day) => (
            <Button
              key={day}
              asChild
              variant={selectedWeekday === day ? "default" : "outline"}
              size="sm"
            >
              <Link href={`/schedule?weekday=${day}`}>{day}曜</Link>
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedWeekday}曜日の担当</CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間</TableHead>
                    <TableHead>生徒</TableHead>
                    <TableHead>コース</TableHead>
                    <TableHead>担当講師</TableHead>
                    <TableHead>変更</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => {
                    const assignment = findAssignment(enrollment);
                    const assignedStaff = assignment?.staff as { name: string } | null | undefined;
                    const student = one(enrollment.students);
                    const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
                    return (
                      <TableRow key={enrollment.enrollment_id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatTime(enrollment.start_time)}
                        </TableCell>
                        <TableCell>
                          {student ? fullName(student) : "-"}
                          <div className="text-xs text-muted-foreground">{formatGrade(student?.grade)}</div>
                        </TableCell>
                        <TableCell>{courseName || "-"}</TableCell>
                        <TableCell>
                          {assignedStaff ? (
                            <span className="font-medium">{assignedStaff.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">未割当</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <form action={upsertLessonAssignment} className="flex gap-1">
                            <input type="hidden" name="enrollment_id" value={enrollment.enrollment_id} />
                            <input type="hidden" name="weekday" value={selectedWeekday} />
                            <NativeSelect
                              name="staff_id"
                              defaultValue={assignment?.staff_id ?? ""}
                              className="h-8 text-sm"
                            >
                              <option value="">未割当</option>
                              {staffList.map((s) => (
                                <option key={s.staff_id} value={s.staff_id}>
                                  {s.name}
                                </option>
                              ))}
                            </NativeSelect>
                            <Button type="submit" size="sm" variant="outline">
                              保存
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>{selectedWeekday}曜日に受講中の生徒がいません。</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
