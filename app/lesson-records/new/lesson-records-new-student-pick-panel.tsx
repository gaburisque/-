"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  LessonRecordsStudentSearch,
  type LessonRecordsStudentSearchOption
} from "@/components/lesson-records-student-search";
import { normalizeCourseName } from "@/lib/courses";
import { formatTime, fullName } from "@/lib/format";
import { lessonRecordsNewHrefFromFields } from "@/lib/lesson-records-new-url";
import { one } from "@/lib/relations";
import type { Enrollment } from "@/lib/types";

type Props = {
  students: LessonRecordsStudentSearchOption[];
  allEnrollments: Enrollment[];
  weekday: string;
  selectedDate: string;
  /** URL の student_id（ブックマーク直叩きなど）。クライアント選択では URL は変えない */
  urlStudentId: string;
  selectedEnrollmentId: string;
};

export function LessonRecordsNewStudentPickPanel({
  students,
  allEnrollments,
  weekday,
  selectedDate,
  urlStudentId,
  selectedEnrollmentId
}: Props) {
  const router = useRouter();
  const [pickedStudentId, setPickedStudentId] = useState(urlStudentId);
  /** 検索で生徒を選んだときだけ、受講1件なら URL に enrollment を付ける */
  const userPickedStudentRef = useRef(false);

  /** 記録登録後など enrollment が外れたら、検索表示を先にクリア（単一受講の自動再オープンを防ぐ） */
  useLayoutEffect(() => {
    if (!selectedEnrollmentId && !urlStudentId) {
      setPickedStudentId("");
      userPickedStudentRef.current = false;
    }
  }, [selectedEnrollmentId, urlStudentId]);

  /** 一覧・複数受講リンクで enrollment が変わったら、その受講の生徒と検索表示を揃える */
  useEffect(() => {
    if (selectedEnrollmentId) {
      const en = allEnrollments.find((e) => e.enrollment_id === selectedEnrollmentId);
      if (en) setPickedStudentId(en.student_id);
      return;
    }
    if (!urlStudentId) return;
    /** student_id だけ付いたブックマーク用 */
    setPickedStudentId(urlStudentId);
  }, [selectedEnrollmentId, urlStudentId, allEnrollments]);

  const enrollmentsForPicked = useMemo(() => {
    if (!pickedStudentId) return [];
    return allEnrollments.filter((e) => e.student_id === pickedStudentId);
  }, [pickedStudentId, allEnrollments]);

  /** 現在 URL の受講が、この検索で選んだ生徒の受講のいずれかと一致しているか */
  const viewingPickedEnrollment =
    Boolean(selectedEnrollmentId) &&
    enrollmentsForPicked.some((e) => e.enrollment_id === selectedEnrollmentId);

  /**
   * 検索だけで受講が1件のとき URL に enrollment を付ける。
   * URL に既に enrollment がある間は計算しない（一覧クリック直後は picked が旧生徒のまま1フレーム残り、
   * 単一受講の自動 replace が選んだ enrollment を上書きして無限ループになるため）。
   */
  const soleEnrollmentId =
    !selectedEnrollmentId &&
    pickedStudentId &&
    enrollmentsForPicked.length === 1
      ? enrollmentsForPicked[0].enrollment_id
      : null;

  useEffect(() => {
    if (!soleEnrollmentId) return;
    if (!userPickedStudentRef.current) return;
    if (selectedEnrollmentId === soleEnrollmentId) return;
    router.replace(
      lessonRecordsNewHrefFromFields({
        weekday,
        date: selectedDate,
        enrollmentId: soleEnrollmentId
      }),
      { scroll: false }
    );
  }, [soleEnrollmentId, selectedEnrollmentId, weekday, selectedDate, router]);

  /** 日付・曜日のみ（student_id / enrollment_id は付けない） */
  function replaceBaseQueryOnly() {
    router.replace(
      lessonRecordsNewHrefFromFields({
        weekday,
        date: selectedDate
      }),
      { scroll: false }
    );
  }

  function stripStudentFromUrlKeepingEnrollment() {
    router.replace(
      lessonRecordsNewHrefFromFields({
        weekday,
        date: selectedDate,
        enrollmentId: selectedEnrollmentId || undefined
      }),
      { scroll: false }
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-xs font-semibold leading-tight text-foreground">
            生徒を検索
          </span>
        </div>
        <LessonRecordsStudentSearch
          compact
          omitHiddenStudentField
          students={students}
          selectedStudentId={pickedStudentId || undefined}
          inputNavigateBase={{ weekday, date: selectedDate }}
          onPickStudent={(id) => {
            userPickedStudentRef.current = true;
            setPickedStudentId(id);
            const nextEnrs = allEnrollments.filter((e) => e.student_id === id);
            const keepsCurrentEnrollment = nextEnrs.some(
              (e) => e.enrollment_id === selectedEnrollmentId
            );
            if (!keepsCurrentEnrollment) {
              replaceBaseQueryOnly();
            }
          }}
          onClearStudent={() => {
            userPickedStudentRef.current = false;
            setPickedStudentId("");
            stripStudentFromUrlKeepingEnrollment();
          }}
          onQueryEdit={() => {
            userPickedStudentRef.current = false;
            setPickedStudentId("");
            stripStudentFromUrlKeepingEnrollment();
          }}
        />
      </div>

      {enrollmentsForPicked.length > 1 && !viewingPickedEnrollment ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          <p>この生徒の受講が複数あります。記録するコースを選んでください。</p>
          <ul className="mt-2 space-y-1">
            {enrollmentsForPicked.map((enrollment) => {
              const student = one(enrollment.students);
              const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
              return (
                <li key={enrollment.enrollment_id}>
                  <Link
                    href={lessonRecordsNewHrefFromFields({
                      weekday,
                      date: selectedDate,
                      enrollmentId: enrollment.enrollment_id
                    })}
                    className="flex flex-wrap items-baseline gap-x-2 rounded-md border border-sky-200/80 bg-background/80 px-2 py-1.5 font-medium text-sky-950 hover:bg-background"
                  >
                    <span>{student ? fullName(student) : "-"}</span>
                    <span className="text-muted-foreground">
                      {courseName || "-"} ・ {formatTime(enrollment.start_time)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}
