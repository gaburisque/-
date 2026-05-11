import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { createStudent } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fullName } from "@/lib/format";
import { gradeOptions } from "@/lib/grades";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { School, Student } from "@/lib/types";

export default async function StudentsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; grade?: string; school_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const schoolsResult = await supabase
    .from("schools")
    .select("school_id,school_name,school_type")
    .order("school_name");

  const schools = (schoolsResult.data ?? []) as School[];

  let query = supabase
    .from("students")
    .select("student_id,last_name,first_name,last_name_kana,first_name_kana,grade,status,phone,email,updated_at,schools(school_name)")
    .order("last_name_kana", { ascending: true, nullsFirst: false });

  if (params.q) {
    const q = params.q.replaceAll("%", "\\%");
    query = query.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name_kana.ilike.%${q}%,first_name_kana.ilike.%${q}%`
    );
  }

  if (params.grade) {
    query = query.eq("grade", params.grade);
  }

  if (params.school_id) {
    query = query.eq("school_id", params.school_id);
  }

  const { data: students } = await query;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">生徒一覧、検索、登録を行います。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>検索・絞り込み</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="q" defaultValue={params.q ?? ""} placeholder="氏名・ふりがな" className="pl-9" />
              </div>
              <NativeSelect name="grade" defaultValue={params.grade ?? ""}>
                <option value="">すべての学年</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="school_id" defaultValue={params.school_id ?? ""}>
                <option value="">すべての学校</option>
                {schools.map((school) => (
                  <option key={school.school_id} value={school.school_id}>
                    {school.school_name}
                  </option>
                ))}
              </NativeSelect>
              <Button type="submit">絞り込み</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>生徒一覧</CardTitle>
                <CardDescription>{students?.length ?? 0}件</CardDescription>
              </div>
              <a href="/api/students/export">
                <Button variant="outline" size="sm" type="button">
                  CSVダウンロード
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {students && students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>氏名</TableHead>
                    <TableHead>学年</TableHead>
                    <TableHead>学校</TableHead>
                    <TableHead>連絡先</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(students as unknown as Student[]).map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <Link
                          href={`/students/${student.student_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {fullName(student)}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {[student.last_name_kana, student.first_name_kana].filter(Boolean).join(" ") || "-"}
                        </div>
                      </TableCell>
                      <TableCell>{student.grade ?? "-"}</TableCell>
                      <TableCell>{one(student.schools)?.school_name ?? "-"}</TableCell>
                      <TableCell>
                        <div>{student.phone ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{student.email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge>{student.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState>条件に一致する生徒がいません。</EmptyState>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              生徒登録
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createStudent} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="last_name">姓</Label>
                <Input id="last_name" name="last_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">名</Label>
                <Input id="first_name" name="first_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name_kana">姓かな</Label>
                <Input id="last_name_kana" name="last_name_kana" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name_kana">名かな</Label>
                <Input id="first_name_kana" name="first_name_kana" />
              </div>
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="school_id">学校</Label>
                <NativeSelect id="school_id" name="school_id">
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
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">性別</Label>
                <Input id="gender" name="gender" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メール</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">メモ</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">登録</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
