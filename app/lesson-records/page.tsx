import Link from "next/link";
import { CalendarRange, ChevronRight, Filter, PenLine, SlidersHorizontal } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import {
  LessonRecordsStudentSearch,
  type LessonRecordsStudentSearchOption
} from "@/components/lesson-records-student-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName, uniqueCoursesByCanonicalName } from "@/lib/courses";
import { emptyText, formatDate, formatTime, fullName, previewText } from "@/lib/format";
import { formatGrade, gradeOptions } from "@/lib/grades";
import {
  lessonRecordSortOptions,
  parseLessonRecordSort,
  sortLessonRecords
} from "@/lib/lesson-records";
import { buildLessonRecordsListPath } from "@/lib/lesson-records-list-url";
import { createClient } from "@/lib/supabase/server";
import type { Course, LessonRecord } from "@/lib/types";
import { weekdayFromDate, weekdayOptions } from "@/lib/weekdays";

const PAGE_SIZE = 25;

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  substitute: "振替"
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  absent: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  late: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  substitute: "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
};

const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-500",
  Roblox: "bg-emerald-500",
  ITオンライン部: "bg-violet-500",
  イラスト: "bg-orange-500"
};

const GROUP_OPTIONS = [
  { value: "", label: "一覧のみ" },
  { value: "grade", label: "学年別に見出し" },
  { value: "weekday", label: "曜日別に見出し" },
  { value: "course", label: "コース別に見出し" }
] as const;

type GroupKey = "grade" | "weekday" | "course" | "";

function parseGroup(value: string | undefined): GroupKey {
  if (value === "grade" || value === "weekday" || value === "course") return value;
  return "";
}

