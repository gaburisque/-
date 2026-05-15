"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { normalizeCourseName } from "@/lib/courses";
import { formatGrade } from "@/lib/grades";
import { one } from "@/lib/relations";
import type { Enrollment, Staff } from "@/lib/types";
import { weekdayOptions } from "@/lib/weekdays";

const COURSE_COLORS: Record<string, string> = {
  Scratch: "bg-blue-50 border-blue-200 text-blue-900",
  Roblox: "bg-green-50 border-green-200 text-green-900",
  ITオンライン部: "bg-purple-50 border-purple-200 text-purple-900",
  イラスト: "bg-orange-50 border-orange-200 text-orange-900"
};

type AssignmentMap = Map<string, { assignment_id: string | null; staff_id: string; staff_name: string }>;

type Props = {
  enrollments: Enrollment[];
  assignmentMap: AssignmentMap;
  staffList: Staff[];
  timeSlots: string[];
};

type EditState = {
  enrollmentId: string;
  staffId: string;
};

function formatTimeLabel(t: string) {
  return t.slice(0, 5);
}

export function ScheduleGrid({ enrollments, assignmentMap, staffList, timeSlots }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave(enrollmentId: string, staffId: string, weekday: string) {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("enrollment_id", enrollmentId);
      formData.set("staff_id", staffId);
      formData.set("weekday", weekday);

      const res = await fetch("/api/schedule/assignment", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "保存に失敗しました");
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
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-20 border-b border-r px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                時間
              </th>
              {weekdayOptions.map((day) => (
                <th
                  key={day}
                  className="min-w-[140px] border-b border-r px-3 py-2 text-center text-xs font-semibold"
                >
                  {day}曜
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((time) => (
              <tr key={time} className="border-b last:border-b-0">
                <td className="border-r bg-muted/30 px-3 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap align-top">
                  {formatTimeLabel(time)}
                </td>
                {weekdayOptions.map((day) => {
                  const key = `${day}::${time}`;
                  const cells = gridByWeekdayTime.get(key) ?? [];
                  return (
                    <td key={day} className="border-r px-1 py-1 align-top">
                      <div className="flex flex-col gap-1">
                        {cells.length === 0 ? (
                          <div className="h-16" />
                        ) : (
                          cells.map((enrollment) => {
                            const student = one(enrollment.students);
                            const courseName = normalizeCourseName(one(enrollment.courses)?.course_name);
                            const assignment = assignmentMap.get(enrollment.enrollment_id);
                            const isEditing = editing?.enrollmentId === enrollment.enrollment_id;
                            const colorClass = COURSE_COLORS[courseName ?? ""] ?? "bg-gray-50 border-gray-200 text-gray-800";

                            return (
                              <div
                                key={enrollment.enrollment_id}
                                className={`rounded border p-1.5 text-xs ${colorClass}`}
                              >
                                <div className="font-semibold leading-tight">
                                  {student ? `${student.last_name} ${student.first_name}` : "-"}
                                </div>
                                <div className="text-[11px] opacity-70">
                                  {formatGrade(student?.grade)} {courseName}
                                </div>

                                {isEditing ? (
                                  <div className="mt-1.5 flex flex-col gap-1">
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
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() =>
                                          handleSave(enrollment.enrollment_id, editing.staffId, day)
                                        }
                                        disabled={saving}
                                        className="flex-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
                                      >
                                        {saving ? "保存中…" : "保存"}
                                      </button>
                                      <button
                                        onClick={() => setEditing(null)}
                                        disabled={saving}
                                        className="flex-1 rounded border px-2 py-0.5 text-[11px]"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setEditing({
                                        enrollmentId: enrollment.enrollment_id,
                                        staffId: assignment?.staff_id ?? ""
                                      })
                                    }
                                    className="mt-1 w-full rounded px-1 py-0.5 text-left text-[11px] transition hover:bg-black/5"
                                  >
                                    {assignment?.staff_name ? (
                                      <span className="font-medium">👤 {assignment.staff_name}</span>
                                    ) : (
                                      <span className="italic opacity-50">担当未設定 (タップで編集)</span>
                                    )}
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
