import Link from "next/link";

import { addScheduledLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { WeekdayFilterForm } from "@/components/weekday-filter-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeCourseName } from "@/lib/courses";
import { dedupeEnrollmentsByStudentCourseTime } from "@/lib/enrollments";
import { formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { lessonEndTimeOptions, lessonStartTimeOptions } from "@/lib/lesson-times";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, Staff } from "@/lib/types";
import { parseWeekday } from "@/lib/weekdays";

const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-400",
  Roblox: "bg-green-500",
  ITオンライン部: "bg-purple-500",
  イラスト: "bg-orange-400"
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
  searchParams: Promise<{ weekday?: string; enrollment_id?: string }>;
}) {
  const params = await searchParams;
  const weekday = parseWeekday(params.weekday);
  const selectedEnrollmentId = params.enrollment_id ?? "";
  const supabase = await createClient();

  const [
    enrollmentsResult,
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
      .eq("weekday", weekday)
      .order("start_time", { ascending: true, nullsFirst: false }),
    supabase.auth.getUser()
  ]);

  const staffResult = user
    ? await supabase
        .from("staff")
        .select("staff_id,name,email,role")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const migrationRequired =
    Boolean(enrollmentsResult.error) &&
    enrollmentsResult.error?.message.toLowerCase().includes("weekday");
  const visibleEnrollments = dedupeEnrollmentsByStudentCourseTime(
    (enrollmentsResult.data ?? []) as Enrollment[]
  );
  const currentStaff = staffResult.data as Staff | null;
  const recorderName =
    currentStaff?.name ??
    (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : null) ??
    user?.email ??
    "ログイン中の職員";
  const selectedEnrollment = visibleEnrollments.find(
    (enrollment) => enrollment.enrollment_id === selectedEnrollmentId
  );

  return (
    <AppShell>
      <div className="space-y-5">
        {/* ─── ヘッダー ─── */}
        <div className="flex flex-wrap items-end gap-3 sm:gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">授業記録入力</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              登校曜日で生徒を絞り込んで記録を登録します。
            </p>
          </div>
          <WeekdayFilterForm weekday={weekday} />
          <Button asChild variant="outline" size="sm">
            <Link href="/lesson-records">記録一覧</Link>
          </Button>
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
        <div className="grid gap-5 xl:grid-cols-[minmax(260px,380px)_1fr]">

          {/* ─── 生徒リスト ─── */}
          <Card className="h-fit xl:sticky xl:top-5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {weekday}曜日の生徒
                </CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {visibleEnrollments.length}件
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {visibleEnrollments.length > 0 ? (
                <div className="grid max-h-[calc(100svh-220px)] gap-1.5 overflow-y-auto pr-0.5">
                  {visibleEnrollments.map((enrollment) => {
                    const student = one(enrollment.students);
                    const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
                    const dotColor = COURSE_DOT[courseName] ?? "bg-gray-300";
                    const isSelected = enrollment.enrollment_id === selectedEnrollmentId;
                    return (
                      <Link
                        key={enrollment.enrollment_id}
                        href={`/lesson-records/new?weekday=${encodeURIComponent(weekday)}&enrollment_id=${enrollment.enrollment_id}#record-form`}
                        className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:border-primary hover:bg-primary/5 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "bg-white"
                        }`}
                      >
                        <span
                          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`}
                        />
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
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                          {formatTime(enrollment.start_time)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState>{weekday}曜日の受講予定がありません。</EmptyState>
              )}
            </CardContent>
          </Card>

          {/* ─── 記録フォーム ─── */}
          <Card id="record-form">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">
                {selectedEnrollment
                  ? `${one(selectedEnrollment.students) ? fullName(one(selectedEnrollment.students)!) : "-"} の記録`
                  : "記録フォーム"}
              </CardTitle>
              {!selectedEnrollment && (
                <p className="text-sm text-muted-foreground">
                  左から生徒を選択すると記録を入力できます。
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form action={addScheduledLessonRecord} className="grid gap-5 md:grid-cols-2">

                {/* ── 基本情報 ── */}
                <SectionDivider label="基本情報" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="enrollment_id">生徒・コース</Label>
                  <NativeSelect
                    id="enrollment_id"
                    name="enrollment_id"
                    defaultValue={selectedEnrollmentId}
                    required
                  >
                    <option value="">選択してください</option>
                    {visibleEnrollments.map((enrollment) => (
                      <option key={enrollment.enrollment_id} value={enrollment.enrollment_id}>
                        {one(enrollment.students) ? fullName(one(enrollment.students)!) : "-"}
                        {" "}（{normalizeCourseName(one(enrollment.courses)?.course_name)}）
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lesson_date">授業日</Label>
                  <Input
                    id="lesson_date"
                    name="lesson_date"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="attendance_status">出欠</Label>
                  <NativeSelect id="attendance_status" name="attendance_status" defaultValue="">
                    <option value="">未設定</option>
                    <option value="present">出席</option>
                    <option value="absent">欠席</option>
                    <option value="late">遅刻</option>
                    <option value="substitute">振替</option>
                  </NativeSelect>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_time">開始</Label>
                    <NativeSelect
                      id="start_time"
                      name="start_time"
                      defaultValue={
                        formatTime(selectedEnrollment?.start_time) === "-"
                          ? ""
                          : formatTime(selectedEnrollment?.start_time)
                      }
                    >
                      <option value="">予定時刻</option>
                      {lessonStartTimeOptions.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1.5">
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

                <div className="space-y-1.5 md:col-span-2">
                  <Label>記録者</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                    {recorderName}
                  </div>
                </div>

                {/* ── 今日の目的 ── */}
                <SectionDivider label="授業内容" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="goal">今日の目的</Label>
                  <Input id="goal" name="goal" placeholder="例: 変数ブロックを使った計算" />
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
                    className="min-h-[88px] resize-none"
                    placeholder="スピード・正確さ・集中度など"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lesson_note">レッスンの様子</Label>
                  <Textarea
                    id="lesson_note"
                    name="lesson_note"
                    className="min-h-[88px] resize-none"
                    placeholder="取り組み・理解度・つまずきなど"
                  />
                </div>

                {/* ── まとめ ── */}
                <SectionDivider label="まとめ" />

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="excitement_note">今日のワクワクの様子</Label>
                  <Textarea
                    id="excitement_note"
                    name="excitement_note"
                    className="min-h-[72px] resize-none"
                    placeholder="楽しんでいた点・子どもらしい反応など"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="next_plan">次回の予定</Label>
                  <Textarea
                    id="next_plan"
                    name="next_plan"
                    className="min-h-[72px] resize-none"
                    placeholder="次回やること・持ち物・宿題など"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="remarks">備考</Label>
                  <Textarea
                    id="remarks"
                    name="remarks"
                    className="min-h-[64px] resize-none"
                    placeholder="保護者へ伝えたいこと・連絡事項など"
                  />
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    disabled={visibleEnrollments.length === 0}
                    className="w-full sm:w-auto"
                  >
                    授業記録を登録
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
