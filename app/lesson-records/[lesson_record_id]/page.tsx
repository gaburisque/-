import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, History, UserRound } from "lucide-react";

import { updateLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { DeleteLessonRecordButton } from "@/components/delete-lesson-record-button";
import { LessonRecordFormFields } from "@/components/lesson-record-content-fields";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { emptyText, formatDate, formatTime, fullName } from "@/lib/format";
import {
  isStructuredLessonContent,
  LESSON_CONTENT_DISPLAY_LABELS,
  parseLessonRecordContent,
  type LessonRecordContentFields
} from "@/lib/lesson-record-content";
import { createClient } from "@/lib/supabase/server";
import type { Course, LessonRecord, LessonRecordHistory } from "@/lib/types";

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

function TextBlock({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="whitespace-pre-wrap rounded-md border bg-white p-4 text-sm leading-7 min-h-[56px]">
        {emptyText(value)}
      </div>
    </section>
  );
}

function LessonRecordContentView({
  content,
  title,
  homework,
  memo
}: {
  content: string | null | undefined;
  title: string | null | undefined;
  homework: string | null | undefined;
  memo: string | null | undefined;
}) {
  const parsed = parseLessonRecordContent(content, title);
  const fieldKeys = Object.keys(LESSON_CONTENT_DISPLAY_LABELS) as (keyof LessonRecordContentFields)[];
  const hasStructured = isStructuredLessonContent(content);

  if (!hasStructured && content?.trim()) {
    return (
      <div className="space-y-5">
        {title?.trim() ? <TextBlock title="今日の目的" value={title} /> : null}
        <TextBlock title="授業内容" value={content} />
        {homework ? <TextBlock title="次回の予定・宿題" value={homework} /> : null}
        {memo ? <TextBlock title="備考・保護者へのメモ" value={memo} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fieldKeys.map((key) => {
        const value = parsed[key];
        if (!value) return null;
        const wide = key === "lesson_note";
        return (
          <section key={key} className={`space-y-1.5 ${wide ? "" : "sm:max-w-xl"}`}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {LESSON_CONTENT_DISPLAY_LABELS[key]}
            </h2>
            <div
              className={`whitespace-pre-wrap rounded-md border bg-white text-sm leading-7 ${
                wide ? "min-h-[120px] p-4" : "min-h-[56px] p-3"
              }`}
            >
              {value}
            </div>
          </section>
        );
      })}
      {homework ? <TextBlock title="次回の予定・宿題" value={homework} /> : null}
      {memo ? <TextBlock title="備考・保護者へのメモ" value={memo} /> : null}
      {!fieldKeys.some((key) => parsed[key]) && !homework && !memo ? (
        <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          記録なし
        </div>
      ) : null}
    </div>
  );
}


export default async function LessonRecordDetailPage({
  params
}: {
  params: Promise<{ lesson_record_id: string }>;
}) {
  const { lesson_record_id: lessonRecordId } = await params;
  const supabase = await createClient();

  const [recordResult, coursesResult, historyResult] = await Promise.all([
    supabase
      .from("lesson_records")
      .select("*,students(student_id,last_name,first_name,grade),courses(course_id,course_name),staff(staff_id,name)")
      .eq("lesson_record_id", lessonRecordId)
      .single(),
    supabase.from("courses").select("course_id,course_name").eq("status", "active").order("course_name"),
    supabase
      .from("lesson_record_history")
      .select("*")
      .eq("lesson_record_id", lessonRecordId)
      .order("changed_at", { ascending: false })
      .limit(10)
  ]);
  const { data, error } = recordResult;

  if (error || !data) {
    notFound();
  }

  const record = data as LessonRecord;
  const courses = uniqueCoursesByCanonicalName(
    (coursesResult.data ?? []) as Pick<Course, "course_id" | "course_name">[]
  );
  const history = (historyResult.data ?? []) as LessonRecordHistory[];
  const startTime = record.start_time?.slice(0, 5) ?? "";
  const endTime = record.end_time?.slice(0, 5) ?? "";

  const formDefaults = {
    ...parseLessonRecordContent(record.content, record.title),
    next_plan: record.homework ?? "",
    remarks: record.memo ?? ""
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="px-0 print:hidden">
              <Link href="/lesson-records">
                <ArrowLeft className="h-4 w-4" />
                授業記録一覧へ戻る
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-normal">
              {record.students ? fullName(record.students) : "授業記録"}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {formatDate(record.lesson_date)}
              </span>
            </h1>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge className="gap-1 bg-white">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(record.lesson_date)}
              </Badge>
              <Badge className="gap-1 bg-white">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(record.start_time)}
              </Badge>
              <Badge className="gap-1 bg-white">
                <UserRound className="h-3.5 w-3.5" />
                {record.students ? fullName(record.students) : "-"}
              </Badge>
              {record.attendance_status && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ATTENDANCE_COLORS[record.attendance_status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {ATTENDANCE_LABELS[record.attendance_status] ?? record.attendance_status}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <PrintButton />
            {record.students ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/students/${record.students.student_id}`}>生徒詳細</Link>
              </Button>
            ) : null}
            <DeleteLessonRecordButton
              lessonRecordId={record.lesson_record_id}
              studentId={record.students?.student_id}
              redirectTo="/lesson-records"
              variant="outline"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">生徒</div>
              <div className="mt-1 font-medium">
                {record.students ? fullName(record.students) : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">コース</div>
              <div className="mt-1 font-medium">{normalizeCourseName(record.courses?.course_name) || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">記録者</div>
              <div className="mt-1 font-medium">{record.staff?.name ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">時間</div>
              <div className="mt-1 font-medium">
                {formatTime(record.start_time)} - {formatTime(record.end_time)}
              </div>
            </div>
          </CardContent>
        </Card>

        <LessonRecordContentView
          content={record.content}
          title={record.title}
          homework={record.homework}
          memo={record.memo}
        />

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>授業記録を編集</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateLessonRecord} className="grid gap-5 md:grid-cols-2">
              <input type="hidden" name="lesson_record_id" value={record.lesson_record_id} />
              <input type="hidden" name="student_id" value={record.student_id} />

              <div className="flex items-center gap-3 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  基本情報
                </span>
                <div className="flex-1 border-t" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lesson_date">授業日</Label>
                <Input id="lesson_date" name="lesson_date" type="date" defaultValue={record.lesson_date ?? ""} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course_id">コース</Label>
                <NativeSelect id="course_id" name="course_id" defaultValue={record.course_id ?? ""}>
                  <option value="">未選択</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {normalizeCourseName(course.course_name)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="attendance_status">出欠</Label>
                <NativeSelect id="attendance_status" name="attendance_status" defaultValue={record.attendance_status ?? ""}>
                  <option value="">未設定</option>
                  <option value="present">出席</option>
                  <option value="absent">欠席</option>
                  <option value="late">遅刻</option>
                  <option value="substitute">振替</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start_time">開始時刻</Label>
                <Input id="start_time" name="start_time" type="time" defaultValue={startTime} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_time">終了時刻</Label>
                <Input id="end_time" name="end_time" type="time" defaultValue={endTime} />
              </div>

              <LessonRecordFormFields defaults={formDefaults} />

              <div className="md:col-span-2">
                <Button type="submit">編集内容を保存</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                編集履歴（直近10件）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y text-sm">
                {history.map((h) => (
                  <div key={h.history_id} className="py-3 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(h.changed_at).toLocaleString("ja-JP")}</span>
                      {h.lesson_date && <span>授業日: {formatDate(h.lesson_date)}</span>}
                    </div>
                    {h.title && <div><span className="font-medium">タイトル: </span>{h.title}</div>}
                    {h.content && (
                      <div className="whitespace-pre-wrap text-xs text-muted-foreground line-clamp-3">
                        {h.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
