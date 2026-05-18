import Link from "next/link";
import { Search, UserPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { GradePromotionButton } from "@/components/grade-promotion-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fullName } from "@/lib/format";
import { formatGradeOrAge, gradeOptions, nextGrade, normalizeGrade } from "@/lib/grades";
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
    .select("student_id,last_name,first_name,last_name_kana,first_name_kana,grade,birth_date,status,phone,email,updated_at,schools(school_name)")
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

  const activeStudents = (students ?? []) as unknown as (Student & { birth_date?: string | null })[];
  const promotingStudents = activeStudents.filter(
    (s) => s.status === "active" && normalizeGrade(s.grade) !== null
  );
  const graduatingCount = promotingStudents.filter((s) => nextGrade(s.grade) === null).length;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">生徒</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {students?.length ?? 0}件 ・ 検索 / 学年・学校で絞り込み
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GradePromotionButton
              promotingCount={promotingStudents.length}
              graduatingCount={graduatingCount}
            />
            <Button asChild variant="outline" size="sm">
              <a href="/api/students/export" download>
                CSV出力
              </a>
            </Button>
            <Button asChild size="sm">
              <Link href="/students/new">
                <UserPlus className="h-4 w-4" />
                生徒を追加
              </Link>
            </Button>
          </div>
        </header>

        <form className="grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="氏名・ふりがなで検索"
              className="pl-9"
            />
          </div>
          <NativeSelect name="grade" defaultValue={params.grade ?? ""} aria-label="学年">
            <option value="">すべての学年</option>
            {gradeOptions.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            name="school_id"
            defaultValue={params.school_id ?? ""}
            aria-label="学校"
          >
            <option value="">すべての学校</option>
            {schools.map((school) => (
              <option key={school.school_id} value={school.school_id}>
                {school.school_name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            絞り込み
          </Button>
        </form>

        {students && students.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead className="w-[100px]">学年</TableHead>
                  <TableHead>学校</TableHead>
                  <TableHead>連絡先</TableHead>
                  <TableHead className="w-[80px]">状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeStudents.map((student) => (
                  <TableRow key={student.student_id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link
                        href={`/students/${student.student_id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {fullName(student)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[student.last_name_kana, student.first_name_kana]
                          .filter(Boolean)
                          .join(" ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatGradeOrAge(student.grade, student.birth_date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {one(student.schools)?.school_name ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm">
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
          </div>
        ) : (
          <EmptyState>条件に一致する生徒がいません。</EmptyState>
        )}
      </div>
    </AppShell>
  );
}
