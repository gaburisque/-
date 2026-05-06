import Link from "next/link";
import { ClipboardPlus, Search } from "lucide-react";

import { addLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import {
  lessonRecordSortOptions,
  parseLessonRecordSort,
  sortLessonRecords
} from "@/lib/lesson-records";
import { lessonEndTimeOptions, lessonStartTimeOptions } from "@/lib/lesson-times";
import { createClient } from "@/lib/supabase/server";
import type { Course, LessonRecord, Student } from "@/lib/types";
import { weekdayFromDate, weekdayOptions } from "@/lib/weekdays";

export default async function LessonRecordsPage({
  searchParams
}: {
  searchParams: Promise<{
    student_id?: string;
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

  const [studentsResult, coursesResult, yearsResult] = await Promise.all([
    supabase
      .from("students")
      .select("student_id,last_name,first_name,grade")
      .order("last_name_kana", { ascending: true, nullsFirst: false }),
    supabase.from("courses").select("*").eq("status", "active").order("course_name"),
    supabase.from("lesson_records").select("lesson_date").order("lesson_date", { ascending: false })
  ]);

  const students = (studentsResult.data ?? []) as Student[];
  const courses = (coursesResult.data ?? []) as Course[];
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
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Lesson records</h1>
          <p className="mt-1 text-sm text-muted-foreground">授業記録の閲覧と登録を行います。</p>
        </div>
        <div>
          <Button asChild>
            <Link href="/lesson-records/new">曜日から記録入力</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>フィルター</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_130px_120px_180px_180px_190px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <NativeSelect name="student_id" defaultValue={params.student_id ?? ""} className="pl-9">
                  <option value="">すべての生徒</option>
                  {students.map((student) => (
                    <option key={student.student_id} value={student.student_id}>
                      {fullName(student)} {student.grade ? ` / ${student.grade}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
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
              <NativeSelect name="sort" defaultValue={sort} aria-label="並び替え">
                {lessonRecordSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit">絞り込み</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>授業記録一覧</CardTitle>
            <CardDescription>
              {sortedRecords.length}件 / {lessonRecordSortOptions.find((option) => option.value === sort)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedRecords.length > 0 ? (
              <Table className="min-w-[980px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[112px]">授業日</TableHead>
                    <TableHead className="w-[72px]">時間</TableHead>
                    <TableHead className="w-[150px]">生徒</TableHead>
                    <TableHead className="w-[130px]">コース</TableHead>
                    <TableHead className="w-[220px]">タイトル</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead className="w-[220px]">宿題</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.map((record) => (
                    <TableRow key={record.lesson_record_id} className="cursor-pointer">
                      <TableCell className="whitespace-nowrap py-2 align-top">{formatDate(record.lesson_date)}</TableCell>
                      <TableCell className="whitespace-nowrap py-2 align-top">{formatTime(record.start_time)}</TableCell>
                      <TableCell className="py-2 align-top">
                        {record.students ? (
                          <Link
                            href={`/students/${record.students.student_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {fullName(record.students)}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="py-2 align-top">{record.courses?.course_name ?? "-"}</TableCell>
                      <TableCell className="py-2 align-top">
                        <Link
                          href={`/lesson-records/${record.lesson_record_id}`}
                          className="line-clamp-2 font-medium leading-5 text-primary hover:underline"
                          title={emptyText(record.title)}
                        >
                          {emptyText(record.title)}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <Link
                          href={`/lesson-records/${record.lesson_record_id}`}
                          className="line-clamp-2 leading-5 hover:text-primary"
                          title={emptyText(record.content)}
                        >
                          {previewText(record.content, 120)}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2 align-top">
                        <Link
                          href={`/lesson-records/${record.lesson_record_id}`}
                          className="line-clamp-2 leading-5 hover:text-primary"
                          title={emptyText(record.homework)}
                        >
                          {previewText(record.homework, 80)}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>授業記録がありません。</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPlus className="h-5 w-5" />
              授業記録フォーム
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addLessonRecord} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="student_id">生徒</Label>
                <NativeSelect id="student_id" name="student_id" defaultValue={params.student_id ?? ""} required>
                  <option value="">生徒を選択</option>
                  {students.map((student) => (
                    <option key={student.student_id} value={student.student_id}>
                      {fullName(student)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_id">コース</Label>
                <NativeSelect id="course_id" name="course_id">
                  <option value="">未選択</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lesson_date">授業日</Label>
                <Input id="lesson_date" name="lesson_date" type="date" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start_time">開始</Label>
                  <NativeSelect id="start_time" name="start_time">
                    <option value="">未選択</option>
                    {lessonStartTimeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">終了</Label>
                  <NativeSelect id="end_time" name="end_time">
                    <option value="">未選択</option>
                    {lessonEndTimeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">タイトル</Label>
                <Input id="title" name="title" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="content">内容</Label>
                <Textarea id="content" name="content" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="homework">宿題</Label>
                <Textarea id="homework" name="homework" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="memo">メモ</Label>
                <Textarea id="memo" name="memo" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">登録</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
