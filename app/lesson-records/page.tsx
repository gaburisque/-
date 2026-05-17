import Link from "next/link";
import { Download, PenLine, Search } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
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
  present: "bg-green-100 text-green-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-yellow-100 text-yellow-800",
  substitute: "bg-blue-100 text-blue-800"
};

export default async function LessonRecordsPage({
  searchParams
}: {
  searchParams: Promise<{
    student_id?: string;
    course_id?: string;
    from?: string;
    to?: string;
    year?: string;
    weekday?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const sort = parseLessonRecordSort(params.sort);

  const [studentsResult, yearsResult, coursesResult] = await Promise.all([
    supabase
      .from("students")
      .select("student_id,last_name,first_name,grade")
      .order("last_name_kana", { ascending: true, nullsFirst: false }),
    supabase.from("lesson_records").select("lesson_date").order("lesson_date", { ascending: false }),
    supabase.from("courses").select("course_id,course_name").eq("status", "active").order("course_name")
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
    .select("*,students(student_id,last_name,first_name,grade),courses(course_id,course_name),staff(staff_id,name)")
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

  if (params.from) {
    recordsQuery = recordsQuery.gte("lesson_date", params.from);
  }

  if (params.to) {
    recordsQuery = recordsQuery.lte("lesson_date", params.to);
  }

  const { data: records } = await recordsQuery;
  const filteredRecords = params.weekday
    ? ((records ?? []) as LessonRecord[]).filter(
        (record) => weekdayFromDate(record.lesson_date) === params.weekday
      )
    : ((records ?? []) as LessonRecord[]);
  const sortedRecords = sortLessonRecords(filteredRecords, sort);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">授業記録</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {sortedRecords.length}件の記録
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/lesson-records/export?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({
                    student_id: params.student_id,
                    year: params.year,
                    from: params.from,
                    to: params.to
                  }).filter(([, v]) => Boolean(v)) as [string, string][]
                )
              ).toString()}`}
              download
            >
              <Download className="h-4 w-4" />
              CSV出力
            </a>
          </Button>
          <Button asChild>
            <Link href="/lesson-records/new">
              <PenLine className="mr-2 h-4 w-4" />
              記録を入力
            </Link>
          </Button>
        </div>

        {/* フィルター */}
        <Card>
          <CardContent className="pt-5">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2 lg:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <NativeSelect name="student_id" defaultValue={params.student_id ?? ""} className="pl-9">
                  <option value="">すべての生徒</option>
                  {students.map((student) => (
                    <option key={student.student_id} value={student.student_id}>
                      {fullName(student)}
                      {student.grade ? ` / ${formatGrade(student.grade)}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <NativeSelect name="course_id" defaultValue={params.course_id ?? ""} aria-label="コース">
                <option value="">すべてのコース</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {normalizeCourseName(course.course_name)}
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
              <NativeSelect name="weekday" defaultValue={params.weekday ?? ""} aria-label="曜日">
                <option value="">すべての曜日</option>
                {weekdayOptions.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekday}曜日
                  </option>
                ))}
              </NativeSelect>
              <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="開始日" />
              <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="終了日" />
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <NativeSelect name="sort" defaultValue={sort} aria-label="並び替え" className="flex-1">
                  {lessonRecordSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit" variant="outline" className="shrink-0">
                  絞り込み
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 一覧テーブル */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">授業記録一覧</CardTitle>
              <CardDescription>
                {sortedRecords.length}件 · {lessonRecordSortOptions.find((o) => o.value === sort)?.label}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {sortedRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">授業日</TableHead>
                      <TableHead className="w-[64px]">時間</TableHead>
                      <TableHead className="w-[140px]">生徒</TableHead>
                      <TableHead className="w-[100px]">コース</TableHead>
                      <TableHead className="w-[72px]">出欠</TableHead>
                      <TableHead className="w-[180px]">目的 / タイトル</TableHead>
                      <TableHead>内容</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRecords.map((record) => (
                      <TableRow key={record.lesson_record_id} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap py-2.5 align-top text-sm">
                          {formatDate(record.lesson_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2.5 align-top text-sm font-mono text-muted-foreground">
                          {formatTime(record.start_time)}
                        </TableCell>
                        <TableCell className="py-2.5 align-top">
                          {record.students ? (
                            <Link
                              href={`/students/${record.students.student_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {fullName(record.students)}
                            </Link>
                          ) : "-"}
                          {record.students?.grade && (
                            <div className="text-xs text-muted-foreground">
                              {formatGrade(record.students.grade)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-top text-sm">
                          {normalizeCourseName(record.courses?.course_name) || "-"}
                        </TableCell>
                        <TableCell className="py-2.5 align-top">
                          {record.attendance_status ? (
                            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ATTENDANCE_COLORS[record.attendance_status] ?? "bg-muted text-muted-foreground"}`}>
                              {ATTENDANCE_LABELS[record.attendance_status] ?? record.attendance_status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2.5 align-top">
                          <Link
                            href={`/lesson-records/${record.lesson_record_id}`}
                            className="line-clamp-2 text-sm font-medium text-primary hover:underline"
                          >
                            {emptyText(record.title)}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2.5 align-top">
                          <Link
                            href={`/lesson-records/${record.lesson_record_id}`}
                            className="line-clamp-2 text-sm leading-5 text-muted-foreground hover:text-foreground"
                          >
                            {previewText(record.content, 100)}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>条件に一致する授業記録がありません。</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
