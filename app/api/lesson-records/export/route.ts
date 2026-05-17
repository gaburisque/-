import { NextRequest, NextResponse } from "next/server";

import { normalizeCourseName } from "@/lib/courses";
import { formatDate, formatTime, fullName } from "@/lib/format";
import { formatGrade } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  substitute: "振替"
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const studentId = searchParams.get("student_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const year = searchParams.get("year");

  let query = supabase
    .from("lesson_records")
    .select(
      "lesson_date,start_time,end_time,attendance_status,title,content,homework,memo,students(last_name,first_name,grade),courses(course_name),staff(name)"
    )
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: false, nullsFirst: false });

  if (studentId) query = query.eq("student_id", studentId);
  if (year) {
    query = query.gte("lesson_date", `${year}-01-01`).lte("lesson_date", `${year}-12-31`);
  } else {
    if (from) query = query.gte("lesson_date", from);
    if (to) query = query.lte("lesson_date", to);
  }

  const { data: records, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "授業日",
    "開始",
    "終了",
    "生徒名",
    "学年",
    "コース",
    "担当講師",
    "出欠",
    "タイトル",
    "授業内容",
    "宿題・次回予定",
    "メモ"
  ];

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

  const rows = (records ?? []).map((r) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    const course = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    const staff = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    return [
      formatDate(r.lesson_date),
      formatTime(r.start_time),
      formatTime(r.end_time),
      student ? fullName(student as { last_name: string; first_name: string }) : "",
      student ? (formatGrade((student as { grade?: string | null }).grade) ?? "") : "",
      normalizeCourseName((course as { course_name?: string } | null)?.course_name),
      (staff as { name?: string } | null)?.name ?? "",
      r.attendance_status ? (ATTENDANCE_LABELS[r.attendance_status] ?? r.attendance_status) : "",
      r.title ?? "",
      r.content ?? "",
      r.homework ?? "",
      r.memo ?? ""
    ]
      .map((v) => escape(String(v)))
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const bom = "\uFEFF";
  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lesson_records_${dateStr}.csv"`
    }
  });
}
