import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus, Download, Phone, UserRoundPlus } from "lucide-react";

import {
  addEmergencyContact,
  addEnrollment,
  addGuardian,
  updateEnrollmentSchedule,
  updateStudent
} from "@/app/actions";
import { DeleteEnrollmentButton } from "@/components/delete-enrollment-button";
import { DeleteLessonRecordButton } from "@/components/delete-lesson-record-button";
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
import { formatGrade, formatGradeOrAge, gradeOptions, normalizeGrade } from "@/lib/grades";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
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
  const courses = uniqueCoursesByCanonicalName((coursesResult.data ?? []) as Course[]);

  // コース別の直近授業日（既取得データから計算）
  const lastLessonByCourse = lessonRecords.reduce<Record<string, string>>((acc, r) => {
    if (r.course_id && r.lesson_date) {
      if (!acc[r.course_id] || r.lesson_date > acc[r.course_id]) {
        acc[r.course_id] = r.lesson_date;
      }
    }
    return acc;
  }, {});

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
              {formatGradeOrAge(student.grade, student.birth_date) === "-" ? "学年未設定" : formatGradeOrAge(student.grade, student.birth_date)} /{" "}
              {one(student.schools)?.school_name ?? "学校未設定"}
            </p>
          </div>
          <Button asChild>
            <Link href={`/lesson-records/new?student_id=${student.student_id}`}>
              <ClipboardPlus className="h-4 w-4" />
              授業記録を入力
            </Link>
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
                <NativeSelect id="grade" name="grade" defaultValue={normalizeGrade(student.grade) ?? ""}>
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
            <CardDescription className="text-xs">
              曜日・時間を変更して保存すると、次回の授業記録入力から新しいグループに移動します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {enrollments.length > 0 ? (
              <div className="space-y-3">
                {enrollments.map((enrollment) => {
                  const courseName = normalizeCourseName(one(enrollment.courses)?.course_name) || "-";
                  const lastLesson = enrollment.course_id ? lastLessonByCourse[enrollment.course_id] : null;
                  const currentTime = formatTime(enrollment.start_time);
                  const statusLabel =
                    enrollment.status === "active" ? "受講中" :
                    enrollment.status === "paused" ? "休会中" : "修了";
                  const statusColor =
                    enrollment.status === "active" ? "bg-green-100 text-green-800" :
                    enrollment.status === "paused" ? "bg-yellow-100 text-yellow-800" :
                    "bg-muted text-muted-foreground";
                  const dotColor =
                    courseName === "Scratch" ? "bg-blue-400" :
                    courseName === "Roblox" ? "bg-green-500" :
                    courseName === "ITオンライン部" ? "bg-purple-500" :
                    courseName === "イラスト" ? "bg-orange-400" : "bg-gray-300";

                  return (
                    <div key={enrollment.enrollment_id} className="rounded-lg border p-4 space-y-3">
                      {/* コース名 + ステータス + 削除 */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                          <span className="font-medium">{courseName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                          <DeleteEnrollmentButton
                            enrollmentId={enrollment.enrollment_id}
                            studentId={student.student_id}
                            courseName={courseName}
                          />
                        </div>
                      </div>

                      {/* 編集フォーム */}
                      <form action={updateEnrollmentSchedule} className="grid gap-2 sm:grid-cols-[110px_110px_120px_auto]">
                        <input type="hidden" name="enrollment_id" value={enrollment.enrollment_id} />
                        <input type="hidden" name="student_id" value={student.student_id} />
                        <input type="hidden" name="schedule_label" value={enrollment.schedule_label ?? ""} />
                        <input type="hidden" name="frequency" value={enrollment.frequency ?? ""} />

                        <NativeSelect name="weekday" defaultValue={enrollment.weekday ?? ""} aria-label="曜日">
                          <option value="">曜日未設定</option>
                          {weekdayOptions.map((weekday) => (
                            <option key={weekday} value={weekday}>{weekday}曜日</option>
                          ))}
                        </NativeSelect>

                        <NativeSelect
                          name="enrollment_start_time"
                          defaultValue={currentTime === "-" ? "" : currentTime}
                          aria-label="開始時間"
                        >
                          <option value="">時間未設定</option>
                          {lessonStartTimeOptions.map((time) => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </NativeSelect>

                        <NativeSelect name="enrollment_status" defaultValue={enrollment.status} aria-label="状態">
                          <option value="active">受講中</option>
                          <option value="paused">休会中</option>
                          <option value="completed">修了</option>
                        </NativeSelect>

                        <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto">
                          保存
                        </Button>
                      </form>

                      {/* 直近の授業日 */}
                      {lastLesson && (
                        <p className="text-xs text-muted-foreground">
                          直近の授業: {formatDate(lastLesson)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>受講コースがありません。</EmptyState>
            )}

            {/* 新規追加フォーム */}
            <div className="rounded-lg border border-dashed p-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">コースを追加</p>
              <form action={addEnrollment} className="grid gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
                <input type="hidden" name="student_id" value={student.student_id} />
                <input type="hidden" name="enrollment_status" value="active" />
                <input type="hidden" name="schedule_label" value="" />
                <input type="hidden" name="frequency" value="" />

                <NativeSelect name="course_id" required aria-label="コース">
                  <option value="">コースを選択</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {normalizeCourseName(course.course_name)}
                    </option>
                  ))}
                </NativeSelect>

                <NativeSelect name="weekday" defaultValue="" aria-label="曜日">
                  <option value="">曜日</option>
                  {weekdayOptions.map((weekday) => (
                    <option key={weekday} value={weekday}>{weekday}曜日</option>
                  ))}
                </NativeSelect>

                <NativeSelect name="enrollment_start_time" defaultValue="" aria-label="時間">
                  <option value="">時間</option>
                  {lessonStartTimeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </NativeSelect>

                <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto">
                  追加
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>授業履歴</CardTitle>
                <CardDescription className="mt-1">
                  全{lessonRecords.length}件
                  {resolvedSearchParams.lesson_year ? ` / ${resolvedSearchParams.lesson_year}年：${visibleLessonRecords.length}件` : ""}
                  {" · "}
                  {lessonRecordSortOptions.find((option) => option.value === lessonSort)?.label}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/lesson-records/export?student_id=${student.student_id}`} download>
                  <Download className="h-4 w-4" />
                  CSV出力
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap gap-2">
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
              <Button type="submit" variant="secondary" size="sm">
                表示
              </Button>
            </form>
            {visibleLessonRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">日付</TableHead>
                      <TableHead className="w-[60px]">時間</TableHead>
                      <TableHead className="w-[64px]">出欠</TableHead>
                      <TableHead className="w-[110px]">コース</TableHead>
                      <TableHead className="w-[180px]">タイトル</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead className="w-[170px]">宿題</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleLessonRecords.map((record) => (
                      <TableRow key={record.lesson_record_id} className="group">
                        <TableCell className="whitespace-nowrap py-2 align-top text-sm">
                          {formatDate(record.lesson_date)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 align-top text-xs font-mono text-muted-foreground">
                          {formatTime(record.start_time)}
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          {record.attendance_status ? (
                            <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                              record.attendance_status === "present" ? "bg-green-100 text-green-800" :
                              record.attendance_status === "absent" ? "bg-red-100 text-red-800" :
                              record.attendance_status === "late" ? "bg-yellow-100 text-yellow-800" :
                              "bg-blue-100 text-blue-800"
                            }`}>
                              {record.attendance_status === "present" ? "出席" :
                               record.attendance_status === "absent" ? "欠席" :
                               record.attendance_status === "late" ? "遅刻" : "振替"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <span className={`inline-flex items-center gap-1.5 text-sm`}>
                            <span className={`h-2 w-2 shrink-0 rounded-full ${
                              normalizeCourseName(record.courses?.course_name) === "Scratch" ? "bg-blue-400" :
                              normalizeCourseName(record.courses?.course_name) === "Roblox" ? "bg-green-500" :
                              normalizeCourseName(record.courses?.course_name) === "ITオンライン部" ? "bg-purple-500" :
                              normalizeCourseName(record.courses?.course_name) === "イラスト" ? "bg-orange-400" :
                              "bg-gray-300"
                            }`} />
                            {normalizeCourseName(record.courses?.course_name) || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <Link
                            href={`/lesson-records/${record.lesson_record_id}`}
                            className="line-clamp-2 text-sm font-medium leading-5 text-primary hover:underline"
                            title={emptyText(record.title)}
                          >
                            {emptyText(record.title)}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <Link
                            href={`/lesson-records/${record.lesson_record_id}`}
                            className="line-clamp-2 text-sm leading-5 hover:text-primary"
                            title={emptyText(record.content)}
                          >
                            {previewText(record.content, 100)}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <Link
                            href={`/lesson-records/${record.lesson_record_id}`}
                            className="line-clamp-2 text-sm leading-5 hover:text-primary"
                            title={emptyText(record.homework)}
                          >
                            {previewText(record.homework, 70)}
                          </Link>
                        </TableCell>
                        <TableCell className="py-2 align-top opacity-0 transition-opacity group-hover:opacity-100">
                          <DeleteLessonRecordButton
                            lessonRecordId={record.lesson_record_id}
                            studentId={student.student_id}
                            redirectTo={`/students/${student.student_id}`}
                            variant="ghost"
                            size="icon"
                            label=""
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>授業記録がありません。</EmptyState>
            )}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
