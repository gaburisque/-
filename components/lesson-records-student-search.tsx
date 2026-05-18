"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";

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
  selectedStudentId
}: {
  students: LessonRecordsStudentSearchOption[];
  selectedStudentId?: string;
}) {
  const selected = students.find((s) => s.student_id === selectedStudentId);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState(selectedStudentId ?? "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudentId(selectedStudentId ?? "");
    if (selected) {
      setQuery(
        `${fullName(selected)}${selected.grade ? ` · ${formatGrade(selected.grade)}` : ""}`
      );
    } else {
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
    setQuery(`${fullName(s)}${s.grade ? ` · ${formatGrade(s.grade)}` : ""}`);
    setOpen(false);
  }

  function clearSelection() {
    setStudentId("");
    setQuery("");
    setOpen(false);
  }

  const showSuggestions = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative space-y-1.5 sm:col-span-2">
      <Label htmlFor="lesson-records-student-search">生徒</Label>
      <input type="hidden" name="student_id" value={studentId} readOnly />
      <div className="relative flex gap-2">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          id="lesson-records-student-search"
          autoComplete="off"
          placeholder="氏名・ふりがなの一部で検索し、一覧から選ぶ"
          className="flex-1 pl-9 pr-9"
          value={query}
          onChange={(e) => {
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
                  {s.grade ? ` · ${formatGrade(s.grade)}` : ""}
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

      <p className="text-[11px] text-muted-foreground">
        リストから選ぶとその生徒に絞り込みます（入力だけでは絞り込みません）。
      </p>
    </div>
  );
}
