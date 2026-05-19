import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronDown, Circle, Clock3 } from "lucide-react";

import { addScheduledLessonRecord, saveDraftLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import type { LessonRecordsStudentSearchOption } from "@/components/lesson-records-student-search";

import { CopyPrevRecordButton } from "./copy-prev-record-button";
import { LessonRecordsNewStudentPickPanel } from "./lesson-records-new-student-pick-panel";
import { LessonRecordFormFields } from "@/components/lesson-record-content-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName } from "@/lib/courses";
import { dedupeEnrollmentsByStudentCourseTime } from "@/lib/enrollments";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { lessonTimeSelectOptions } from "@/lib/lesson-times";
import {
  buildLessonRecordsNewPath,
  lessonRecordsNewHrefFromFields,
  type LessonRecordsNewNavFields
} from "@/lib/lesson-records-new-url";
import { one } from "@/lib/relations";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, LessonRecord, Staff } from "@/lib/types";
import {
  parseWeekday,
  resolveIsoDateParam,
  shiftDateToNearestWeekday,
  weekdayFromDate,
  weekdayOptions
} from "@/lib/weekdays";

const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-500",
  Roblox: "bg-emerald-500",
  ITオンライン部: "bg-violet-500",
  イラスト: "bg-orange-500"
};

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

