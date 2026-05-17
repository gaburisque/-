"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName } from "@/lib/courses";
import { formatGrade } from "@/lib/grades";
import { one } from "@/lib/relations";
import type { Enrollment, Staff } from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";

// ドット色だけコースで変える（背景は白に統一してコンパクトに）
const COURSE_DOT: Record<string, string> = {
  Scratch: "bg-blue-400",
  Roblox: "bg-green-500",
  ITオンライン部: "bg-purple-500",
  イラスト: "bg-orange-400"
};

type AssignmentMap = Map<string, { assignment_id: string | null; staff_id: string; staff_name: string }>;

type Props = {
  enrollments: Enrollment[];
  assignmentMap: AssignmentMap;
  staffList: Staff[];
  timeSlots: string[];
};

type EditState = { enrollmentId: string; staffId: string };

export function ScheduleGrid({ enrollments, assignmentMap, staffList, timeSlots }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(weekdayOptions[0]);

  const gridByWeekdayTime = new Map<string, Enrollment[]>();
  for (const enrollment of enrollments) {
    const weekday = enrollment.weekday ?? "";
    const time = enrollment.start_time?.slice(0, 5) ?? "";
    if (!weekday || !time) continue;
    const key = `${weekday}::${time}`;
    const list = gridByWeekdayTime.get(key) ?? [];
    list.push(enrollment);
    gridByWeekdayTime.set(key, list);
  }

  // 選択曜日に受講者がいる時間帯のみ
  const activeTimes = timeSlots.filter((t) => (gridByWeekdayTime.get(`${selectedDay}::${t}`) ?? []).length > 0);

  async function handleSave(enrollmentId: string, staffId: string) {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("enrollment_id", enrollmentId);
      formData.set("staff_id", staffId);
      const res = await fetch("/api/schedule/assignment", { method: "POST", body: formData });
      if (!res.ok) {
        setError((await res.text()) || "保存に失敗しました");
      } else {
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 曜日タブ */}
      <div className="flex gap-1 flex-wrap">
        {weekdayOptions.map((day) => {
          const count = timeSlots.reduce(
            (n, t) => n + (gridByWeekdayTime.get(`${day}::${t}`) ?? []).length,
            0
          );
          return (
            <button
              key={day}
              onClick={() => { setSelectedDay(day); setEditing(null); }}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedDay === day
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {day}曜
              {count > 0 && (
                <span className={`ml-1 text-xs font-normal ${selectedDay === day ? "opacity-80" : "opacity-60"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* コース凡例 */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(COURSE_DOT).map(([name, dot]) => (
          <span key={name} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
            {name}
          </span>
        ))}
      </div>

      {/* コンパクトテーブル */}
      {activeTimes.length === 0 ? (
        <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
          {selectedDay}曜日に受講中の生徒がいません
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="w-16 border-r px-3 py-2 text-left text-xs font-semibold text-muted-foreground">時間</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">生徒</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">コース</th>
                <th className="w-40 px-3 py-2 text-left text-xs font-semibold text-muted-foreground">担当講師</th>
                <th className="w-16 px-3 py-2 text-xs font-semibold text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {activeTimes.map((time) => {
                const cells = gridByWeekdayTime.get(`${selectedDay}::${time}`) ?? [];
                return cells.map((enrollment, idx) => {
                  const student = one(enrollment.students);
                  const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
                  const assignment = assignmentMap.get(enrollment.enrollment_id);
                  const isEditing = editing?.enrollmentId === enrollment.enrollment_id;
                  const dot = COURSE_DOT[courseName ?? ""] ?? "bg-gray-300";

                  return (
                    <tr
                      key={enrollment.enrollment_id}
                      className={`border-b last:border-b-0 ${isEditing ? "bg-muted/30" : "hover:bg-muted/20"}`}
                    >
                      {/* 時間セル：同時間帯の先頭行だけ表示 */}
                      {idx === 0 ? (
                        <td
                          rowSpan={cells.length}
                          className="border-r bg-muted/30 px-3 py-2 text-center align-middle text-xs font-semibold text-muted-foreground whitespace-nowrap"
                        >
                          {time}
                        </td>
                      ) : null}

                      <td className="px-3 py-1.5">
                        <div className="font-medium leading-tight">
                          {student ? `${student.last_name} ${student.first_name}` : "-"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{formatGrade(student?.grade)}</div>
                      </td>

                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-1 text-xs">
                          <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                          {courseName || "-"}
                        </span>
                      </td>

                      {/* 担当列 */}
                      <td className="px-3 py-1.5">
                        {isEditing ? (
                          <NativeSelect
                            value={editing.staffId}
                            onChange={(e) =>
                              setEditing({ enrollmentId: enrollment.enrollment_id, staffId: e.target.value })
                            }
                            className="h-7 text-xs"
                            disabled={saving}
                          >
                            <option value="">未割当</option>
                            {staffList.map((s) => (
                              <option key={s.staff_id} value={s.staff_id}>
                                {s.name}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : assignment?.staff_name ? (
                          <span className="text-sm font-medium">{assignment.staff_name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">未割当</span>
                        )}
                      </td>

                      {/* 編集ボタン列 */}
                      <td className="px-2 py-1.5 text-right">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => handleSave(enrollment.enrollment_id, editing.staffId)}
                              disabled={saving}
                              className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                            >
                              {saving ? "…" : "保存"}
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              disabled={saving}
                              className="rounded border px-2 py-1 text-[11px]"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setEditing({
                                enrollmentId: enrollment.enrollment_id,
                                staffId: assignment?.staff_id ?? ""
                              })
                            }
                            className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted transition"
                          >
                            編集
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
