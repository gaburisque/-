import Link from "next/link";
import { CalendarPlus } from "lucide-react";

import { addScheduledLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { WeekdayFilterForm } from "@/components/weekday-filter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, fullName } from "@/lib/format";
import { lessonEndTimeOptions, lessonStartTimeOptions } from "@/lib/lesson-times";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Enrollment, Staff } from "@/lib/types";
import { parseWeekday } from "@/lib/weekdays";

function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeCourseName(courseName: string | null | undefined) {
  if (!courseName) return "";
  return courseName.replace(/^[A-ZＡ-Ｚ]\s*[:：]\s*/u, "").trim();
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
      .select("enrollment_id,student_id,course_id,schedule_label,weekday,start_time,frequency,status,students(student_id,last_name,first_name,grade),courses(course_id,course_name)")
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
  const enrollments = (enrollmentsResult.data ?? []) as Enrollment[];
  const visibleEnrollments: Enrollment[] = [];
  const seenEnrollmentKeys = new Set<string>();
  for (const enrollment of enrollments) {
    const studentId = one(enrollment.students)?.student_id;
    const normalizedCourse = normalizeCourseName(one(enrollment.courses)?.course_name);
    const startTime = enrollment.start_time ?? "";
    if (!studentId || !normalizedCourse) {
      visibleEnrollments.push(enrollment);
      continue;
    }
    const key = `${studentId}::${normalizedCourse}::${startTime}`;
    if (seenEnrollmentKeys.has(key)) continue;
    seenEnrollmentKeys.add(key);
    visibleEnrollments.push(enrollment);
  }
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
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">授業記録入力</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              登校曜日で生徒を絞り込んで、授業記録を登録します。
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/lesson-records">授業記録一覧</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>登校曜日</CardTitle>
          </CardHeader>
          <CardContent>
            <WeekdayFilterForm weekday={weekday} />
          </CardContent>
        </Card>

        {migrationRequired ? (
          <Card>
            <CardHeader>
              <CardTitle>曜日データの追加が必要です</CardTitle>
              <CardDescription>
                Supabase SQL Editorで `supabase/add_enrollment_schedule.sql` を実行してください。
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(280px,420px)_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5" />
                {weekday}曜日の生徒
              </CardTitle>
              <CardDescription>{visibleEnrollments.length}件</CardDescription>
            </CardHeader>
            <CardContent>
              {visibleEnrollments.length > 0 ? (
                <div className="grid max-h-[680px] gap-2 overflow-y-auto pr-1">
                  {visibleEnrollments.map((enrollment) => (
                    <Link
                      key={enrollment.enrollment_id}
                      href={`/lesson-records/new?weekday=${encodeURIComponent(weekday)}&enrollment_id=${enrollment.enrollment_id}#record-form`}
                      className={`rounded-md border bg-white p-3 transition-colors hover:border-primary hover:bg-muted/40 ${
                        enrollment.enrollment_id === selectedEnrollmentId ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {one(enrollment.students) ? fullName(one(enrollment.students)!) : "-"}
                            {one(enrollment.students)?.grade ? (
                              <span className="ml-2 text-sm font-normal text-muted-foreground">
                                {one(enrollment.students)?.grade}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-sm text-muted-foreground">
                            {normalizeCourseName(one(enrollment.courses)?.course_name) || "-"}
                          </div>
                        </div>
                        <Badge className="shrink-0 bg-white">{formatTime(enrollment.start_time)}</Badge>
                      </div>
                      {enrollment.schedule_label ? (
                        <div className="mt-2 truncate text-xs text-muted-foreground">{enrollment.schedule_label}</div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState>{weekday}曜日の受講予定がありません。</EmptyState>
              )}
            </CardContent>
          </Card>

          <Card id="record-form" className="xl:sticky xl:top-6 xl:self-start">
            <CardHeader>
              <CardTitle>記録フォーム</CardTitle>
              <CardDescription>
                {selectedEnrollment
                  ? `${one(selectedEnrollment.students) ? fullName(one(selectedEnrollment.students)!) : "-"} の記録を入力中`
                  : "左の生徒をクリックするか、プルダウンから選択してください。"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={addScheduledLessonRecord} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="enrollment_id">生徒・コース</Label>
                  <NativeSelect id="enrollment_id" name="enrollment_id" defaultValue={selectedEnrollmentId} required>
                    <option value="">選択してください</option>
                    {visibleEnrollments.map((enrollment) => (
                      <option key={enrollment.enrollment_id} value={enrollment.enrollment_id}>
                        {one(enrollment.students) ? fullName(one(enrollment.students)!) : "-"}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>記録者</Label>
                  <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-medium">
                    {recorderName}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lesson_date">授業日</Label>
                  <Input id="lesson_date" name="lesson_date" type="date" defaultValue={today()} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">開始</Label>
                    <NativeSelect id="start_time" name="start_time" defaultValue={formatTime(selectedEnrollment?.start_time) === "-" ? "" : formatTime(selectedEnrollment?.start_time)}>
                      <option value="">予定時刻</option>
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
                  <Label htmlFor="goal">今日の目的</Label>
                  <Textarea id="goal" name="goal" className="min-h-[72px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="typing_tool">タイピング使用ツール</Label>
                  <Input id="typing_tool" name="typing_tool" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lesson_tool">レッスン使用ツール</Label>
                  <Input id="lesson_tool" name="lesson_tool" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="typing_note">タイピングの様子</Label>
                  <Textarea id="typing_note" name="typing_note" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="lesson_note">レッスンの様子</Label>
                  <Textarea id="lesson_note" name="lesson_note" className="min-h-[140px]" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="excitement_note">今日のワクワクの様子</Label>
                  <Textarea id="excitement_note" name="excitement_note" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="next_plan">次回の予定</Label>
                  <Textarea id="next_plan" name="next_plan" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="remarks">備考</Label>
                  <Textarea id="remarks" name="remarks" />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" disabled={visibleEnrollments.length === 0} className="w-full sm:w-auto">
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
