import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, History, UserRound } from "lucide-react";

import { updateLessonRecord } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { emptyText, formatDate, formatTime, fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Course, LessonRecord, LessonRecordHistory } from "@/lib/types";

function TextBlock({ title, value }: { title: string; value: string | null | undefined }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="whitespace-pre-wrap rounded-md border bg-white p-4 text-sm leading-7">
        {emptyText(value)}
      </div>
    </section>
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
  const courses = (coursesResult.data ?? []) as Pick<Course, "course_id" | "course_name">[];
  const history = (historyResult.data ?? []) as LessonRecordHistory[];
  const startTime = record.start_time?.slice(0, 5) ?? "";
  const endTime = record.end_time?.slice(0, 5) ?? "";

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link href="/lesson-records">
                <ArrowLeft className="h-4 w-4" />
                授業記録一覧へ戻る
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-normal">{emptyText(record.title)}</h1>
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
            </div>
          </div>
          {record.students ? (
            <Button asChild variant="outline">
              <Link href={`/students/${record.students.student_id}`}>生徒詳細</Link>
            </Button>
          ) : null}
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
              <div className="mt-1 font-medium">{record.courses?.course_name ?? "-"}</div>
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

        <div className="space-y-5">
          <TextBlock title="授業内容" value={record.content} />
          <TextBlock title="宿題・次回予定" value={record.homework} />
          <TextBlock title="メモ" value={record.memo} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>授業記録を編集</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateLessonRecord} className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="lesson_record_id" value={record.lesson_record_id} />
              <input type="hidden" name="student_id" value={record.student_id} />
              <div className="space-y-2">
                <Label htmlFor="lesson_date">授業日</Label>
                <Input id="lesson_date" name="lesson_date" type="date" defaultValue={record.lesson_date ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_id">コース</Label>
                <NativeSelect id="course_id" name="course_id" defaultValue={record.course_id ?? ""}>
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
                <Input id="start_time" name="start_time" type="time" defaultValue={startTime} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">終了</Label>
                <Input id="end_time" name="end_time" type="time" defaultValue={endTime} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">タイトル</Label>
                <Input id="title" name="title" defaultValue={record.title ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="content">授業内容</Label>
                <Textarea id="content" name="content" defaultValue={record.content ?? ""} className="min-h-[160px]" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="homework">宿題・次回予定</Label>
                <Textarea id="homework" name="homework" defaultValue={record.homework ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="memo">メモ</Label>
                <Textarea id="memo" name="memo" defaultValue={record.memo ?? ""} />
              </div>
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
