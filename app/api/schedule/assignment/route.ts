import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const formData = await request.formData();
  const enrollmentId = String(formData.get("enrollment_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();

  if (!enrollmentId) {
    return new NextResponse("enrollment_id is required", { status: 400 });
  }

  if (!staffId) {
    const { error } = await supabase
      .from("lesson_assignments")
      .delete()
      .eq("enrollment_id", enrollmentId);
    if (error) return new NextResponse(error.message, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("lesson_assignments")
    .upsert({ enrollment_id: enrollmentId, staff_id: staffId }, { onConflict: "enrollment_id" });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
