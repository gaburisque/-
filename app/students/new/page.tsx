import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";

import { createStudent } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { isCurrentUserAdmin } from "@/lib/authz";
import { gradeOptions } from "@/lib/grades";
import { lessonStartTimeOptions } from "@/lib/lesson-times";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";

export default async function NewStudentPage() {
  if (!(await isCurrentUserAdmin())) {
    redirect("/students");
  }

  const supabase = await createClient();
  const { data: coursesRaw } = await supabase
    .from("courses")
    .select("*")
    .eq("status", "active")
    .order("course_name");

  const courses = uniqueCoursesByCanonicalName((coursesRaw ?? []) as Course[]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="px-0">
            <Link href="/students">
              <ArrowLeft className="h-4 w-4" />
              生徒一覧へ戻る
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <UserPlus className="h-5 w-5" />
              生徒登録
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              基本情報に加え、保護者・緊急連絡先・受講コースをこの画面でまとめて登録できます（後からでも追加可能です）。
            </p>
          </div>
        </div>

        <form action={createStudent} className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">基本情報</CardTitle>
              <CardDescription>必須の氏名以外は任意です。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="last_name">姓 *</Label>
                <Input id="last_name" name="last_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="first_name">名 *</Label>
                <Input id="first_name" name="first_name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name_kana">姓かな</Label>
                <Input id="last_name_kana" name="last_name_kana" placeholder="さとう" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="first_name_kana">名かな</Label>
                <Input id="first_name_kana" name="first_name_kana" placeholder="はなこ" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="grade">学年</Label>
                <NativeSelect id="grade" name="grade">
                  <option value="">未選択</option>
                  {gradeOptions.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="school_name">学校</Label>
                <Input id="school_name" name="school_name" placeholder="学校名を入力" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birth_date">生年月日</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">性別</Label>
                <NativeSelect id="gender" name="gender">
                  <option value="">未選択</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                  <option value="その他">その他</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">電話番号（生徒）</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">メール（生徒）</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="notes">メモ</Label>
                <Textarea id="notes" name="notes" className="min-h-[88px] resize-y" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">保護者（任意）</CardTitle>
              <CardDescription>
                どれか入力すると保存されます。保存する場合は<strong className="text-foreground">姓・名・続柄</strong>
                が必要です。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="guardian_last_name">姓</Label>
                <Input id="guardian_last_name" name="guardian_last_name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian_first_name">名</Label>
                <Input id="guardian_first_name" name="guardian_first_name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relationship">続柄</Label>
                <Input id="relationship" name="relationship" placeholder="母・父 など" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guardian_phone">電話</Label>
                <Input id="guardian_phone" name="guardian_phone" type="tel" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="guardian_email">メール</Label>
                <Input id="guardian_email" name="guardian_email" type="email" />
              </div>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input id="guardian_is_primary" name="guardian_is_primary" type="checkbox" className="h-4 w-4" />
                主連絡先にする
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">緊急連絡先（任意）</CardTitle>
              <CardDescription>
                どれか入力すると保存されます。<strong className="text-foreground">氏名と電話</strong>が必要です。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact_name">氏名</Label>
                <Input id="contact_name" name="contact_name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_relationship">続柄</Label>
                <Input id="contact_relationship" name="contact_relationship" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">電話</Label>
                <Input id="contact_phone" name="contact_phone" type="tel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_priority">優先順位</Label>
                <Input id="contact_priority" name="contact_priority" type="number" min="1" defaultValue="1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">受講コース（任意）</CardTitle>
              <CardDescription>コースを選ぶと受講登録が作成されます。曜日・時間は記録入力の振り分けに使われます。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <input type="hidden" name="enrollment_frequency" value="weekly" />
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="course_id">コース</Label>
                <NativeSelect id="course_id" name="course_id">
                  <option value="">登録しない</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {normalizeCourseName(course.course_name)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weekday">曜日</Label>
                <NativeSelect id="weekday" name="weekday">
                  <option value="">未設定</option>
                  {weekdayOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}曜日
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enrollment_start_time">開始時間</Label>
                <NativeSelect id="enrollment_start_time" name="enrollment_start_time">
                  <option value="">未設定</option>
                  {lessonStartTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="enrollment_start_date">受講開始日（任意）</Label>
                <Input id="enrollment_start_date" name="enrollment_start_date" type="date" />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button type="submit">登録する</Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/students">キャンセル</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
