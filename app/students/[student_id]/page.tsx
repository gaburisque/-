import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus, Phone, UserRoundPlus } from "lucide-react";

import {
  addEmergencyContact,
  addEnrollment,
  addGuardian,
  addLessonRecord,
  updateEnrollmentSchedule,
  updateStudent
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import { gradeOptions } from "@/lib/grades";
import {
  lessonRecordSortOptions,
  parseLessonRecordSort,
  sortLessonRecords
} from "@/lib/lesson-records";
import { lessonEndTimeOptions, lessonStartTimeOptions } from "@/lib/lesson-times";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type {
  Course,
  EmergencyContact,
  Enrollment,
  Guardian,
  LessonRecord,
  School,
  Student
} from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";

export default async function StudentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ student_id: string }>;
  searchParams: Promise<{ lesson_year?: string; lesson_sort?: string }>;
}) {
  const { student_id: studentId } = await params;
  const resolvedSearchParams = await searchParams;
  const lessonSort = parseLessonRecordSort(resolvedSearchParams.lesson_sort);
  const supabase = await createClient();

  const [
    studentResult,
    schoolsResult,
    guardiansResult,
    contactsResult,
    enrollmentsResult,
    lessonRecordsResult,
    coursesResult
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*,schools(school_id,school_name,school_type)")
      .eq("student_id", studentId)
      .single(),
    supabase.from("schools").select("school_id,school_name,school_type").order("school_name"),
    supabase.from("guardians").select("*").eq("student_id", studentId).order("is_primary", { ascending: false }),
    supabase
      .from("emergency_contacts")
      .select("*")
      .eq("student_id", studentId)
      .order("priority", { ascending: true }),
    supabase
      .from("enrollments")
      .select("*,courses(course_id,course_name,description,status)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lesson_records")
      .select("*,courses(course_id,course_name),staff(staff_id,name)")
      .eq("student_id", studentId)
      .order("lesson_date", { ascending: false }),
    supabase.from("courses").select("*").eq("status", "active").order("course_name")
  ]);

  if (studentResult.error || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data as Student;
  const schools = (schoolsResult.data ?? []) as School[];
  const guardians = (guardiansResult.data ?? []) as Guardian[];
  const contacts = (contactsResult.data ?? []) as EmergencyContact[];
  const enrollments = (enrollmentsResult.data ?? []) as Enrollment[];
  const lessonRecords = (lessonRecordsResult.data ?? []) as LessonRecord[];
  const lessonYears = Array.from(
    new Set(
      lessonRecords
        .map((record) => record.lesson_date?.slice(0, 4))
        .filter((year): year is string => Boolean(year))
    )
  ).sort((a, b) => b.localeCompare(a));
  const visibleLessonRecords = sortLessonRecords(
    resolvedSearchParams.lesson_year
      ? lessonRecords.filter((record) => record.lesson_date?.startsWith(resolvedSearchParams.lesson_year ?? ""))
      : lessonRecords,
    lessonSort
  );
  const courses = (coursesResult.data ?? []) as Course[];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/students" className="text-sm text-primary hover:underline">
              生徒一覧へ戻る
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal">{fullName(student)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.grade ?? "学年未設定"} / {one(student.schools)?.school_name ?? "学校未設定"}
            </p>
          </div>
          <Button asChild>
            <a href="#new-lesson-record">
              <ClipboardPlus className="h-4 w-4" />
              新規授業記録
            </a>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>生徒情報を編集できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateStudent} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="student_id" value={student.student_id} />
              <div className="space-y-2">
                <Label htmlFor="last_name">姓</Label>
                <Input id="last_name" name="last_name" defaultValue={student.last_name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">名</Label>
                <Input id="first_name" name="first_name" defaultValue={student.first_name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name_kana">姓かな</Label>
                <Input id="last_name_kana" name="last_name_kana" defaultValue={student.last_name_kana ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name_kana">名かな</Label>
                <Input id="first_name_kana" name="first_name_kana" defaultValue={student.first_name_kana ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">学年</Label>
                <NativeSelect id="grade" name="grade" defaultValue={student.grade ?? ""}>
                  <option value="">未選択</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="school_id">学校</Label>
                <NativeSelect id="school_id" name="school_id" defaultValue={student.school_id ?? ""}>
                  <option value="">未選択</option>
                  {schools.map((school) => (
                    <option key={school.school_id} value={school.school_id}>
                      {school.school_name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date">生年月日</Label>
                <Input id="birth_date" name="birth_date" type="date" defaultValue={student.birth_date ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">性別</Label>
                <Input id="gender" name="gender" defaultValue={student.gender ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" name="phone" defaultValue={student.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メール</Label>
                <Input id="email" name="email" type="email" defaultValue={student.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">状態</Label>
                <NativeSelect id="status" name="status" defaultValue={student.status}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="graduated">graduated</option>
                </NativeSelect>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">メモ</Label>
                <Textarea id="notes" name="notes" defaultValue={student.notes ?? ""} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">保存</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>保護者</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {guardians.length > 0 ? (
                <div className="space-y-3">
                  {guardians.map((guardian) => (
                    <div key={guardian.guardian_id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{fullName(guardian)}</div>
                        {guardian.is_primary ? <Badge>主連絡先</Badge> : null}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{guardian.relationship}</div>
                      <div className="mt-2 grid gap-1 text-sm">
                        <span>{emptyText(guardian.phone)}</span>
                        <span>{emptyText(guardian.email)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>保護者情報がありません。</EmptyState>
              )}
              <form action={addGuardian} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="student_id" value={student.student_id} />
                <div className="space-y-2">
                  <Label htmlFor="guardian_last_name">姓</Label>
                  <Input id="guardian_last_name" name="guardian_last_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian_first_name">名</Label>
                  <Input id="guardian_first_name" name="guardian_first_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship">続柄</Label>
                  <Input id="relationship" name="relationship" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian_phone">電話</Label>
                  <Input id="guardian_phone" name="guardian_phone" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="guardian_email">メール</Label>
                  <Input id="guardian_email" name="guardian_email" type="email" />
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input name="is_primary" type="checkbox" className="h-4 w-4" />
                  主連絡先にする
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary">
                    <UserRoundPlus className="h-4 w-4" />
                    保護者を追加
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>緊急連絡先</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contacts.length > 0 ? (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.emergency_contact_id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{contact.name}</div>
                        <Badge>優先{contact.priority}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{emptyText(contact.relationship)}</div>
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {contact.phone}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>緊急連絡先がありません。</EmptyState>
              )}
              <form action={addEmergencyContact} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="student_id" value={student.student_id} />
                <div className="space-y-2">
                  <Label htmlFor="contact_name">氏名</Label>
                  <Input id="contact_name" name="contact_name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_relationship">続柄</Label>
                  <Input id="contact_relationship" name="contact_relationship" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">電話</Label>
                  <Input id="contact_phone" name="contact_phone" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">優先順位</Label>
                  <Input id="priority" name="priority" type="number" min="1" defaultValue="1" />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary">
                    連絡先を追加
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>受講コース</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrollments.length > 0 ? (
              <Table>
                <TableHeader>
                    <TableRow>
                      <TableHead>コース</TableHead>
                      <TableHead>曜日</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead>開始日</TableHead>
                      <TableHead>終了日</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.enrollment_id}>
                      <TableCell>{one(enrollment.courses)?.course_name ?? "-"}</TableCell>
                      <TableCell>
                        <form id={`enrollment-${enrollment.enrollment_id}`} action={updateEnrollmentSchedule}>
                          <input type="hidden" name="enrollment_id" value={enrollment.enrollment_id} />
                          <input type="hidden" name="student_id" value={student.student_id} />
                          <NativeSelect name="weekday" defaultValue={enrollment.weekday ?? ""} className="h-9 min-w-[88px]">
                            <option value="">未設定</option>
                            {weekdayOptions.map((weekday) => (
                              <option key={weekday} value={weekday}>
                                {weekday}
                              </option>
                            ))}
                          </NativeSelect>
                        </form>
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          form={`enrollment-${enrollment.enrollment_id}`}
                          name="enrollment_start_time"
                          defaultValue={formatTime(enrollment.start_time) === "-" ? "" : formatTime(enrollment.start_time)}
                          className="h-9 min-w-[100px]"
                        >
                          <option value="">未設定</option>
                          {lessonStartTimeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </NativeSelect>
                      </TableCell>
                      <TableCell>{formatDate(enrollment.start_date)}</TableCell>
                      <TableCell>{formatDate(enrollment.end_date)}</TableCell>
                      <TableCell>
                        <NativeSelect
                          form={`enrollment-${enrollment.enrollment_id}`}
                          name="enrollment_status"
                          defaultValue={enrollment.status}
                          className="h-9 min-w-[120px]"
                        >
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="completed">completed</option>
                        </NativeSelect>
                        <input
                          form={`enrollment-${enrollment.enrollment_id}`}
                          type="hidden"
                          name="schedule_label"
                          value={enrollment.schedule_label ?? ""}
                        />
                        <input
                          form={`enrollment-${enrollment.enrollment_id}`}
                          type="hidden"
                          name="frequency"
                          value={enrollment.frequency ?? ""}
                        />
                      </TableCell>
                      <TableCell>
                        <Button form={`enrollment-${enrollment.enrollment_id}`} type="submit" size="sm" variant="secondary">
                          保存
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>受講コースがありません。</EmptyState>
            )}
            <form action={addEnrollment} className="grid gap-3 md:grid-cols-[1fr_120px_140px_160px_160px_auto]">
              <input type="hidden" name="student_id" value={student.student_id} />
              <NativeSelect name="course_id" required>
                <option value="">コースを選択</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {course.course_name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="weekday" defaultValue="">
                <option value="">曜日</option>
                {weekdayOptions.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {weekday}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="enrollment_start_time" defaultValue="">
                <option value="">時間</option>
                {lessonStartTimeOptions.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </NativeSelect>
              <Input name="start_date" type="date" aria-label="開始日" />
              <Input name="end_date" type="date" aria-label="終了日" />
              <NativeSelect name="enrollment_status" defaultValue="active">
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </NativeSelect>
              <Button type="submit" variant="secondary">
                追加
              </Button>
              <input type="hidden" name="schedule_label" value="" />
              <input type="hidden" name="frequency" value="" />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>授業履歴</CardTitle>
            <CardDescription>
              {visibleLessonRecords.length}件 / {lessonRecordSortOptions.find((option) => option.value === lessonSort)?.label}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-[160px_220px_auto]">
              <NativeSelect name="lesson_year" defaultValue={resolvedSearchParams.lesson_year ?? ""} aria-label="年">
                <option value="">すべての年</option>
                {lessonYears.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="lesson_sort" defaultValue={lessonSort} aria-label="並び替え">
                {lessonRecordSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit" variant="secondary">
                表示
              </Button>
            </form>
            {visibleLessonRecords.length > 0 ? (
              <Table className="min-w-[900px] table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[112px]">日付</TableHead>
                    <TableHead className="w-[72px]">時間</TableHead>
                    <TableHead className="w-[130px]">コース</TableHead>
                    <TableHead className="w-[220px]">タイトル</TableHead>
                    <TableHead>内容</TableHead>
                    <TableHead className="w-[220px]">宿題</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLessonRecords.map((record) => (
                    <TableRow key={record.lesson_record_id}>
                      <TableCell className="whitespace-nowrap py-2 align-top">{formatDate(record.lesson_date)}</TableCell>
                      <TableCell className="whitespace-nowrap py-2 align-top">{formatTime(record.start_time)}</TableCell>
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

        <Card id="new-lesson-record">
          <CardHeader>
            <CardTitle>授業記録を追加</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addLessonRecord} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="student_id" value={student.student_id} />
              <div className="space-y-2">
                <Label htmlFor="lesson_date">授業日</Label>
                <Input id="lesson_date" name="lesson_date" type="date" required />
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
                <Button type="submit">授業記録を追加</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
