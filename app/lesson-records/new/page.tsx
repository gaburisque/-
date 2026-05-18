import Link from "next/link";
import { ChevronDown, CheckCircle2, Circle, Clock3 } from "lucide-react";

import { addScheduledLessonRecord, saveDraftLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeCourseName } from "@/lib/courses";
import { dedupeEnrollmentsByStudentCourseTime } from "@/lib/enrollments";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, LessonRecord, Staff } from "@/lib/types";
import { parseWeekday, weekdayFromDate, weekdayOptions } from "@/lib/weekdays";

const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-400",
  Roblox: "bg-green-500",
  ITオンライン部: "bg-purple-500",
  イラスト: "bg-orange-400"
};

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

function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t" />
    </div>
  );
}

export default async function NewLessonRecordPage({
  searchParams
}: {
  searchParams: Promise<{ weekday?: string; enrollment_id?: string; date?: string }>;
}) {
  const params = await searchParams;
  const weekday = parseWeekday(params.weekday);
  const selectedEnrollmentId = params.enrollment_id ?? "";
  const selectedDate = params.date ?? today();
  const supabase = await createClient();

  const [
    enrollmentsResult,
    lessonRecordsResult,
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
      .select("lesson_record_id,student_id,course_id,lesson_date,attendance_status,title,content,homework")
      .order("lesson_date", { ascending: false })
      .limit(2000),
    supabase.auth.getUser()
  ]);

  const staffResult = user
    ? await supabase
        .from("staff")
        .select("staff_id,name,email,role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const allRecords = (lessonRecordsResult.data ?? []) as LessonRecord[];

  // 前回記録の曜日で生徒を振り分け
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
  const visibleEnrollments = allEnrollments.filter((e) => {
    const prevWeekday = latestLessonWeekdayByStudentCourse.get(`${e.student_id}:${e.course_id}`);
    return (prevWeekday ?? e.weekday) === weekday;
  });

  // selectedDate に既に記録がある enrollment
  const recordedEnrollmentIds = new Set(
    allRecords
      .filter((r) => r.lesson_date === selectedDate)
      .map((r) => {
        const match = visibleEnrollments.find(
          (e) => e.student_id === r.student_id && e.course_id === r.course_id
        );
        return match?.enrollment_id ?? null;
      })
      .filter(Boolean) as string[]
  );

  // 下書き（attendance_status が null）
  const draftEnrollmentIds = new Set(
    allRecords
      .filter((r) => r.lesson_date === selectedDate && r.attendance_status === null)
      .map((r) => {
        const match = visibleEnrollments.find(
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

  const selectedEnrollment = visibleEnrollments.find(
    (e) => e.enrollment_id === selectedEnrollmentId
  );

  // 選択中生徒の前回記録
  const prevRecord = selectedEnrollment
    ? allRecords.find(
        (r) =>
          r.student_id === selectedEnrollment.student_id &&
          r.course_id === selectedEnrollment.course_id &&
          r.lesson_date !== selectedDate
      ) ?? null
    : null;

  const migrationRequired =
    Boolean(enrollmentsResult.error) &&
    enrollmentsResult.error?.message.toLowerCase().includes("weekday");

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ─── ヘッダー ─── */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">授業記録入力</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              曜日で生徒を絞り込んで記録を登録します
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/lesson-records">記録一覧</Link>
          </Button>
        </div>

        {/* ─── 曜日タブ ─── */}
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {weekdayOptions.filter((w) => w !== "日").map((w) => (
            <Link
              key={w}
              href={`/lesson-records/new?weekday=${encodeURIComponent(w)}&date=${selectedDate}`}
              className={`flex-1 rounded-md py-1.5 text-center text-sm font-medium transition-colors ${
                w === weekday
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w}
            </Link>
          ))}
        </div>

        {/* ─── 日付選択 ─── */}
        <div className="flex items-center gap-3">
          <Label htmlFor="date_selector" className="shrink-0 text-sm">授業日</Label>
          <form className="flex gap-2">
            <input type="hidden" name="weekday" value={weekday} />
            {selectedEnrollmentId && (
              <input type="hidden" name="enrollment_id" value={selectedEnrollmentId} />
            )}
            <Input
              id="date_selector"
              name="date"
              type="date"
              defaultValue={selectedDate}
              className="w-auto"
            />
            <Button type="submit" variant="outline" size="sm">移動</Button>
          </form>
        </div>

        {migrationRequired && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800 text-sm">
                曜日データの追加が必要です。Supabase SQL Editor で{" "}
                <code>supabase/add_enrollment_schedule.sql</code> を実行してください。
              </CardTitle>
            </CardHeader>
          </Card>
        )}

        {/* ─── メインレイアウト ─── */}
        <div className="grid gap-5 xl:grid-cols-[minmax(260px,360px)_1fr]">

          {/* ─── 生徒リスト ─── */}
          <Card className="h-fit xl:sticky xl:top-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{weekday}曜日の生徒</CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {visibleEnrollments.length}人
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {visibleEnrollments.length > 0 ? (
                <div className="grid max-h-[calc(100svh-340px)] gap-1.5 overflow-y-auto pr-0.5">
                  {visibleEnrollments.map((enrollment) => {
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
                        href={`/lesson-records/new?weekday=${encodeURIComponent(weekday)}&enrollment_id=${enrollment.enrollment_id}&date=${selectedDate}#record-form`}
                        className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary hover:bg-primary/5 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "bg-white"
                        }`}
                      >
                        <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 truncate font-medium leading-snug">
                            {student ? fullName(student) : "-"}
                            {student?.grade && (
                              <span className="text-xs font-normal text-muted-foreground">
                                {formatGrade(student.grade)}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {courseName || "-"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            {formatTime(enrollment.start_time)}
                          </span>
                          {isRecorded ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : isDraft ? (
                            <Clock3 className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>{weekday}曜日の受講予定がありません。</EmptyState>
              )}
              {/* 凡例 */}
              <div className="mt-3 flex gap-3 border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />記録済</span>
                <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-amber-400" />下書き</span>
                <span className="flex items-center gap-1"><Circle className="h-3.5 w-3.5 text-muted-foreground/30" />未記録</span>
              </div>
            </CardContent>
          </Card>

          {/* ─── 記録フォーム ─── */}
          <Card id="record-form">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                {selectedEnrollment
                  ? `${fullName(one(selectedEnrollment.students)!)} の記録`
                  : "記録フォーム"}
              </CardTitle>
              {!selectedEnrollment && (
                <p className="text-sm text-muted-foreground">
                  左から生徒を選択すると入力できます。
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ─── 前回の記録（折りたたみ） ─── */}
              {selectedEnrollment && prevRecord && (
                <details className="group rounded-lg border bg-muted/30">
                  <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    前回の記録
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatDate(prevRecord.lesson_date)}
                      {prevRecord.attendance_status && (
                        <span
                          className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                            ATTENDANCE_COLORS[prevRecord.attendance_status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ATTENDANCE_LABELS[prevRecord.attendance_status] ?? prevRecord.attendance_status}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="border-t px-4 pb-4 pt-3 space-y-2 text-sm">
                    {prevRecord.title && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground">目的：</span>
                        <span className="ml-1">{prevRecord.title}</span>
                      </div>
                    )}
                    {prevRecord.content && (
                      <div className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                        {prevRecord.content}
                      </div>
                    )}
                    {prevRecord.homework && (
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground">次回予定：</span>
                        <span className="ml-1 text-xs">{prevRecord.homework}</span>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* ─── 入力フォーム ─── */}
              <form
                key={selectedEnrollmentId}
                action={addScheduledLessonRecord}
                className="grid gap-5 md:grid-cols-2"
              >
                {/* hidden fields */}
                <input type="hidden" name="enrollment_id" value={selectedEnrollmentId} />
                <input type="hidden" name="lesson_date" value={selectedDate} />

                {/* ── 基本情報 ── */}
                <SectionDivider label="基本情報" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label>生徒・コース</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {selectedEnrollment
                      ? `${fullName(one(selectedEnrollment.students)!)}（${normalizeCourseName(one(selectedEnrollment.courses)?.course_name)}）`
                      : "左リストから生徒を選択してください"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>授業日</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {formatDate(selectedDate)}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="attendance_status">出欠 *</Label>
                  <NativeSelect id="attendance_status" name="attendance_status" defaultValue="">
                    <option value="">未設定</option>
                    <option value="present">出席</option>
                    <option value="absent">欠席</option>
                    <option value="late">遅刻</option>
                    <option value="substitute">振替</option>
                  </NativeSelect>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_time">開始時刻</Label>
                    <Input
                      id="start_time"
                      name="start_time"
                      type="time"
                      defaultValue={
                        formatTime(selectedEnrollment?.start_time) === "-"
                          ? ""
                          : formatTime(selectedEnrollment?.start_time)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_time">終了時刻</Label>
                    <Input id="end_time" name="end_time" type="time" />
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>記録者</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {recorderName}
                  </div>
                </div>

                {/* ── 授業内容 ── */}
                <SectionDivider label="授業内容" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="goal">今日の目的</Label>
                  <Input id="goal" name="goal" placeholder="例: 変数ブロックを使ったスコア実装" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="typing_tool">タイピング使用ツール</Label>
                  <Input id="typing_tool" name="typing_tool" placeholder="例: Typing.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson_tool">レッスン使用ツール</Label>
                  <Input id="lesson_tool" name="lesson_tool" placeholder="例: Scratch 3.0" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="typing_note">タイピングの様子</Label>
                  <Textarea
                    id="typing_note"
                    name="typing_note"
                    className="min-h-[80px] resize-y"
                    placeholder="スピード・正確さ・集中度など"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="lesson_note" className="text-sm font-semibold">
                    授業の様子 <span className="ml-1 text-xs font-normal text-muted-foreground">（最重要）</span>
                  </Label>
                  <Textarea
                    id="lesson_note"
                    name="lesson_note"
                    className="min-h-[160px] resize-y"
                    placeholder="取り組み・理解度・つまずき・集中度・会話の内容など、詳しく記録"
                  />
                </div>

                {/* ── まとめ ── */}
                <SectionDivider label="まとめ" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="excitement_note">子どもの反応・ワクワクの様子</Label>
                  <Textarea
                    id="excitement_note"
                    name="excitement_note"
                    className="min-h-[72px] resize-y"
                    placeholder="楽しんでいた点・印象的だった反応など"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="next_plan">次回の予定・宿題</Label>
                  <Textarea
                    id="next_plan"
                    name="next_plan"
                    className="min-h-[72px] resize-y"
                    placeholder="次回やること・持ち物など"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="remarks">備考・保護者へのメモ</Label>
                  <Textarea
                    id="remarks"
                    name="remarks"
                    className="min-h-[64px] resize-y"
                    placeholder="保護者へ伝えたいこと・連絡事項など"
                  />
                </div>

                {/* ── ボタン ── */}
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button
                    type="submit"
                    disabled={!selectedEnrollment}
                    className="sm:w-auto"
                  >
                    記録を登録
                  </Button>

                  {/* 下書き保存（action を上書き） */}
                  <Button
                    type="submit"
                    formAction={saveDraftLessonRecord}
                    variant="outline"
                    disabled={!selectedEnrollment}
                  >
                    下書き保存
                  </Button>
                </div>
              </form>

            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