export default async function LessonRecordsPage({
  searchParams
}: {
  searchParams: Promise<{
    student_id?: string;
    course_id?: string;
    grade?: string;
    from?: string;
    to?: string;
    year?: string;
    weekday?: string;
    sort?: string;
    group?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const sort = parseLessonRecordSort(params.sort);
  const group = parseGroup(params.group);
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const preserved = {
    student_id: params.student_id,
    grade: params.grade,
    course_id: params.course_id,
    weekday: params.weekday,
    year: params.year,
    from: params.from,
    to: params.to,
    sort,
    group: group || undefined,
    page: undefined as string | undefined
  };

  const listNavBase: Record<string, string> = { sort };
  if (params.grade) listNavBase.grade = params.grade;
  if (params.course_id) listNavBase.course_id = params.course_id;
  if (params.weekday) listNavBase.weekday = params.weekday;
  if (params.year) listNavBase.year = params.year;
  if (params.from) listNavBase.from = params.from;
  if (params.to) listNavBase.to = params.to;
  if (group) listNavBase.group = group;

  const [studentsResult, yearsResult, coursesResult] = await Promise.all([
    supabase
      .from("students")
      .select("student_id,last_name,first_name,last_name_kana,first_name_kana,grade")
      .order("last_name_kana", { ascending: true, nullsFirst: false }),
    supabase
      .from("lesson_records")
      .select("lesson_date")
      .order("lesson_date", { ascending: false }),
    supabase
      .from("courses")
      .select("course_id,course_name")
      .eq("status", "active")
      .order("course_name")
  ]);

  const students = (studentsResult.data ?? []) as LessonRecordsStudentSearchOption[];
  const courses = uniqueCoursesByCanonicalName(
    (coursesResult.data ?? []) as Pick<Course, "course_id" | "course_name">[]
  );
  const years = Array.from(
    new Set(
      (yearsResult.data ?? [])
        .map((record) => record.lesson_date?.slice(0, 4))
        .filter((year): year is string => Boolean(year))
    )
  );

  let recordsQuery = supabase
    .from("lesson_records")
    .select(
      "*,students(student_id,last_name,first_name,grade),courses(course_id,course_name),staff(staff_id,name)"
    )
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false });

  if (params.student_id) recordsQuery = recordsQuery.eq("student_id", params.student_id);
  if (params.course_id) recordsQuery = recordsQuery.eq("course_id", params.course_id);
  if (params.year) {
    recordsQuery = recordsQuery
      .gte("lesson_date", `${params.year}-01-01`)
      .lte("lesson_date", `${params.year}-12-31`);
  }
  if (params.from) recordsQuery = recordsQuery.gte("lesson_date", params.from);
  if (params.to) recordsQuery = recordsQuery.lte("lesson_date", params.to);

  const { data: records } = await recordsQuery;
  let filteredRecords = (records ?? []) as LessonRecord[];

  if (params.weekday) {
    filteredRecords = filteredRecords.filter(
      (record) => weekdayFromDate(record.lesson_date) === params.weekday
    );
  }
  if (params.grade) {
    filteredRecords = filteredRecords.filter(
      (record) => record.students?.grade === params.grade
    );
  }

  const sortedRecords = sortLessonRecords(filteredRecords, sort);
  const totalCount = sortedRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(pageNum, totalPages);
  const pageOffset = (safePage - 1) * PAGE_SIZE;

  const groups = (() => {
    if (!group) return null;
    const map = new Map<string, LessonRecord[]>();
    for (const record of sortedRecords) {
      let key = "（未設定）";
      if (group === "grade") {
        key = record.students?.grade || "（学年未設定）";
      } else if (group === "weekday") {
        key = `${weekdayFromDate(record.lesson_date) || "?"}曜日`;
      } else if (group === "course") {
        key = normalizeCourseName(record.courses?.course_name) || "（コース未設定）";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(record);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (group === "grade") {
        const order = [...gradeOptions, "（学年未設定）"];
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }
      if (group === "weekday") {
        const order = weekdayOptions.map((w) => `${w}曜日`);
        return order.indexOf(a[0]) - order.indexOf(b[0]);
      }
      return a[0].localeCompare(b[0], "ja");
    });
  })();

  const activeFilters: { label: string; href: string }[] = [];
  if (params.student_id) {
    const s = students.find((st) => st.student_id === params.student_id);
    activeFilters.push({
      label: `生徒: ${s ? fullName(s) : params.student_id}`,
      href: buildLessonRecordsListPath(preserved, { student_id: undefined, page: "1" })
    });
  }
  if (params.grade)
    activeFilters.push({
      label: `学年: ${params.grade}`,
      href: buildLessonRecordsListPath(preserved, { grade: undefined, page: "1" })
    });
  if (params.course_id) {
    const c = courses.find((co) => co.course_id === params.course_id);
    activeFilters.push({
      label: `コース: ${c ? normalizeCourseName(c.course_name) : params.course_id}`,
      href: buildLessonRecordsListPath(preserved, { course_id: undefined, page: "1" })
    });
  }
  if (params.weekday)
    activeFilters.push({
      label: `${params.weekday}曜`,
      href: buildLessonRecordsListPath(preserved, { weekday: undefined, page: "1" })
    });
  if (params.year)
    activeFilters.push({
      label: `${params.year}年`,
      href: buildLessonRecordsListPath(preserved, { year: undefined, page: "1" })
    });
  if (params.from || params.to)
    activeFilters.push({
      label: `期間: ${params.from ?? "…"}〜${params.to ?? "…"}`,
      href: buildLessonRecordsListPath(preserved, { from: undefined, to: undefined, page: "1" })
    });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="border-b pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">記録一覧</h1>
            <p className="text-xs text-muted-foreground">
              {totalCount}件
              {totalPages > 1 &&
                ` · ${PAGE_SIZE}件ずつ（${safePage}/${totalPages}ページ）`}
              {" · "}
              {lessonRecordSortOptions.find((o) => o.value === sort)?.label}
            </p>
          </div>
        </header>

        {/* 曜日クイック */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">曜日</span>
          <Link
            href={buildLessonRecordsListPath(preserved, { weekday: undefined, page: "1" })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !params.weekday
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            すべて
          </Link>
          {weekdayOptions.map((w) => (
            <Link
              key={w}
              href={buildLessonRecordsListPath(preserved, {
                weekday: w,
                page: "1"
              })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                params.weekday === w
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {w}
            </Link>
          ))}
        </div>

        {/* 適用中フィルター */}
        {activeFilters.length > 0 && (
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
              href="/lesson-records"
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              すべて解除
            </Link>
          </div>
        )}

        {/* 詳細フィルター */}
        <details className="group rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            詳細条件
            <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
              開く
            </span>
          </summary>
          <form className="space-y-4 border-t px-4 py-4">
            <input type="hidden" name="weekday" value={params.weekday ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              <LessonRecordsStudentSearch
                students={students}
                selectedStudentId={params.student_id}
                navBase={listNavBase}
              />
              <NativeSelect name="grade" defaultValue={params.grade ?? ""} aria-label="学年">
                <option value="">すべての学年</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                name="course_id"
                defaultValue={params.course_id ?? ""}
                aria-label="コース"
              >
                <option value="">すべてのコース</option>
                {courses.map((course) => (
                  <option key={course.course_id} value={course.course_id}>
                    {normalizeCourseName(course.course_name)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="year" defaultValue={params.year ?? ""} aria-label="年">
                <option value="">すべての年</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ))}
              </NativeSelect>
              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                <CalendarRange className="h-4 w-4 shrink-0" />
                <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="開始日" />
                <span>〜</span>
                <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="終了日" />
              </div>
              <NativeSelect name="group" defaultValue={group} aria-label="グループ化">
                {GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect name="sort" defaultValue={sort} aria-label="並び替え">
                {lessonRecordSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <input type="hidden" name="page" value="1" />
            <Button type="submit" variant="outline" size="sm">
              この条件で絞り込み
            </Button>
          </form>
        </details>

        {params.student_id ? (
          <section
            className="rounded-lg border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm"
            aria-labelledby="lesson-records-student-heading"
          >
            {(() => {
              const st = students.find((s) => s.student_id === params.student_id);
              return st ? (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 id="lesson-records-student-heading" className="font-semibold tracking-tight">
                      {fullName(st)}の過去の記録
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      条件に一致する記録は {totalCount} 件です。各行の「編集」から詳細画面で内容を変更できます。
                    </p>
                  </div>
                  <Link
                    href={`/students/${params.student_id}`}
                    className="shrink-0 text-xs font-medium text-primary underline underline-offset-4 hover:no-underline"
                  >
                    生徒詳細へ
                  </Link>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  指定された生徒が見つかりません。フィルターを解除してから選び直してください。
                </p>
              );
            })()}
          </section>
        ) : null}

        {/* リスト */}
        {sortedRecords.length === 0 ? (
          <EmptyState>条件に一致する記録がありません。</EmptyState>
        ) : groups ? (
          <div className="space-y-8">
            {totalCount > 80 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                グループ表示は条件に一致する記録をすべて表示します。件数が多いときは、詳細条件で「一覧のみ」にしてページ送りを使うと読みやすいです。
              </p>
            )}
            {groups.map(([groupKey, recs]) => (
              <section key={groupKey} className="space-y-3">
                <h2 className="flex items-baseline gap-2 border-b pb-2 text-sm font-semibold">
                  {groupKey}
                  <span className="text-xs font-normal text-muted-foreground">
                    {recs.length}件
                  </span>
                </h2>
                <RecordCardList
                  records={recs}
                  omitStudentName={Boolean(params.student_id)}
                />
              </section>
            ))}
          </div>
        ) : (
          <>
            <RecordCardList
              records={sortedRecords.slice(pageOffset, pageOffset + PAGE_SIZE)}
              omitStudentName={Boolean(params.student_id)}
            />
            {totalPages > 1 && (
              <Pagination
                safePage={safePage}
                totalPages={totalPages}
                preserved={preserved}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Pagination({
  safePage,
  totalPages,
  preserved
}: {
  safePage: number;
  totalPages: number;
  preserved: Record<string, string | undefined>;
}) {
  const prev =
    safePage > 1 ? buildLessonRecordsListPath(preserved, { page: String(safePage - 1) }) : null;
  const next =
    safePage < totalPages ? buildLessonRecordsListPath(preserved, { page: String(safePage + 1) }) : null;

  return (
    <nav className="flex items-center justify-between border-t pt-4 text-sm">
      {prev ? (
        <Button asChild variant="outline" size="sm">
          <Link href={prev}>前へ</Link>
        </Button>
      ) : (
        <span className="text-muted-foreground">前へ</span>
      )}
      <span className="text-xs text-muted-foreground">
        {safePage} / {totalPages}
      </span>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link href={next}>次へ</Link>
        </Button>
      ) : (
        <span className="text-muted-foreground">次へ</span>
      )}
    </nav>
  );
}

function RecordCardList({
  records,
  omitStudentName = false
}: {
  records: LessonRecord[];
  omitStudentName?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {records.map((record) => {
        const courseName = normalizeCourseName(record.courses?.course_name);
        const dotColor = COURSE_DOT[courseName] ?? "bg-gray-400";
        const wd = weekdayFromDate(record.lesson_date);
        const title =
          emptyText(record.title) === "-" ? "（目的未記入）" : emptyText(record.title);
        const detailHref = `/lesson-records/${record.lesson_record_id}`;

        return (
          <li
            key={record.lesson_record_id}
            className="flex overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/35"
          >
            <Link
              href={detailHref}
              className="flex min-w-0 flex-1 gap-3 p-4 transition-colors hover:bg-muted/25 sm:gap-4"
            >
              <div className="flex w-[4.5rem] shrink-0 flex-col gap-0.5 border-r border-border/60 pr-3 sm:w-[5.25rem] sm:pr-4">
                {wd && (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {wd}
                  </span>
                )}
                <span className="break-words text-[11px] font-semibold leading-snug tabular-nums [overflow-wrap:anywhere] sm:text-xs">
                  {formatDate(record.lesson_date).replace(/\//g, "/\u200b")}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground sm:text-xs">
                  {formatTime(record.start_time)}
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {!omitStudentName &&
                    (record.students ? (
                      <span className="font-medium">{fullName(record.students)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ))}
                  {record.students?.grade && (
                    <span className="text-xs text-muted-foreground">
                      {formatGrade(record.students.grade)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 px-2 py-0.5 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden />
                    {courseName || "—"}
                  </span>
                  {record.attendance_status ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        ATTENDANCE_COLORS[record.attendance_status] ??
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ATTENDANCE_LABELS[record.attendance_status] ?? record.attendance_status}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">下書き</span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {previewText(record.content, 140)}
                </p>
              </div>

              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 self-center text-muted-foreground/40"
                aria-hidden
              />
            </Link>

            <div className="flex w-[5.75rem] shrink-0 border-l border-border/60 bg-muted/10">
              <Link
                href={detailHref}
                className="flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 px-3 py-4 text-xs font-medium text-primary hover:bg-muted/50 active:bg-muted/70 sm:min-h-0 sm:flex-1 sm:py-6"
              >
                <PenLine className="h-4 w-4 shrink-0" aria-hidden />
                編集
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
