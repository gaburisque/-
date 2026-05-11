import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select(
      "last_name,first_name,last_name_kana,first_name_kana,grade,birth_date,gender,phone,email,status,notes,schools(school_name)"
    )
    .order("last_name_kana", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "姓",
    "名",
    "姓（かな）",
    "名（かな）",
    "学年",
    "学校",
    "生年月日",
    "性別",
    "電話番号",
    "メール",
    "状態",
    "メモ"
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = (students ?? []).map((s) => {
    const school = Array.isArray(s.schools) ? s.schools[0] : s.schools;
    return [
      s.last_name,
      s.first_name,
      s.last_name_kana ?? "",
      s.first_name_kana ?? "",
      s.grade ?? "",
      (school as { school_name: string } | null)?.school_name ?? "",
      s.birth_date ?? "",
      s.gender ?? "",
      s.phone ?? "",
      s.email ?? "",
      s.status,
      s.notes ?? ""
    ]
      .map((v) => escape(String(v)))
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students_${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
