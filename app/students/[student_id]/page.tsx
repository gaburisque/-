import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardPlus, Download, ExternalLink, Phone, UserRoundPlus } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import { formatGrade, formatGradeOrAge, gradeOptions, normalizeGrade } from "@/lib/grades";
import { isCurrentUserAdmin } from "@/lib/authz";
import {
  lessonRecordSortOptions,
  parseLessonRecordSort,
  sortLessonRecords
} from "@/lib/lesson-records";
import { lessonStartTimeOptions } from "@/lib/lesson-times";
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
import { FlashToast } from "@/components/flash-toast";

const HISTORY_ATTENDANCE_LABELS: Record<string, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  substitute: "振替"
};

const HISTORY_ATTENDANCE_BADGE: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  absent: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  late: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  substitute: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
};

function historyCourseDot(courseName: string) {
  if (courseName === "Scratch") return "bg-blue-400";
  if (courseName === "Roblox") return "bg-green-500";
  if (courseName === "ITオンライン部") return "bg-purple-500";
  if (courseName === "イラスト") return "bg-orange-400";
  return "bg-gray-300";
}

export default async function StudentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ student_id: string }>;
  searchParams: Promise<{ lesson_year?: string; lesson_sort?: string; message?: string }>;
}) {
  const { student_id: studentId } = await params;
  const resolvedSearchParams = await searchParams;
  const lessonSort = parseLessonRecordSort(resolvedSearchParams.lesson_sort);
  const supabase = await createClient();
  const isOwner = await isCurrentUserAdmin();

  const emptySchools = Promise.resolve({ data: [] as School[] });
  const emptyGuardians = Promise.resolve({ data: [] as Guardian[] });
  const emptyContacts = Promise.resolve({ data: [] as EmergencyContact[] });

  const [
    studentResult,
    schoolsResult,
    guardiansResult,
    contactsResult,
    enrollmentsResult,
    lessonRecordsResult,
    coursesResult,
    changeHistoryResult
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*,schools(school_id,school_name,school_type)")
      .eq("student_id", studentId)
      .single(),
    isOwner
      ? supabase.from("schools").select("school_id,school_name,school_type").order("school_name")
      : emptySchools,
    isOwner
      ? supabase
          .from("guardians")
          .select("*")
          .eq("student_id", studentId)
          .order("is_primary", { ascending: false })
      : emptyGuardians,
    isOwner
      ? supabase
          .from("emergency_contacts")
          .select("*")
          .eq("student_id", studentId)
          .order("priority", { ascending: true })
      : emptyContacts,
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
    supabase.from("courses").select("*").eq("status", "active").order("course_name"),
    isOwner
      ? supabase
          .from("student_change_history")
          .select("*")
          .eq("student_id", studentId)
          .order("changed_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] })
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
  const changeHistory = (changeHistoryResult.data ?? []) as { id: string; changed_at: string; field_name: string; old_value: string | null; new_value: string | null }[];
  const lessonYears = Array.from(
    new Set(
      lessonRecords
        .map((record) => record.lesson_date?.slice(0, 4))
        .filter((year): year is string => Boolean(year))
    )
  ).sort((a, b) => b.localeCompare(a));
  const visibleLessonRecords = sortLessonRecords(
    resolvedSearchParams.lesson_year
      ? lessonRecords.filter((record) =>
          record.lesson_date?.startsWith(resolvedSearchParams.lesson_year ?? "")
        )
      : lessonRecords,
    lessonSort
  );
  const courses = uniqueCoursesByCanonicalName((coursesResult.data ?? []) as Course[]);

  const lastLessonByCourse = lessonRecords.reduce<Record<string, string>>((acc, r) => {
    if (r.course_id && r.lesson_date) {
      if (!acc[r.course_id] || r.lesson_date > acc[r.course_id]) {
        acc[r.course_id] = r.lesson_date;
      }
    }
    return acc;
  }, {});

  const gradeLine =
    formatGradeOrAge(student.grade, student.birth_date) === "-"
      ? "学年未設定"
      : formatGradeOrAge(student.grade, student.birth_date);

  return (
    <AppShell>
      <FlashToast message={resolvedSearchParams.message} />
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="rounded-xl border border-border/80 bg-gradient-to-br from-muted/30 via-background to-background px-5 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Link href="/students" className="text-xs font-medium text-primary hover:underline">
                生徒一覧へ戻る
              </Link>
              <h1 className="text-2xl font-semibold tracking-tight">{fullName(student)}</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground/90">{gradeLine}</span>
                {isOwner ? (
                  <>
                    {" "}
                    · {one(student.schools)?.school_name ?? "学校未設定"}
                  </>
                ) : (
                  <span className="block pt-0.5 text-xs font-normal text-muted-foreground">
                    学校・連絡先などはオーナーのみ表示されます
                  </span>
                )}
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`/lesson-records/new?student_id=${student.student_id}`}>
                <ClipboardPlus className="h-4 w-4" />
                授業記録を入力
              </Link>
            </Button>
          </div>
        </section>

        {isOwner ? (
          <>
            <Card className="shadow-sm">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="text-lg">基本情報</CardTitle>
                <CardDescription>オーナーのみ閲覧・編集できます。</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
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
              <Card className="shadow-sm">
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <CardTitle className="text-lg">保護者</CardTitle>
                  <CardDescription>オーナーのみ表示・追加できます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {guardians.length > 0 ? (
                    <div className="space-y-3">
                      {guardians.map((guardian) => (
                        <div key={guardian.guardian_id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{fullName(guardian)}</div>
                            {guardian.is_primary ? <Badge>主連絡先</Badge> : null}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">{guardian.relationship}</div>
                          <div className="mt-3 grid gap-1 text-sm">
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

              <Card className="shadow-sm">
                <CardHeader className="border-b bg-muted/20 pb-4">
                  <CardTitle className="text-lg">緊急連絡先</CardTitle>
                  <CardDescription>オーナーのみ表示・追加できます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {contacts.length > 0 ? (
                    <div className="space-y-3">
                      {contacts.map((contact) => (
                        <div key={contact.emergency_contact_id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">{contact.name}</div>
                            <Badge className="bg-muted font-normal">優先{contact.priority}</Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">{emptyText(contact.relationship)}</div>
                          <div className="mt-3 flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
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
          </>
        ) : null}

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="text-lg">受講コース</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              曜日・時間を変更して保存すると、次回の授業記録入力から新しいグループに移動します。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {enrollments.length > 0 ? (
              <div className="space-y-4">
                {enrollments.map((enrollment) => {
                  const courseName = normalizeCourseName(one(enrollment.courses)?.course_name) || "-";
                  const lastLesson = enrollment.course_id ? lastLessonByCourse[enrollment.course_id] : null;
                  const currentTime = formatTime(enrollment.start_time);
                  const statusLabel =
                    enrollment.status === "active"
                      ? "受講中"
                      : enrollment.status === "paused"
                        ? "休会中"
                        : "修了";
                  const statusColor =
                    enrollment.status === "active"
                      ? "bg-green-100 text-green-800"
                      : enrollment.status === "paused"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-muted text-muted-foreground";
                  const dotColor =
                    courseName === "Scratch"
                      ? "bg-blue-400"
                      : courseName === "Roblox"
                        ? "bg-green-500"
                        : courseName === "ITオンライン部"
                          ? "bg-purple-500"
                          : courseName === "イラスト"
                            ? "bg-orange-400"
                            : "bg-gray-300";

                  return (
                    <div key={enrollment.enrollment_id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                          <span className="font-medium">{courseName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                          <DeleteEnrollmentButton
                            enrollmentId={enrollment.enrollment_id}
                            studentId={student.student_id}
                            courseName={courseName}
                          />
                        </div>
                      </div>

                      <form
                        action={updateEnrollmentSchedule}
                        className="mt-4 grid gap-2 sm:grid-cols-[110px_110px_120px_auto]"
                      >
                        <input type="hidden" name="enrollment_id" value={enrollment.enrollment_id} />
                        <input type="hidden" name="student_id" value={student.student_id} />
                        <input type="hidden" name="schedule_label" value={enrollment.schedule_label ?? ""} />
                        <input type="hidden" name="frequency" value={enrollment.frequency ?? ""} />

                        <NativeSelect name="weekday" defaultValue={enrollment.weekday ?? ""} aria-label="曜日">
                          <option value="">曜日未設定</option>
                          {weekdayOptions.map((weekday) => (
                            <option key={weekday} value={weekday}>
                              {weekday}曜日
                            </option>
                          ))}
                        </NativeSelect>

                        <NativeSelect
                          name="enrollment_start_time"
                          defaultValue={currentTime === "-" ? "" : currentTime}
                          aria-label="開始時間"
                        >
                          <option value="">時間未設定</option>
                          {lessonStartTimeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
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

                      {lastLesson ? (
                        <p className="mt-3 text-xs text-muted-foreground">直近の授業: {formatDate(lastLesson)}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState>受講コースがありません。</EmptyState>
            )}

            <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">コースを追加</p>
              <form action={addEnrollment} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto]">
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
                    <option key={weekday} value={weekday}>
                      {weekday}曜日
                    </option>
                  ))}
                </NativeSelect>

                <NativeSelect name="enrollment_start_time" defaultValue="" aria-label="時間">
                  <option value="">時間</option>
                  {lessonStartTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </NativeSelect>

                <Button type="submit" variant="secondary" size="sm" className="w-full sm:w-auto">
                  追加
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">授業履歴</CardTitle>
                <CardDescription className="mt-1.5 text-xs leading-relaxed">
                  全{lessonRecords.length}件
                  {resolvedSearchParams.lesson_year
                    ? ` · ${resolvedSearchParams.lesson_year}年：${visibleLessonRecords.length}件`
                    : ""}
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
          <CardContent className="space-y-4 pt-6">
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
              <ul className="space-y-3">
                {visibleLessonRecords.map((record) => {
                  const courseName = normalizeCourseName(record.courses?.course_name) || "—";
                  const detailHref = `/lesson-records/${record.lesson_record_id}`;
                  const titleText =
                    emptyText(record.title) === "-" ? "（目的未記入）" : emptyText(record.title);

                  return (
                    <li
                      key={record.lesson_record_id}
                      className="group relative rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/25"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                          <div className="flex shrink-0 flex-col gap-0.5 border-r border-border/70 pr-3">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              {formatDate(record.lesson_date).replace(/\//g, "/\u200b")}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {formatTime(record.start_time)}
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {record.attendance_status ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  HISTORY_ATTENDANCE_BADGE[record.attendance_status] ??
                                  "bg-muted text-muted-foreground"
                                }`}
                              >
                                {HISTORY_ATTENDANCE_LABELS[record.attendance_status] ??
                                  record.attendance_status}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">下書き</span>
                            )}
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${historyCourseDot(courseName)}`}
                                aria-hidden
                              />
                              {courseName}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                            <Link href={detailHref}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              詳細
                            </Link>
                          </Button>
                          <div className="opacity-0 transition-opacity group-hover:opacity-100">
                            <DeleteLessonRecordButton
                              lessonRecordId={record.lesson_record_id}
                              studentId={student.student_id}
                              redirectTo={`/students/${student.student_id}`}
                              variant="ghost"
                              size="icon"
                              label=""
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 pl-0 sm:pl-[calc(5.5rem+0.75rem)]">
                        <Link href={detailHref} className="block font-medium leading-snug text-foreground hover:text-primary">
                          {titleText}
                        </Link>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {previewText(record.content, 220)}
                        </p>
                        {emptyText(record.homework) !== "-" ? (
                          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground/80">宿題・次回</span>
                            <br />
                            {previewText(record.homework, 160)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState>授業記録がありません。</EmptyState>
            )}
          </CardContent>
        </Card>

        {isOwner && changeHistory.length > 0 ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本情報の変更履歴</CardTitle>
            </CardHeader>
            <CardContent>
              <details>
                <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
                  直近 {changeHistory.length} 件を表示
                </summary>
                <div className="mt-3 space-y-1 text-xs">
                  {changeHistory.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/50">
                      <span className="shrink-0 text-muted-foreground/70">
                        {new Date(h.changed_at).toLocaleString("ja-JP")}
                      </span>
                      <span className="font-medium">{h.field_name}</span>
                      <span className="text-muted-foreground">{h.old_value || "—"}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{h.new_value || "—"}</span>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>
        ) : null}

        {!isOwner ? (
          <Card className="border-dashed bg-muted/15 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">オーナー専用の情報</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                氏名・学年以外の基本情報、保護者、緊急連絡先の閲覧・編集はオーナー（管理者）アカウントのみです。必要な場合はオーナーに依頼してください。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