export default async function NewLessonRecordPage({
  searchParams
}: {
  searchParams: Promise<{
    weekday?: string;
    enrollment_id?: string;
    date?: string;
    student_id?: string;
    message?: string;
    only_unrecorded?: string;
  }>;
}) {
  const params = await searchParams;
  const selectedDate = resolveIsoDateParam(params.date);
  const lessonWeekday = weekdayFromDate(selectedDate);
  const urlWeekday =
    params.weekday && weekdayOptions.includes(params.weekday) ? params.weekday : null;

  /** 一覧の曜日フィルターと同じく、「記録する日」のカレンダー曜日を正とする */
  if (lessonWeekday && urlWeekday && urlWeekday !== lessonWeekday) {
    redirect(
      lessonRecordsNewHrefFromFields({
        weekday: lessonWeekday,
        date: selectedDate,
        enrollmentId: params.enrollment_id || undefined
      })
    );
  }

  const weekday = lessonWeekday ?? parseWeekday(params.weekday);
  const selectedEnrollmentId = params.enrollment_id ?? "";

  function navHref(overrides: Partial<LessonRecordsNewNavFields>): string {
    return lessonRecordsNewHrefFromFields({
      weekday,
      date: selectedDate,
      enrollmentId: selectedEnrollmentId || undefined,
      studentId: undefined,
      ...overrides
    });
  }
  const supabase = await createClient();

  const [
    enrollmentsResult,
    lessonRecordsResult,
    studentsResult,
    {
      data: { user }
    }
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "enrollment_id,student_id,course_id,schedule_label,weekday,start_time,frequency,status,students(student_id,last_name,first_name,grade),courses(course_id,course_name)"
      )
      .eq("status", "active")
      .order("start_time", { ascending: true, nullsFirst: false }),
    supabase
      .from("lesson_records")
      .select(
        "lesson_record_id,student_id,course_id,lesson_date,attendance_status,title,content,homework,students(student_id,last_name,first_name),courses(course_id,course_name)"
      )
      .order("lesson_date", { ascending: false })
      .order("start_time", { ascending: false, nullsFirst: false })
      .limit(2000),
    supabase
      .from("students")
      .select("student_id,last_name,first_name,last_name_kana,first_name_kana,grade")
      .order("last_name_kana", { ascending: true, nullsFirst: false }),
    supabase.auth.getUser()
  ]);

  const students = (studentsResult.data ?? []) as LessonRecordsStudentSearchOption[];

  const staffResult = user
    ? await supabase
        .from("staff")
        .select("staff_id,name,email,role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const allRecords = (lessonRecordsResult.data ?? []) as unknown as LessonRecord[];

  /** 受講ごとに「最新の記録」の曜日（lesson_records は lesson_date 降順で取得済み） */
  const latestLessonWeekdayByStudentCourse = new Map<string, string>();
  for (const record of allRecords) {
    const key = `${record.student_id}:${record.course_id ?? ""}`;
    if (!latestLessonWeekdayByStudentCourse.has(key)) {
      const latestWeekday = weekdayFromDate(record.lesson_date);
      if (latestWeekday) latestLessonWeekdayByStudentCourse.set(key, latestWeekday);
    }
  }

  const allEnrollments = dedupeEnrollmentsByStudentCourseTime(
    (enrollmentsResult.data ?? []) as Enrollment[]
  );
  /** 曜日タブに載せる受講: 直近の記録の曜日を優先。記録が無い受講は enrollments.weekday */
  const weekdayPoolEnrollments = allEnrollments.filter((e) => {
    const prevWeekday = latestLessonWeekdayByStudentCourse.get(`${e.student_id}:${e.course_id}`);
    const bucketWeekday = prevWeekday ?? e.weekday;
    return bucketWeekday === weekday;
  });

  const onlyUnrecorded = params.only_unrecorded === "1";

  const recordsOnDate = allRecords.filter((r) => r.lesson_date === selectedDate);

  // 曜日別の未記録件数（曜日タブのバッジ用）
  const weekdayUnrecordedCounts = new Map<string, number>(
    weekdayOptions
      .filter((w) => w !== "日")
      .map((w) => {
        const pool = allEnrollments.filter((e) => {
          const prev = latestLessonWeekdayByStudentCourse.get(`${e.student_id}:${e.course_id}`);
          return (prev ?? e.weekday) === w;
        });
        const fullyRecorded = new Set(
          recordsOnDate
            .filter((r) => r.attendance_status !== null)
            .map((r) => pool.find((e) => e.student_id === r.student_id && e.course_id === r.course_id)?.enrollment_id)
            .filter(Boolean) as string[]
        );
        return [w, pool.filter((e) => !fullyRecorded.has(e.enrollment_id)).length] as [string, number];
      })
  );

  if (params.student_id && !selectedEnrollmentId) {
    const matches = allEnrollments.filter((e) => e.student_id === params.student_id);
    if (matches.length === 1) {
      redirect(
        lessonRecordsNewHrefFromFields({
          weekday,
          date: selectedDate,
          enrollmentId: matches[0].enrollment_id
        })
      );
    }
  }

  const recordedEnrollmentIds = new Set(
    recordsOnDate
      .map((r) => {
        const match = weekdayPoolEnrollments.find(
          (e) => e.student_id === r.student_id && e.course_id === r.course_id
        );
        return match?.enrollment_id ?? null;
      })
      .filter(Boolean) as string[]
  );

  const draftEnrollmentIds = new Set(
    recordsOnDate
      .filter((r) => r.attendance_status === null)
      .map((r) => {
        const match = weekdayPoolEnrollments.find(
          (e) => e.student_id === r.student_id && e.course_id === r.course_id
        );
        return match?.enrollment_id ?? null;
      })
      .filter(Boolean) as string[]
  );

  const currentStaff = staffResult.data as Staff | null;
  const recorderName =
    currentStaff?.name ??
    (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
    user?.email ??
    "ログイン中の職員";

  const selectedEnrollment =
    weekdayPoolEnrollments.find((e) => e.enrollment_id === selectedEnrollmentId) ??
    allEnrollments.find((e) => e.enrollment_id === selectedEnrollmentId);
  const hasOpenRecordForm = Boolean(selectedEnrollment);

  const prevRecord = selectedEnrollment
    ? allRecords.find(
        (r) =>
          r.student_id === selectedEnrollment.student_id &&
          r.course_id === selectedEnrollment.course_id &&
          r.lesson_date !== selectedDate
      ) ?? null
    : null;

  const recentRecords = allRecords.slice(0, 8);

  const recordedCount = recordedEnrollmentIds.size - draftEnrollmentIds.size;
  const totalToday = weekdayPoolEnrollments.length;

  const displayEnrollments = onlyUnrecorded
    ? weekdayPoolEnrollments.filter((e) => !recordedEnrollmentIds.has(e.enrollment_id) || draftEnrollmentIds.has(e.enrollment_id))
    : weekdayPoolEnrollments;

  const unrecordedCount = weekdayPoolEnrollments.length - recordedCount;

  const migrationRequired =
    Boolean(enrollmentsResult.error) &&
    enrollmentsResult.error?.message.toLowerCase().includes("weekday");

  return (
    <AppShell>
      <FlashToast message={params.message} />
      <div className="space-y-6">
        {/* ヘッダー：曜日 + 日付 + 進捗 */}
        <header className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">授業記録</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(selectedDate)} ・ {weekday}曜日 ・ 進捗 {recordedCount}/{totalToday}
              </p>
            </div>
            <form className="flex items-center gap-2" action="/lesson-records/new" method="get">
              <input type="hidden" name="weekday" value={weekday} />
              {selectedEnrollmentId && (
                <input type="hidden" name="enrollment_id" value={selectedEnrollmentId} />
              )}
              <Input
                name="date"
                type="date"
                defaultValue={selectedDate}
                className="h-8 w-auto text-sm"
              />
              <Button type="submit" size="sm" variant="ghost" className="h-8">
                移動
              </Button>
            </form>
          </div>

          {/* 曜日タブ */}
          <nav className="flex gap-1 border-b">
            {weekdayOptions.filter((w) => w !== "日").map((w) => {
              const isActive = w === weekday;
              const tabDate = shiftDateToNearestWeekday(selectedDate, w);
              const tabUnrecorded = weekdayUnrecordedCounts.get(w) ?? 0;
              return (
                <Link
                  key={w}
                  href={lessonRecordsNewHrefFromFields({
                    weekday: w,
                    date: tabDate,
                    enrollmentId: selectedEnrollmentId || undefined
                  })}
                  className={`relative flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w}
                  {tabUnrecorded > 0 && (
                    <span className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] leading-none ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {tabUnrecorded}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </header>

        {migrationRequired && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            曜日データの追加が必要です。Supabase SQL Editor で{" "}
            <code>supabase/add_enrollment_schedule.sql</code> を実行してください。
          </div>
        )}

        {/* メイン：左リスト + 右フォーム */}
        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          {/* 生徒リスト */}
          <aside
            className={cn(
              "space-y-3 xl:sticky xl:top-5 xl:self-start",
              "xl:order-1",
              hasOpenRecordForm ? "max-xl:order-2" : "max-xl:order-1"
            )}
          >
            <LessonRecordsNewStudentPickPanel
              key={selectedEnrollmentId || `pick-${weekday}-${selectedDate}`}
              students={students}
              allEnrollments={allEnrollments}
              weekday={weekday}
              selectedDate={selectedDate}
              urlStudentId={params.student_id ?? ""}
              selectedEnrollmentId={selectedEnrollmentId}
            />

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium uppercase tracking-wider text-muted-foreground">
                {weekday}曜 · {totalToday}人
              </span>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {recordedCount}
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3 text-amber-500" />
                  {draftEnrollmentIds.size}
                </span>
                <Link
                  href={buildLessonRecordsNewPath(
                    { weekday, date: selectedDate, enrollment_id: selectedEnrollmentId || undefined },
                    { only_unrecorded: onlyUnrecorded ? undefined : "1" }
                  )}
                  className={`rounded px-1.5 py-0.5 transition-colors ${
                    onlyUnrecorded
                      ? "bg-primary/10 font-semibold text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <Circle className="mr-0.5 inline h-3 w-3 text-muted-foreground/70" />
                  {unrecordedCount}
                </Link>
              </div>
            </div>

            {unrecordedCount === 0 && !onlyUnrecorded ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
                全員分の記録が完了しています ✓
              </div>
            ) : null}

            {displayEnrollments.length > 0 ? (
              <div className="grid max-h-[calc(100svh-220px)] gap-1 overflow-y-auto pr-1">
                {displayEnrollments.map((enrollment) => {
                  const student = one(enrollment.students);
                  const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
                  const dotColor = COURSE_DOT[courseName] ?? "bg-gray-300";
                  const isSelected = enrollment.enrollment_id === selectedEnrollmentId;
                  const isDraft = draftEnrollmentIds.has(enrollment.enrollment_id);
                  const isRecorded =
                    recordedEnrollmentIds.has(enrollment.enrollment_id) && !isDraft;

                  return (
                    <Link
                      key={enrollment.enrollment_id}
                      href={navHref({
                        enrollmentId: enrollment.enrollment_id
                      })}
                      className={`group flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
                        isSelected
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-tight">
                          {student ? fullName(student) : "-"}
                          {student?.grade && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {formatGrade(student.grade)}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {courseName || "-"} ・ {formatTime(enrollment.start_time)}
                        </div>
                      </div>
                      {isRecorded ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : isDraft ? (
                        <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState>
                <>
                  {weekday}曜日の受講予定がありません。
                  {allEnrollments.length > 0 && (
                    <>
                      {" "}
                      <span className="text-muted-foreground">
                        生徒検索から選ぶと、この曜日に載らない受講でも記録できます。
                      </span>
                    </>
                  )}
                </>
              </EmptyState>
            )}
          </aside>

          {/* 記録フォーム */}
          <section
            id="record-form"
            className={cn(
              "min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)] xl:overflow-y-auto xl:self-start",
              "xl:order-2",
              hasOpenRecordForm ? "max-xl:order-1" : "max-xl:order-2"
            )}
          >
            {!selectedEnrollment ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground">生徒を選んでください</p>
                <p className="mt-2 text-xs leading-relaxed">
                  左の<strong className="text-foreground">生徒検索</strong>
                  または
                  <strong className="text-foreground">一覧</strong>
                  から選ぶと、ここに記録フォームが開きます（狭い画面ではフォームが上に表示されます）。
                </p>
              </div>
            ) : (
              <form
                key={selectedEnrollmentId}
                action={addScheduledLessonRecord}
                data-lesson-record-form
                className="space-y-6"
              >
                <input type="hidden" name="enrollment_id" value={selectedEnrollmentId} />
                <input type="hidden" name="lesson_date" value={selectedDate} />

                {/* 生徒ヘッダー */}
                <div className="flex flex-wrap items-baseline gap-3 border-b pb-4">
                  <h2 className="text-lg font-semibold">
                    {fullName(one(selectedEnrollment.students)!)}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {normalizeCourseName(one(selectedEnrollment.courses)?.course_name)}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(selectedDate)}
                  </span>
                </div>

                {/* 前回の記録 */}
                {prevRecord && (
                  <details data-prev-record className="group rounded-md border bg-muted/30">
                    <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      前回の記録
                      <span className="text-xs font-normal text-muted-foreground/70">
                        {formatDate(prevRecord.lesson_date)}
                      </span>
                      {prevRecord.attendance_status && (
                        <span
                          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                            ATTENDANCE_COLORS[prevRecord.attendance_status] ?? ""
                          }`}
                        >
                          {ATTENDANCE_LABELS[prevRecord.attendance_status]}
                        </span>
                      )}
                    </summary>
                    <div className="space-y-2 border-t px-4 py-3 text-sm">
                      {prevRecord.title && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            目的：
                          </span>
                          {prevRecord.title}
                        </div>
                      )}
                      {prevRecord.content && (
                        <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {prevRecord.content}
                        </div>
                      )}
                      {prevRecord.homework && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground">
                            次回予定：
                          </span>
                          <span className="text-xs">{prevRecord.homework}</span>
                        </div>
                      )}
                      <div className="flex justify-end border-t pt-2">
                        <CopyPrevRecordButton
                          title={prevRecord.title}
                          content={prevRecord.content}
                          homework={prevRecord.homework}
                          memo={prevRecord.memo}
                        />
                      </div>
                    </div>
                  </details>
                )}

                {/* 必須項目（出欠・時間） */}
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="attendance_status" className="text-sm font-medium">
                      出欠
                    </Label>
                    <NativeSelect
                      id="attendance_status"
                      name="attendance_status"
                      defaultValue=""
                    >
                      <option value="">未設定</option>
                      <option value="present">出席</option>
                      <option value="absent">欠席</option>
                      <option value="late">遅刻</option>
                      <option value="substitute">振替</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="start_time" className="text-sm font-medium">
                      開始
                    </Label>
                    <NativeSelect
                      id="start_time"
                      name="start_time"
                      defaultValue={
                        formatTime(selectedEnrollment.start_time) === "-"
                          ? ""
                          : formatTime(selectedEnrollment.start_time)
                      }
                    >
                      <option value="">未設定</option>
                      {lessonTimeSelectOptions(
                        formatTime(selectedEnrollment.start_time) === "-"
                          ? undefined
                          : formatTime(selectedEnrollment.start_time)
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_time" className="text-sm font-medium">
                      終了
                    </Label>
                    <NativeSelect id="end_time" name="end_time" defaultValue="">
                      <option value="">未設定</option>
                      {lessonTimeSelectOptions(undefined).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                <LessonRecordFormFields />

                {/* 送信ボタン */}
                <div className="flex flex-wrap items-center gap-2 border-t pt-5">
                  <Button type="submit" className="min-w-32">
                    記録を登録
                  </Button>

                  <Button
                    type="submit"
                    formAction={saveDraftLessonRecord}
                    variant="outline"
                  >
                    下書き保存
                  </Button>

                  <span className="ml-auto text-xs text-muted-foreground">
                    記録者：{recorderName}
                  </span>
                </div>
              </form>
            )}
          </section>
        </div>

        {/* 直近の記録 */}
        {recentRecords.length > 0 && (
          <section className="space-y-3 border-t pt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                直近の記録
              </h2>
              <Link
                href="/lesson-records"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                すべて見る →
              </Link>
            </div>
            <div className="divide-y rounded-md border">
              {recentRecords.map((record) => {
                const student = record.students;
                const courseName = normalizeCourseName(record.courses?.course_name);
                const dotColor = COURSE_DOT[courseName] ?? "bg-gray-300";
                return (
                  <Link
                    key={record.lesson_record_id}
                    href={`/lesson-records/${record.lesson_record_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">
                      {formatDate(record.lesson_date)}
                    </span>
                    <span className="w-32 shrink-0 truncate font-medium">
                      {student ? fullName(student) : "-"}
                    </span>
                    <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                      {courseName || "-"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {record.title || "（目的未記入）"}
                    </span>
                    {record.attendance_status ? (
                      <span
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                          ATTENDANCE_COLORS[record.attendance_status] ?? ""
                        }`}
                      >
                        {ATTENDANCE_LABELS[record.attendance_status]}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        <Clock3 className="h-3 w-3" />
                        下書き
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
