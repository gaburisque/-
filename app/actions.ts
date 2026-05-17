"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isCurrentUserAdmin } from "@/lib/authz";
import { normalizeGrade } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";

function optionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function requiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function structuredNote(items: Array<[string, string | null]>) {
  return items
    .filter(([, value]) => value && value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n\n");
}

async function ensureCurrentStaffId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: existingStaff } = await supabase
    .from("staff")
    .select("staff_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (existingStaff?.staff_id) {
    return existingStaff.staff_id;
  }

  // Security hardening: staff rows should be provisioned by admin.
  // If the current auth user has no linked staff row yet, caller falls back to null.
  return null;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = requiredText(formData, "email");
  const password = requiredText(formData, "password");
  const next = optionalText(formData, "next") ?? "/dashboard";

  const { error } = await supabase.auth
    .signInWithPassword({ email, password })
    .catch(() => ({
      error: new Error("Supabaseに接続できません。.env.local の設定を確認してください。")
    }));

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(
        error.message.includes("Supabase")
          ? error.message
          : "メールアドレスまたはパスワードを確認してください"
      )}`
    );
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  redirect(
    `/login?error=${encodeURIComponent(
      "新規登録は停止中です。管理者にアカウント作成を依頼してください。"
    )}`
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createStudent(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .insert({
      last_name: requiredText(formData, "last_name"),
      first_name: requiredText(formData, "first_name"),
      last_name_kana: optionalText(formData, "last_name_kana"),
      first_name_kana: optionalText(formData, "first_name_kana"),
      grade: normalizeGrade(optionalText(formData, "grade")),
      school_id: optionalText(formData, "school_id"),
      birth_date: optionalText(formData, "birth_date"),
      gender: optionalText(formData, "gender"),
      phone: optionalText(formData, "phone"),
      email: optionalText(formData, "email"),
      notes: optionalText(formData, "notes")
    })
    .select("student_id")
    .single();

  if (error) throw error;

  revalidatePath("/students");
  redirect(`/students/${data.student_id}`);
}

export async function updateStudent(formData: FormData) {
  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase
    .from("students")
    .update({
      last_name: requiredText(formData, "last_name"),
      first_name: requiredText(formData, "first_name"),
      last_name_kana: optionalText(formData, "last_name_kana"),
      first_name_kana: optionalText(formData, "first_name_kana"),
      grade: normalizeGrade(optionalText(formData, "grade")),
      school_id: optionalText(formData, "school_id"),
      birth_date: optionalText(formData, "birth_date"),
      gender: optionalText(formData, "gender"),
      phone: optionalText(formData, "phone"),
      email: optionalText(formData, "email"),
      status: requiredText(formData, "status"),
      notes: optionalText(formData, "notes")
    })
    .eq("student_id", studentId);

  if (error) throw error;

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
}

export async function addGuardian(formData: FormData) {
  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase.from("guardians").insert({
    student_id: studentId,
    last_name: requiredText(formData, "guardian_last_name"),
    first_name: requiredText(formData, "guardian_first_name"),
    relationship: requiredText(formData, "relationship"),
    phone: optionalText(formData, "guardian_phone"),
    email: optionalText(formData, "guardian_email"),
    is_primary: formData.get("is_primary") === "on",
    notes: optionalText(formData, "guardian_notes")
  });

  if (error) throw error;

  revalidatePath(`/students/${studentId}`);
}

export async function addEmergencyContact(formData: FormData) {
  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase.from("emergency_contacts").insert({
    student_id: studentId,
    name: requiredText(formData, "contact_name"),
    relationship: optionalText(formData, "contact_relationship"),
    phone: requiredText(formData, "contact_phone"),
    priority: Number(formData.get("priority") ?? 1),
    notes: optionalText(formData, "contact_notes")
  });

  if (error) throw error;

  revalidatePath(`/students/${studentId}`);
}

export async function addEnrollment(formData: FormData) {
  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase.from("enrollments").insert({
    student_id: studentId,
    course_id: requiredText(formData, "course_id"),
    schedule_label: optionalText(formData, "schedule_label"),
    weekday: optionalText(formData, "weekday"),
    start_time: optionalText(formData, "enrollment_start_time"),
    frequency: optionalText(formData, "frequency"),
    start_date: optionalText(formData, "start_date"),
    end_date: optionalText(formData, "end_date"),
    status: requiredText(formData, "enrollment_status")
  });

  if (error) throw error;

  revalidatePath(`/students/${studentId}`);
}

export async function updateEnrollmentSchedule(formData: FormData) {
  const supabase = await createClient();
  const enrollmentId = requiredText(formData, "enrollment_id");
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase
    .from("enrollments")
    .update({
      weekday: optionalText(formData, "weekday"),
      start_time: optionalText(formData, "enrollment_start_time"),
      frequency: optionalText(formData, "frequency"),
      schedule_label: optionalText(formData, "schedule_label"),
      status: requiredText(formData, "enrollment_status")
    })
    .eq("enrollment_id", enrollmentId);

  if (error) throw error;

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/lesson-records/new");
}

export async function createStaffProfile(formData: FormData) {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("権限がありません。");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("staff").insert({
    name: requiredText(formData, "name"),
    email: optionalText(formData, "email"),
    role: requiredText(formData, "role")
  });

  if (error) throw error;

  revalidatePath("/staff");
}

export async function updateStaffProfile(formData: FormData) {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("権限がありません。");
  }

  const supabase = await createClient();
  const staffId = requiredText(formData, "staff_id");

  const { error } = await supabase
    .from("staff")
    .update({
      name: requiredText(formData, "name"),
      email: optionalText(formData, "email"),
      role: requiredText(formData, "role")
    })
    .eq("staff_id", staffId);

  if (error) throw error;

  revalidatePath("/staff");
  revalidatePath("/lesson-records/new");
}

export async function deleteUnlinkedStaffProfiles() {
  if (!(await isCurrentUserAdmin())) {
    throw new Error("権限がありません。");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("staff")
    .delete()
    .is("auth_user_id", null)
    .is("email", null);

  if (error) throw error;

  revalidatePath("/staff");
  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
}

export async function addLessonRecord(formData: FormData) {
  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");
  const staffId = await ensureCurrentStaffId(supabase);
  const attendance = optionalText(formData, "attendance_status");
  const content = optionalText(formData, "content");
  const typingTool = optionalText(formData, "typing_tool");
  const typingNote = optionalText(formData, "typing_note");

  const { error } = await supabase.from("lesson_records").insert({
    student_id: studentId,
    course_id: optionalText(formData, "course_id"),
    staff_id: staffId,
    lesson_date: requiredText(formData, "lesson_date"),
    start_time: optionalText(formData, "start_time"),
    end_time: optionalText(formData, "end_time"),
    title: optionalText(formData, "title"),
    content:
      structuredNote([
        ["受講", attendance],
        ["内容", content],
        ["タイピングツール", typingTool],
        ["タイピングの様子", typingNote]
      ]) || null,
    homework: optionalText(formData, "homework"),
    memo: optionalText(formData, "memo")
  });

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/lesson-records");
  revalidatePath(`/students/${studentId}`);
}

export async function updateLessonRecord(formData: FormData) {
  const supabase = await createClient();
  const lessonRecordId = requiredText(formData, "lesson_record_id");
  const studentId = requiredText(formData, "student_id");
  const staffId = await ensureCurrentStaffId(supabase);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("lesson_records")
    .select("lesson_date,attendance_status,title,content,homework,memo")
    .eq("lesson_record_id", lessonRecordId)
    .single();

  if (existing) {
    await supabase.from("lesson_record_history").insert({
      lesson_record_id: lessonRecordId,
      changed_by: user?.id ?? null,
      lesson_date: existing.lesson_date,
      attendance_status: existing.attendance_status,
      title: existing.title,
      content: existing.content,
      homework: existing.homework,
      memo: existing.memo
    });
  }

  const { error } = await supabase
    .from("lesson_records")
    .update({
      lesson_date: requiredText(formData, "lesson_date"),
      course_id: optionalText(formData, "course_id"),
      start_time: optionalText(formData, "start_time"),
      end_time: optionalText(formData, "end_time"),
      title: optionalText(formData, "title"),
      content: optionalText(formData, "content"),
      homework: optionalText(formData, "homework"),
      memo: optionalText(formData, "memo"),
      staff_id: staffId
    })
    .eq("lesson_record_id", lessonRecordId);

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/lesson-records");
  revalidatePath(`/lesson-records/${lessonRecordId}`);
  revalidatePath(`/students/${studentId}`);
}

export async function updateAttendanceStatus(formData: FormData) {
  const supabase = await createClient();
  const lessonRecordId = requiredText(formData, "lesson_record_id");
  const date = optionalText(formData, "date") ?? "";
  const status = optionalText(formData, "attendance_status");

  const { error } = await supabase
    .from("lesson_records")
    .update({ attendance_status: status })
    .eq("lesson_record_id", lessonRecordId);

  if (error) throw error;

  revalidatePath("/attendance");
  redirect(`/attendance?date=${date}`);
}

export async function upsertLessonAssignment(formData: FormData) {
  const supabase = await createClient();
  const enrollmentId = requiredText(formData, "enrollment_id");
  const weekday = optionalText(formData, "weekday") ?? "";
  const staffIdValue = optionalText(formData, "staff_id");

  if (!staffIdValue) {
    await supabase.from("lesson_assignments").delete().eq("enrollment_id", enrollmentId);
  } else {
    await supabase
      .from("lesson_assignments")
      .upsert({ enrollment_id: enrollmentId, staff_id: staffIdValue }, { onConflict: "enrollment_id" });
  }

  revalidatePath("/schedule");
  redirect(`/schedule?weekday=${weekday}`);
}

export async function addScheduledLessonRecord(formData: FormData) {
  const supabase = await createClient();
  const enrollmentId = requiredText(formData, "enrollment_id");
  const staffId = await ensureCurrentStaffId(supabase);
  const goal = optionalText(formData, "goal");
  const typingTool = optionalText(formData, "typing_tool");
  const typingNote = optionalText(formData, "typing_note");
  const lessonTool = optionalText(formData, "lesson_tool");
  const lessonNote = optionalText(formData, "lesson_note");
  const excitementNote = optionalText(formData, "excitement_note");
  const nextPlan = optionalText(formData, "next_plan");
  const remarks = optionalText(formData, "remarks");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("student_id,course_id,start_time")
    .eq("enrollment_id", enrollmentId)
    .single();

  if (enrollmentError || !enrollment) {
    throw enrollmentError ?? new Error("Enrollment not found.");
  }

  const { data, error } = await supabase
    .from("lesson_records")
    .insert({
      student_id: enrollment.student_id,
      course_id: enrollment.course_id,
      staff_id: staffId,
      lesson_date: requiredText(formData, "lesson_date"),
      start_time: optionalText(formData, "start_time") ?? enrollment.start_time,
      end_time: optionalText(formData, "end_time"),
      title: goal,
      content:
        structuredNote([
          ["今日の目的", goal],
          ["タイピング使用ツール", typingTool],
          ["タイピングの様子", typingNote],
          ["レッスン使用ツール", lessonTool],
          ["レッスンの様子", lessonNote],
          ["今日のワクワクの様子", excitementNote]
        ]) || null,
      homework: nextPlan,
      memo: remarks
    })
    .select("lesson_record_id")
    .single();

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
  revalidatePath(`/students/${enrollment.student_id}`);
  redirect(`/lesson-records/${data.lesson_record_id}`);
}
