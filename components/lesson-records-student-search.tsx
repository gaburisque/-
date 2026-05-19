"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fullName } from "@/lib/format";
import { buildLessonRecordsListPath } from "@/lib/lesson-records-list-url";
import { buildLessonRecordsNewPath } from "@/lib/lesson-records-new-url";

export type LessonRecordsStudentSearchOption = {
  student_id: string;
  last_name: string;
  first_name: string;
  last_name_kana: string | null;
  first_name_kana: string | null;
  grade: string | null;
};

function matchesQuery(s: LessonRecordsStudentSearchOption, q: string): boolean {
  const lower = q.toLowerCase();
  const name = fullName(s).toLowerCase();
  const kana = [s.last_name_kana, s.first_name_kana].filter(Boolean).join(" ").toLowerCase();
  return (
    name.includes(lower) ||
    s.last_name.toLowerCase().includes(lower) ||
    s.first_name.toLowerCase().includes(lower) ||
    (kana.length > 0 && kana.includes(lower))
  );
}

export function LessonRecordsStudentSearch({
  students,
  selectedStudentId,
  compact,
  searchHint,
  omitHiddenStudentField,
  onPickStudent,
  onClearStudent,
  onQueryEdit,
  ...nav
}: {
  students: LessonRecordsStudentSearchOption[];
  selectedStudentId?: string;
  searchHint?: string;
  compact?: boolean;
  /** 記録入力など、GETフォームに student_id を載せたくないとき true */
  omitHiddenStudentField?: boolean;
  /** 指定時は選択・クリアでルーターを使わずコールバック（記録入力でリロード回避） */
  onPickStudent?: (studentId: string) => void;
  onClearStudent?: () => void;
  /** 検索文字を編集し始めたとき（親が URL の student_id を外す用途） */
  onQueryEdit?: () => void;
} & (
  | {
      navBase: Record<string, string>;
      inputNavigateBase?: never;
    }
  | {
      inputNavigateBase: Record<string, string>;
      navBase?: never;
    }
)) {
  const navBase = "navBase" in nav ? nav.navBase : undefined;
  const inputNavigateBase = "inputNavigateBase" in nav ? nav.inputNavigateBase : undefined;
  const isCompact = Boolean(compact);
  const hideStudentField = Boolean(omitHiddenStudentField);
  const router = useRouter();
  const selected = students.find((s) => s.student_id === selectedStudentId);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState(selectedStudentId ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipQuerySyncFromParentRef = useRef(false);

  useEffect(() => {
    if (skipQuerySyncFromParentRef.current) {
      skipQuerySyncFromParentRef.current = false;
      setStudentId(selectedStudentId ?? "");
      return;
    }
    setStudentId(selectedStudentId ?? "");
    if (selected) {
      setQuery(fullName(selected));
    } else if (!selectedStudentId) {
      setQuery("");
    }
  }, [selectedStudentId, selected]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return students.filter((s) => matchesQuery(s, q)).slice(0, 20);
  }, [students, query]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function pick(s: LessonRecordsStudentSearchOption) {
    setStudentId(s.student_id);
    setQuery(fullName(s));
    setOpen(false);
    if (onPickStudent) {
      onPickStudent(s.student_id);
      return;
    }
    if (inputNavigateBase) {
      router.push(
        buildLessonRecordsNewPath(inputNavigateBase, {
          student_id: s.student_id,
          enrollment_id: ""
        })
      );
    } else if (navBase) {
      router.push(
        buildLessonRecordsListPath(navBase, { student_id: s.student_id, page: "1" })
      );
    }
  }

  function clearSelection() {
    setStudentId("");
    setQuery("");
    setOpen(false);
    if (onClearStudent) {
      onClearStudent();
      return;
    }
    if (inputNavigateBase) {
      router.push(
        buildLessonRecordsNewPath(inputNavigateBase, {
          student_id: "",
          enrollment_id: ""
        })
      );
    } else if (navBase) {
      router.push(buildLessonRecordsListPath(navBase, { page: "1" }));
    }
  }

  const showSuggestions = open && query.trim().length > 0;

  const defaultListHint =
    "リストから選ぶと一覧がすぐ更新され、その生徒の過去の記録が表示されます（入力だけでは絞り込みません）。";
  const hintParagraph =
    searchHint !== undefined ? searchHint : isCompact ? null : defaultListHint;

  return (
    <div
      ref={wrapRef}
      className={isCompact ? "relative w-full space-y-1.5" : "relative space-y-1.5 sm:col-span-2"}
    >
      {isCompact ? null : (
        <Label htmlFor="lesson-records-student-search">生徒</Label>
      )}
      {!hideStudentField ? (
        <input type="hidden" name="student_id" value={studentId} readOnly />
      ) : null}
      <div className="relative flex gap-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="lesson-records-student-search"
          autoComplete="off"
          aria-label={isCompact ? "生徒を検索" : undefined}
          placeholder={
            isCompact ? "氏名・かなで検索" : "氏名・ふりがなの一部で検索し、一覧から選ぶ"
          }
          className="flex-1 pl-9 pr-9"
          value={query}
          onChange={(e) => {
            if (onQueryEdit) {
              skipQuerySyncFromParentRef.current = true;
              onQueryEdit();
            }
            setQuery(e.target.value);
            setStudentId("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 shrink-0 text-muted-foreground"
            onClick={clearSelection}
            aria-label="クリア"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {showSuggestions && filtered.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border bg-background py-1 shadow-md"
        >
          {filtered.map((s) => (
            <li key={s.student_id} role="option">
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted/80"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <span className="font-medium">{fullName(s)}</span>
                <span className="text-xs text-muted-foreground">
                  {[s.last_name_kana, s.first_name_kana].filter(Boolean).join(" ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showSuggestions && filtered.length === 0 ? (
        <p className="absolute left-0 top-full z-30 mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md">
          該当する生徒がありません
        </p>
      ) : null}

      {hintParagraph ? (
        <p className="text-[11px] text-muted-foreground">{hintParagraph}</p>
      ) : null}
    </div>
  );
}
