import { fullName } from "@/lib/format";
import type { LessonRecord } from "@/lib/types";

export const lessonRecordSortOptions = [
  { value: "lesson_date_desc", label: "授業日: 新しい順" },
  { value: "lesson_date_asc", label: "授業日: 古い順" },
  { value: "student_asc", label: "生徒名: 昇順" },
  { value: "student_desc", label: "生徒名: 降順" },
  { value: "course_asc", label: "コース: 昇順" },
  { value: "course_desc", label: "コース: 降順" },
  { value: "updated_desc", label: "更新日: 新しい順" }
] as const;

export type LessonRecordSort = (typeof lessonRecordSortOptions)[number]["value"];

export function parseLessonRecordSort(value: string | undefined): LessonRecordSort {
  return lessonRecordSortOptions.some((option) => option.value === value)
    ? (value as LessonRecordSort)
    : "lesson_date_desc";
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "", "ja");
}

function compareDate(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "");
}

export function sortLessonRecords(records: LessonRecord[], sort: LessonRecordSort) {
  return [...records].sort((a, b) => {
    switch (sort) {
      case "lesson_date_asc":
        return (
          compareDate(a.lesson_date, b.lesson_date) ||
          compareText(a.start_time, b.start_time) ||
          compareDate(a.created_at, b.created_at)
        );
      case "student_asc":
        return compareText(a.students ? fullName(a.students) : "", b.students ? fullName(b.students) : "");
      case "student_desc":
        return compareText(b.students ? fullName(b.students) : "", a.students ? fullName(a.students) : "");
      case "course_asc":
        return compareText(a.courses?.course_name, b.courses?.course_name);
      case "course_desc":
        return compareText(b.courses?.course_name, a.courses?.course_name);
      case "updated_desc":
        return compareDate(b.updated_at, a.updated_at);
      case "lesson_date_desc":
      default:
        return (
          compareDate(b.lesson_date, a.lesson_date) ||
          compareText(b.start_time, a.start_time) ||
          compareDate(b.created_at, a.created_at)
        );
    }
  });
}
