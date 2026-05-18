import Link from "next/link";
import { Download, PenLine, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MockLessonRecordsButton } from "@/components/mock-lesson-records-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import { formatGrade, gradeOptions } from "@/lib/grades";
import {
  lessonRecordSortOptions,
  parseLessonRecordSort,
  sortLessonRecords
} from "@/lib/lesson-records";
import { createClient } from "@/lib/supabase/server";
import type { Course, LessonRecord, Student } from "@/lib/types";
import { weekdayFromDate, weekdayOptions } from "@/lib/weekdays";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  substitute: "振替"
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-rose-50 text-rose-700 border-rose-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  substitute: "bg-sky-50 text-sky-700 border-sky-200"
};

const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-500",
  Roblox: "bg-emerald-500",
  ITオンライン部: "bg-violet-500",
  イラスト: "bg-orange-500"
};

const GROUP_OPTIONS = [
  { value: "", label: "なし（一覧）" },
  { value: "grade", label: "学年別" },
  { value: "weekday", label: "曜日別" },
  { value: "course", label: "コース別" }
] as const;

type GroupKey = "grade" | "weekday" | "course" | "";

function parseGroup(value: string | undefined): GroupKey {
  if (value === "grade" || value === "weekday" || value === "course") return value;
  return "";
}

export default async function LessonRecordsPage({
  searchParams
}: {
  searchParams: Promise<{
    student_id?: string;
    course_id?: string;
    grade?: string;
    from?: string;
    to?: string;
    year?: string;
    weekday?: string;
    sort?: string;
    group?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const sort = parseLessonRecordSort(params.sort);
  const group = parseGroup(params.group);

  const [studentsResult, yearsResult, coursesResult] = await Promise.all([
    supabase
      .from("students")
      .select("student_id,last_name,first_name,grade")
      .order("last_name_kana", { ascending: true, nullsFirst: false }),
    supabase
      .from("lesson_records")
      .select("lesson_date")
      .order("lesson_date", { ascending: false }),
    supabase
      .from("courses")
      .select("course_id,course_name")
      .eq("status", "active")
      .order("course_name")
  ]);

  const students = (studentsResult.data ?? []) as Student[];
  const courses = uniqueCoursesByCanonicalName(
    (coursesResult.data ?? []) as Pick<Course, "course_id" | "course_name">[]
  );
  const years = Array.from(
    new Set(
      (yearsResult.data ?? [])
        .map((record) => record.lesson_date?.slice(0, 4))
        .filter((year): year is string => Boolean(year))
    )
  );

  let recordsQuery = supabase
    .from("lesson_records")
    .select(
      "*,students(student_id,last_name,first_name,grade),courses(course_id,course_name),staff(staff_id,name)"
    )
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false });

  if (params.student_id) {
    recordsQuery = recordsQuery.eq("student_id", params.student_id);
  }
  if (params.course_id) {
    recordsQuery = recordsQuery.eq("course_id", params.course_id);
  }
  if (params.year) {
    recordsQuery = recordsQuery
      .gte("lesson_date", `${params.year}-01-01`)
      .lte("lesson_date", `${params.year}-12-31`);
  }
  if (params.from) recordsQuery = recordsQuery.gte("lesson_date", params.from);
  if (params.to) recordsQuery = recordsQuery.lte("lesson_date", params.to);

  const { data: records } = await recordsQuery;
  let filteredRecords = (records ?? []) as LessonRecord[];

  if (params.weekday) {
    filteredRecords = filteredRecords.filter(
      (record) => weekdayFromDate(record.lesson_date) === params.weekday
    );
  }
  if (params.grade) {
    filteredRecords = filteredRecords.filter(
      (record) => record.students?.grade === params.grade
    );
  }

  const sortedRecords = sortLessonRecords(filteredRecords, sort);

  // グループ化
  const groups = (() => {
    if (!group) return null;
    const map = new Map<string, LessonRecord[]>();
    for (const record of sortedRecords) {
      let key = "（未設定）";
      if (group === "grade") {
        key = record.students?.grade || "（学年未設定）";
      } else if (group === "weekday") {
        key = `${weekdayFromDate(record.lesson_date) || "?"}曜日`;
      } else if (group === "course") {
        key = normalizeCourseName(record.courses?.course_name) || "（コース未設定）";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(record);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (group === "grade") {
        const order = [...gradeOptions, "（学年未設定）"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }
      if (group === "weekday") {
        const order = weekdayOptions.map((w) => `${w}曜日`);
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }
      return a[0].localeCompare(b[0], "ja");
    });
  })();

  const exportUrl = `/api/lesson-records/export?${new URLSearchParams(
    Object.fromEntries(
      Object.entries({
        student_id: params.student_id,
        year: params.year,
        from: params.from,
        to: params.to
      }).filter(([, v]) => Boolean(v)) as [string, string][]
    )
  ).toString()}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">授業記録一覧</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sortedRecords.length}件 ・{" "}
              {lessonRecordSortOptions.find((o) => o.value === sort)?.label}
              {group && `・${GROUP_OPTIONS.find((g) => g.value === group)?.label}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {process.env.NODE_ENV === "development" && <MockLessonRecordsButton />}
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl} download>
                <Download className="h-4 w-4" />
                CSV出力
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/lesson-records/new">
                <PenLine className="h-4 w-4" />
                記録を入力
              </Link>
            </Button>
          </div>
        </header>

        {/* フィルター */}
        <form className="space-y-3 rounded-md border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <NativeSelect
                name="student_id"
                defaultValue={params.student_id ?? ""}
                className="pl-9"
                aria-label="生徒"
              >
                <option value="">すべての生徒</option>
                {students.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {fullName(student)}
                    {student.grade ? ` / ${formatGrade(student.grade)}` : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <NativeSelect name="grade" defaultValue={params.grade ?? ""} aria-label="学年">
              <option value="">すべての学年</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              name="course_id"
              defaultValue={params.course_id ?? ""}
              aria-label="コース"
            >
              <option value="">すべてのコース</option>
              {courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {normalizeCourseName(course.course_name)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              name="weekday"
              defaultValue={params.weekday ?? ""}
              aria-label="曜日"
            >
              <option value="">すべての曜日</option>
              {weekdayOptions.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {weekday}曜日
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="year" defaultValue={params.year ?? ""} aria-label="年">
              <option value="">すべての年</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}年
                </option>
              ))}
            </NativeSelect>
            <Input
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              aria-label="開始日"
            />
            <Input
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              aria-label="終了日"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">グループ化</span>
              <NativeSelect
                name="group"
                defaultValue={group}
                aria-label="グループ化"
                className="h-8 w-auto text-sm"
              >
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">並び替え</span>
              <NativeSelect
                name="sort"
                defaultValue={sort}
                aria-label="並び替え"
                className="h-8 w-auto text-sm"
              >
                {lessonRecordSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline" size="sm" className="ml-auto">
              絞り込み
            </Button>
          </div>
        </form>

        {/* 一覧 */}
        {sortedRecords.length === 0 ? (
          <EmptyState>条件に一致する授業記録がありません。</EmptyState>
        ) : groups ? (
          <div className="space-y-6">
            {groups.map(([groupKey, recs]) => (
              <section key={groupKey} className="space-y-2">
                <div className="flex items-baseline gap-3 border-b pb-2">
                  <h2 className="text-sm font-semibold">{groupKey}</h2>
                  <span className="text-xs text-muted-foreground">{recs.length}件</span>
                </div>
                <RecordTable records={recs} />
              </section>
            ))}
          </div>
        ) : (
          <RecordTable records={sortedRecords} />
        )}
      </div>
    </AppShell>
  );
}

function RecordTable({ records }: { records: LessonRecord[] }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">日付</th>
              <th className="px-3 py-2 text-left font-medium">時間</th>
              <th className="px-3 py-2 text-left font-medium">生徒</th>
              <th className="px-3 py-2 text-left font-medium">学年</th>
              <th className="px-3 py-2 text-left font-medium">コース</th>
              <th className="px-3 py-2 text-left font-medium">出欠</th>
              <th className="px-3 py-2 text-left font-medium">内容</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record) => {
              const courseName = normalizeCourseName(record.courses?.course_name);
              const dotColor = COURSE_DOT[courseName] ?? "bg-gray-300";
              return (
                <tr key={record.lesson_record_id} className="hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-muted-foreground">
                    {formatDate(record.lesson_date)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-muted-foreground">
                    {formatTime(record.start_time)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {record.students ? (
                      <Link
                        href={`/students/${record.students.student_id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {fullName(record.students)}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-muted-foreground">
                    {record.students?.grade ? formatGrade(record.students.grade) : "-"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                        aria-hidden
                      />
                      {courseName || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {record.attendance_status ? (
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                          ATTENDANCE_COLORS[record.attendance_status] ?? ""
                        }`}
                      >
                        {ATTENDANCE_LABELS[record.attendance_status] ?? record.attendance_status}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/lesson-records/${record.lesson_record_id}`}
                      className="block group"
                    >
                      <div className="line-clamp-1 font-medium group-hover:text-primary group-hover:underline">
                        {emptyText(record.title) === "-"
                          ? "（目的未記入）"
                          : emptyText(record.title)}
                      </div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {previewText(record.content, 80)}
                      </div>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
