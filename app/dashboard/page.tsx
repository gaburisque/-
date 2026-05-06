import Link from "next/link";
import { CalendarCheck, UserRoundCheck, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, fullName } from "@/lib/format";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { count: studentCount },
    { count: todayLessonCount },
    { data: recentStudents }
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase
      .from("lesson_records")
      .select("*", { count: "exact", head: true })
      .eq("lesson_date", today),
    supabase
      .from("students")
      .select("student_id,last_name,first_name,grade,status,updated_at,schools(school_name)")
      .order("updated_at", { ascending: false })
      .limit(8)
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">生徒と授業記録の状況を確認します。</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>生徒数</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{studentCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>今日の授業記録数</CardTitle>
              <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{todayLessonCount ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>稼働中</CardTitle>
              <UserRoundCheck className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">ログイン済み職員のみ閲覧できます。</div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>最近更新された生徒</CardTitle>
          </CardHeader>
          <CardContent>
            {recentStudents && recentStudents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>氏名</TableHead>
                    <TableHead>学年</TableHead>
                    <TableHead>学校</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead>更新日</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recentStudents as unknown as Student[]).map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <Link
                          href={`/students/${student.student_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {fullName(student)}
                        </Link>
                      </TableCell>
                      <TableCell>{student.grade ?? "-"}</TableCell>
                      <TableCell>{one(student.schools)?.school_name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge>{student.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(student.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>まだ生徒が登録されていません。</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
