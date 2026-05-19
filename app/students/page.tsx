import Link from "next/link";
import { Filter, Search, SlidersHorizontal } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isCurrentUserAdmin } from "@/lib/authz";
import { fullName } from "@/lib/format";
import { formatGradeOrAge, gradeOptions } from "@/lib/grades";
import { one } from "@/lib/relations";
import { createClient } from "@/lib/supabase/server";
import type { School, Student } from "@/lib/types";

function buildStudentsListPath(
  base: { q?: string; grade?: string; school_id?: string },
  overrides: Partial<{ q: string | undefined; grade: string | undefined; school_id: string | undefined }>
) {
  const merged = { ...base, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/students?${qs}` : "/students";
}

export default async function StudentsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; grade?: string; school_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const isOwner = await isCurrentUserAdmin();

  const schoolsResult = await supabase
    .from("schools")
    .select("school_id,school_name,school_type")
    .order("school_name");

  const schools = (schoolsResult.data ?? []) as School[];

  const selectColumns = isOwner
    ? "student_id,last_name,first_name,last_name_kana,first_name_kana,grade,birth_date,status,phone,email,updated_at,schools(school_name)"
    : "student_id,last_name,first_name,last_name_kana,first_name_kana,grade,birth_date,status,updated_at";

  let query = supabase
    .from("students")
    .select(selectColumns)
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

  const preserved = {
    q: params.q,
    grade: params.grade,
    school_id: params.school_id
  };

  const hasDetailFilters = Boolean(params.q || params.grade || params.school_id);

  const activeFilters: { label: string; href: string }[] = [];
  if (params.q) {
    activeFilters.push({
      label: `検索: ${params.q}`,
      href: buildStudentsListPath(preserved, { q: undefined })
    });
  }
  if (params.grade) {
    activeFilters.push({
      label: `学年: ${params.grade}`,
      href: buildStudentsListPath(preserved, { grade: undefined })
    });
  }
  if (params.school_id) {
    const sch = schools.find((s) => s.school_id === params.school_id);
    activeFilters.push({
      label: `学校: ${sch?.school_name ?? params.school_id}`,
      href: buildStudentsListPath(preserved, { school_id: undefined })
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b pb-4">
          <h1 className="text-xl font-semibold tracking-tight">生徒</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {students?.length ?? 0}件
            {!isOwner ? " ・ 学校・連絡先はオーナーのみ表示されます" : ""}
          </p>
        </header>

        {activeFilters.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {activeFilters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                {f.label}
                <span className="text-muted-foreground">×</span>
              </Link>
            ))}
            <Link
              href="/students"
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              すべて解除
            </Link>
          </div>
        ) : null}

        <details
          className="group rounded-lg border bg-card"
          {...(hasDetailFilters ? { open: true } : {})}
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            詳細条件
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              開く
            </span>
          </summary>
          <form action="/students" method="get" className="space-y-4 border-t px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative sm:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="氏名・ふりがなで検索"
                  className="pl-9"
                  aria-label="氏名・ふりがな検索"
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
            </div>
            <Button type="submit" variant="outline" size="sm">
              この条件で絞り込み
            </Button>
          </form>
        </details>

        {students && students.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table className={isOwner ? "min-w-[720px]" : "min-w-[420px]"}>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead className="w-[100px]">学年</TableHead>
                  {isOwner ? <TableHead>学校</TableHead> : null}
                  {isOwner ? <TableHead>連絡先</TableHead> : null}
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
                    {isOwner ? (
                      <TableCell className="text-sm">
                        {one(student.schools)?.school_name ?? "-"}
                      </TableCell>
                    ) : null}
                    {isOwner ? (
                      <TableCell className="text-sm">
                        <div>{student.phone ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">{student.email ?? ""}</div>
                      </TableCell>
                    ) : null}
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

        {!isOwner ? (
          <p className="text-xs text-muted-foreground">
            生徒の新規登録・一括進級は{" "}
            <Link href="/settings" className="text-primary underline underline-offset-2">
              設定
            </Link>{" "}
            （オーナー向け）から利用できます。
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
