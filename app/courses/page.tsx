import { BookOpen } from "lucide-react";

import { archiveCourse, createCourse, updateCourse } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  active: "開講中",
  inactive: "停止中"
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-500"
};

export default async function CoursesPage() {
  const supabase = await createClient();

  const [coursesResult, enrollmentCountResult] = await Promise.all([
    supabase.from("courses").select("*").order("course_name"),
    supabase
      .from("enrollments")
      .select("course_id")
      .eq("status", "active")
  ]);

  const courses = (coursesResult.data ?? []) as Course[];

  const enrollmentCounts = ((enrollmentCountResult.data ?? []) as { course_id: string }[]).reduce<
    Record<string, number>
  >((acc, e) => {
    acc[e.course_id] = (acc[e.course_id] ?? 0) + 1;
    return acc;
  }, {});

  const activeCourses = courses.filter((c) => c.status === "active");
  const inactiveCourses = courses.filter((c) => c.status !== "active");

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">コース管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            コースの追加・名称変更・停止ができます
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* コース一覧 */}
          <div className="space-y-4">
            {activeCourses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">開講中</p>
                {activeCourses.map((course) => (
                  <CourseCard
                    key={course.course_id}
                    course={course}
                    enrollmentCount={enrollmentCounts[course.course_id] ?? 0}
                  />
                ))}
              </div>
            )}

            {inactiveCourses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">停止中</p>
                {inactiveCourses.map((course) => (
                  <CourseCard
                    key={course.course_id}
                    course={course}
                    enrollmentCount={enrollmentCounts[course.course_id] ?? 0}
                  />
                ))}
              </div>
            )}

            {courses.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  コースがまだありません。右の「新しいコースを追加」から作成してください。
                </CardContent>
              </Card>
            )}
          </div>

          {/* 新規追加フォーム */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">新しいコースを追加</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createCourse} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="course_name">コース名 *</Label>
                  <Input
                    id="course_name"
                    name="course_name"
                    placeholder="例: Scratch"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">説明（任意）</Label>
                  <Input
                    id="description"
                    name="description"
                    placeholder="例: ブロックプログラミング"
                  />
                </div>
                <Button type="submit" className="w-full">
                  <BookOpen className="h-4 w-4" />
                  追加
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function CourseCard({
  course,
  enrollmentCount
}: {
  course: Course;
  enrollmentCount: number;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <form action={updateCourse} className="space-y-3">
          <input type="hidden" name="course_id" value={course.course_id} />

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    STATUS_COLORS[course.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {STATUS_LABELS[course.status] ?? course.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  受講中 {enrollmentCount}人
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">コース名</Label>
                  <Input
                    name="course_name"
                    defaultValue={course.course_name}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">説明</Label>
                  <Input
                    name="description"
                    defaultValue={course.description ?? ""}
                    placeholder="任意"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <input type="hidden" name="status" value={course.status} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="outline" size="sm">
              保存
            </Button>
          </div>
        </form>

        {/* 開講/停止切り替え */}
        <form action={archiveCourse} className="mt-2">
          <input type="hidden" name="course_id" value={course.course_id} />
          <input type="hidden" name="current_status" value={course.status} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className={
              course.status === "active"
                ? "text-muted-foreground hover:text-destructive"
                : "text-muted-foreground hover:text-green-700"
            }
          >
            {course.status === "active" ? "停止する" : "再開する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
