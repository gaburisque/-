"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertCurrentUserIsAdmin, isCurrentUserAdmin } from "@/lib/authz";
import { nextGrade, normalizeGrade } from "@/lib/grades";
import {
  buildLessonRecordContent,
  lessonContentFieldsFromFormData,
  structuredLessonContent
} from "@/lib/lesson-record-content";
import { createClient } from "@/lib/supabase/server";
import {
  createStaffAdminClient,
  STAFF_LOGIN_BAN_DURATION
} from "@/lib/staff-auth-admin";
import { lessonRecordsNewHrefFromFields } from "@/lib/lesson-records-new-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveIsoDateParam, weekdayFromDate } from "@/lib/weekdays";

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
  const next = optionalText(formData, "next") ?? "/lesson-records/new";

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

export async function updateOwnPassword(formData: FormData) {
  const base = "/settings/account";
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`${base}?error=${encodeURIComponent("ログインが必要です。")}`);
  }

  const currentPassword = String(formData.get("current_password") ?? "").trim();
  const newPassword = String(formData.get("new_password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect(`${base}?error=${encodeURIComponent("すべての項目を入力してください。")}`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`${base}?error=${encodeURIComponent("新しいパスワードが一致しません。")}`);
  }
  if (newPassword.length < 8) {
    redirect(`${base}?error=${encodeURIComponent("新しいパスワードは8文字以上にしてください。")}`);
  }

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword
  });
  if (signErr) {
    redirect(`${base}?error=${encodeURIComponent("現在のパスワードが正しくありません。")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    redirect(`${base}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(base);
  redirect(`${base}?message=${encodeURIComponent("パスワードを更新しました。")}`);
}

export async function updateOwnEmail(formData: FormData) {
  void formData;
  redirect(
    `/settings/account?error=${encodeURIComponent(
      "ログイン用メールアドレスは変更できません。管理者にお問い合わせください。"
    )}`
  );
}

async function resolveSchoolIdFromSchoolName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schoolNameRaw: string | null | undefined
): Promise<string | null> {
  const trimmed = schoolNameRaw?.trim() ?? "";
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("schools")
    .select("school_id")
    .eq("school_name", trimmed)
    .maybeSingle();

  if (existing?.school_id) return existing.school_id;

  const { data: created, error } = await supabase
    .from("schools")
    .insert({ school_name: trimmed })
    .select("school_id")
    .single();

  if (error) throw error;
  return created.school_id;
}

export async function createStudent(formData: FormData) {
  await assertCurrentUserIsAdmin();

  const supabase = await createClient();

  const schoolId = await resolveSchoolIdFromSchoolName(supabase, optionalText(formData, "school_name"));

  const { data, error } = await supabase
    .from("students")
    .insert({
      last_name: requiredText(formData, "last_name"),
      first_name: requiredText(formData, "first_name"),
      last_name_kana: optionalText(formData, "last_name_kana"),
      first_name_kana: optionalText(formData, "first_name_kana"),
      grade: normalizeGrade(optionalText(formData, "grade")),
      school_id: schoolId,
      birth_date: optionalText(formData, "birth_date"),
      gender: optionalText(formData, "gender") || null,
      phone: optionalText(formData, "phone"),
      email: optionalText(formData, "email"),
      notes: optionalText(formData, "notes")
    })
    .select("student_id")
    .single();

  if (error) throw error;

  const studentId = data.student_id;

  const gLast = optionalText(formData, "guardian_last_name");
  const gFirst = optionalText(formData, "guardian_first_name");
  const gRel = optionalText(formData, "relationship");
  const gPhone = optionalText(formData, "guardian_phone");
  const gEmail = optionalText(formData, "guardian_email");
  const wantsGuardian = Boolean(
    gLast ||
      gFirst ||
      gRel ||
      gPhone ||
      gEmail ||
      formData.get("guardian_is_primary") === "on"
  );
  if (wantsGuardian) {
    if (!gLast || !gFirst || !gRel) {
      throw new Error("保護者を登録する場合は、姓・名・続柄を入力してください。");
    }
    const { error: gErr } = await supabase.from("guardians").insert({
      student_id: studentId,
      last_name: gLast,
      first_name: gFirst,
      relationship: gRel,
      phone: gPhone,
      email: gEmail,
      is_primary: formData.get("guardian_is_primary") === "on"
    });
    if (gErr) throw gErr;
  }

  const cName = optionalText(formData, "contact_name");
  const cRel = optionalText(formData, "contact_relationship");
  const cPhone = optionalText(formData, "contact_phone");
  const wantsContact = Boolean(cName || cRel || cPhone);
  if (wantsContact) {
    if (!cName || !cPhone) {
      throw new Error("緊急連絡先を登録する場合は、氏名と電話を入力してください。");
    }
    const rawPri = Number(formData.get("contact_priority") ?? 1);
    const priority = Number.isFinite(rawPri) && rawPri > 0 ? Math.floor(rawPri) : 1;
    const { error: cErr } = await supabase.from("emergency_contacts").insert({
      student_id: studentId,
      name: cName,
      relationship: cRel,
      phone: cPhone,
      priority
    });
    if (cErr) throw cErr;
  }

  const courseId = optionalText(formData, "course_id");
  if (courseId) {
    const weekday = optionalText(formData, "weekday");
    const startTime = optionalText(formData, "enrollment_start_time");
    let scheduleLabel: string | null = null;
    if (weekday && startTime) {
      scheduleLabel = `${weekday} ${startTime}`;
    } else if (weekday) {
      scheduleLabel = weekday;
    }

    const { error: eErr } = await supabase.from("enrollments").insert({
      student_id: studentId,
      course_id: courseId,
      schedule_label: scheduleLabel,
      weekday,
      start_time: startTime || null,
      frequency: optionalText(formData, "enrollment_frequency") ?? "weekly",
      start_date: optionalText(formData, "enrollment_start_date"),
      status: "active"
    });
    if (eErr) throw eErr;
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/lesson-records/new");
  revalidatePath("/schedule");
  redirect(`/students/${studentId}?message=${encodeURIComponent("生徒を登録しました。")}`);
}

export async function updateStudent(formData: FormData) {
  await assertCurrentUserIsAdmin();

  const supabase = await createClient();
  const studentId = requiredText(formData, "student_id");

  const { data: { user } } = await supabase.auth.getUser();

  const { data: existing } = await supabase
    .from("students")
    .select("last_name,first_name,last_name_kana,first_name_kana,grade,school_id,birth_date,gender,phone,email,status,notes")
    .eq("student_id", studentId)
    .single();

  const newValues: Record<string, string | null> = {
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
  };

  const { error } = await supabase
    .from("students")
    .update(newValues)
    .eq("student_id", studentId);

  if (error) throw error;

  if (existing) {
    const diffs = Object.entries(newValues)
      .filter(([k, v]) => String(existing[k as keyof typeof existing] ?? "") !== String(v ?? ""))
      .map(([k, v]) => ({
        student_id: studentId,
        changed_by: user?.id ?? null,
        field_name: k,
        old_value: String(existing[k as keyof typeof existing] ?? ""),
        new_value: String(v ?? "")
      }));
    if (diffs.length > 0) {
      await supabase.from("student_change_history").insert(diffs);
    }
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
}

export async function addGuardian(formData: FormData) {
  await assertCurrentUserIsAdmin();

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
  await assertCurrentUserIsAdmin();

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
  const staffUrl = "/staff";
  const staffErr = (msg: string): never =>
    redirect(`${staffUrl}?error=${encodeURIComponent(msg)}`);

  if (!(await isCurrentUserAdmin())) {
    staffErr("権限がありません。");
  }

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const createLogin = formData.get("create_login") === "on";
  const initialPassword = String(formData.get("initial_password") ?? "");

  if (!name) staffErr("名前を入力してください。");
  if (!role) staffErr("権限を選択してください。");

  const supabase = await createClient();

  if (!createLogin) {
    const { error } = await supabase.from("staff").insert({
      name,
      email: emailRaw.length > 0 ? emailRaw : null,
      role
    });
    if (error) staffErr(error.message);

    revalidatePath(staffUrl);
    redirect(`${staffUrl}?message=${encodeURIComponent("スタッフを追加しました（ログイン連携なし）。")}`);
  }

  if (!emailRaw) {
    staffErr("ログイン用アカウントを作成する場合はメールアドレスが必要です。");
  }
  if (initialPassword.length < 8) {
    staffErr("初回パスワードは8文字以上にしてください。");
  }

  const adminClient = ((): ReturnType<typeof createServiceRoleClient> => {
    try {
      return createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "サーバー設定を確認してください。";
      staffErr(msg);
      throw new Error("unreachable");
    }
  })();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: emailRaw,
    password: initialPassword,
    email_confirm: true
  });

  const createdUser = authData?.user ?? null;
  let userId: string;
  if (authError || !createdUser) {
    const raw = authError?.message?.toLowerCase() ?? "";
    const dup =
      raw.includes("already") ||
      raw.includes("registered") ||
      raw.includes("duplicate") ||
      authError?.status === 422;
    staffErr(
      dup
        ? "このメールアドレスは既に Authentication に登録されています。別のメールを使うか、既存ユーザーに staff を紐づけてください。"
        : authError?.message ?? "ログイン用アカウントの作成に失敗しました。"
    );
    throw new Error("unreachable");
  }
  userId = createdUser.id;

  const { error: insertError } = await supabase.from("staff").insert({
    auth_user_id: userId,
    name,
    email: emailRaw,
    role
  });

  if (insertError) {
    await adminClient.auth.admin.deleteUser(userId);
    staffErr(insertError.message);
  }

  revalidatePath(staffUrl);
  redirect(
    `${staffUrl}?message=${encodeURIComponent(
      "ログイン用アカウントを作成し、スタッフを追加しました。本人へ初回パスワードを安全な経路で共有してください。"
    )}`
  );
}

export async function updateStaffProfile(formData: FormData) {
  const staffUrl = "/staff";
  const staffErr = (msg: string): never =>
    redirect(`${staffUrl}?error=${encodeURIComponent(msg)}`);

  if (!(await isCurrentUserAdmin())) {
    staffErr("権限がありません。");
  }

  const supabase = await createClient();
  const staffId = requiredText(formData, "staff_id");
  const name = requiredText(formData, "name");
  const role = requiredText(formData, "role");

  if (role !== "admin" && role !== "staff") {
    staffErr("権限の値が不正です。");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("staff")
    .select("staff_id, auth_user_id, email")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (fetchError || !existing) {
    staffErr("スタッフが見つかりません。");
    throw new Error("unreachable");
  }

  const patch: { name: string; role: string; email?: string | null } = { name, role };

  if (!existing.auth_user_id) {
    patch.email = optionalText(formData, "email");
  }

  const { data: existingFull } = await supabase
    .from("staff")
    .select("name,role,email")
    .eq("staff_id", staffId)
    .single();

  const { error } = await supabase.from("staff").update(patch).eq("staff_id", staffId);

  if (error) staffErr(error.message);

  if (existingFull) {
    const { data: { user } } = await supabase.auth.getUser();
    const patchRecord = patch as Record<string, string | null | undefined>;
    const diffs = Object.entries(patchRecord)
      .filter(([k, v]) => String(existingFull[k as keyof typeof existingFull] ?? "") !== String(v ?? ""))
      .map(([k, v]) => ({
        staff_id: staffId,
        changed_by: user?.id ?? null,
        field_name: k,
        old_value: String(existingFull[k as keyof typeof existingFull] ?? ""),
        new_value: String(v ?? "")
      }));
    if (diffs.length > 0) {
      await supabase.from("staff_change_history").insert(diffs);
    }
  }

  revalidatePath(staffUrl);
  revalidatePath("/lesson-records/new");
  redirect(`${staffUrl}?message=${encodeURIComponent("スタッフ情報を保存しました。")}`);
}

export async function resetStaffLoginPassword(formData: FormData) {
  const staffUrl = "/staff";
  const staffErr = (msg: string): never =>
    redirect(`${staffUrl}?error=${encodeURIComponent(msg)}`);

  if (!(await isCurrentUserAdmin())) {
    staffErr("権限がありません。");
  }

  const staffId = requiredText(formData, "staff_id");
  const newPassword = String(formData.get("new_password") ?? "").trim();
  if (newPassword.length < 8) {
    staffErr("新しいパスワードは8文字以上にしてください。");
  }

  const supabase = await createClient();
  const { data: member, error: fetchError } = await supabase
    .from("staff")
    .select("staff_id, auth_user_id, name")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (fetchError || !member?.auth_user_id) {
    staffErr("ログイン連携のないスタッフにはパスワードを設定できません。");
    throw new Error("unreachable");
  }

  const authUserId = member.auth_user_id;
  const memberName = member.name;

  let adminClient: ReturnType<typeof createStaffAdminClient>;
  try {
    adminClient = createStaffAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバー設定を確認してください。";
    staffErr(msg);
    throw new Error("unreachable");
  }

  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    password: newPassword
  });
  if (error) staffErr(error.message);

  revalidatePath(staffUrl);
  redirect(
    `${staffUrl}?message=${encodeURIComponent(
      `${memberName} さんのログインパスワードを再設定しました。新しいパスワードを安全な経路で共有してください。`
    )}`
  );
}

export async function setStaffLoginEnabled(formData: FormData) {
  const staffUrl = "/staff";
  const staffErr = (msg: string): never =>
    redirect(`${staffUrl}?error=${encodeURIComponent(msg)}`);

  if (!(await isCurrentUserAdmin())) {
    staffErr("権限がありません。");
  }

  const staffId = requiredText(formData, "staff_id");
  const enabled = requiredText(formData, "enabled");
  if (enabled !== "true" && enabled !== "false") {
    staffErr("操作が不正です。");
  }

  const supabase = await createClient();
  const {
    data: { user: currentUser }
  } = await supabase.auth.getUser();

  const { data: member, error: fetchError } = await supabase
    .from("staff")
    .select("staff_id, auth_user_id, name")
    .eq("staff_id", staffId)
    .maybeSingle();

  if (fetchError || !member?.auth_user_id) {
    staffErr("ログイン連携のないスタッフは停止・再開できません。");
    throw new Error("unreachable");
  }

  const authUserId = member.auth_user_id;
  const memberName = member.name;

  if (enabled === "false" && authUserId === currentUser?.id) {
    staffErr("自分自身のログインは停止できません。");
    throw new Error("unreachable");
  }

  let adminClient: ReturnType<typeof createStaffAdminClient>;
  try {
    adminClient = createStaffAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバー設定を確認してください。";
    staffErr(msg);
    throw new Error("unreachable");
  }

  const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
    ban_duration: enabled === "true" ? "none" : STAFF_LOGIN_BAN_DURATION
  });
  if (error) staffErr(error.message);

  revalidatePath(staffUrl);
  redirect(
    `${staffUrl}?message=${encodeURIComponent(
      enabled === "true"
        ? `${memberName} さんのログインを再開しました。`
        : `${memberName} さんのログインを停止しました。記録者としての表示は残ります。`
    )}`
  );
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
      structuredLessonContent([
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
  const contentFields = lessonContentFieldsFromFormData(formData);
  const goal = contentFields.goal || null;

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
      attendance_status: optionalText(formData, "attendance_status"),
      start_time: optionalText(formData, "start_time"),
      end_time: optionalText(formData, "end_time"),
      title: goal,
      content: buildLessonRecordContent(contentFields),
      homework: optionalText(formData, "next_plan"),
      memo: optionalText(formData, "remarks"),
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

export async function deleteLessonRecord(formData: FormData) {
  const supabase = await createClient();
  const lessonRecordId = requiredText(formData, "lesson_record_id");
  const studentId = optionalText(formData, "student_id");
  const redirectTo = optionalText(formData, "redirect_to") ?? "/lesson-records";

  const { error } = await supabase
    .from("lesson_records")
    .delete()
    .eq("lesson_record_id", lessonRecordId);

  if (error) throw error;

  revalidatePath("/lesson-records");
  revalidatePath("/dashboard");
  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  redirect(redirectTo);
}

export async function bulkUpdateAttendanceStatus(formData: FormData) {
  const supabase = await createClient();
  const ids = formData.getAll("lesson_record_id") as string[];
  const statuses = formData.getAll("attendance_status") as string[];
  const date = optionalText(formData, "date") ?? "";

  await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("lesson_records")
        .update({ attendance_status: statuses[i] || null })
        .eq("lesson_record_id", id)
    )
  );

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
  const contentFields = lessonContentFieldsFromFormData(formData);
  const goal = contentFields.goal || null;
  const attendanceStatus = optionalText(formData, "attendance_status");

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("student_id,course_id,start_time")
    .eq("enrollment_id", enrollmentId)
    .single();

  if (enrollmentError || !enrollment) {
    throw enrollmentError ?? new Error("Enrollment not found.");
  }

  const { error } = await supabase.from("lesson_records").insert({
    student_id: enrollment.student_id,
    course_id: enrollment.course_id,
    staff_id: staffId,
    lesson_date: requiredText(formData, "lesson_date"),
    start_time: optionalText(formData, "start_time") ?? enrollment.start_time,
    end_time: optionalText(formData, "end_time"),
    attendance_status: attendanceStatus || null,
    title: goal,
    content: buildLessonRecordContent(contentFields),
    homework: optionalText(formData, "next_plan"),
    memo: optionalText(formData, "remarks")
  });

  if (error) throw error;

  const lessonDate = resolveIsoDateParam(requiredText(formData, "lesson_date"));
  const weekday = weekdayFromDate(lessonDate) ?? "";

  revalidatePath("/dashboard");
  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
  revalidatePath(`/students/${enrollment.student_id}`);

  redirect(
    lessonRecordsNewHrefFromFields({
      weekday,
      date: lessonDate,
      message: "記録を保存しました。"
    })
  );
}

export async function saveDraftLessonRecord(formData: FormData) {
  const supabase = await createClient();
  const enrollmentId = requiredText(formData, "enrollment_id");
  const staffId = await ensureCurrentStaffId(supabase);
  const contentFields = lessonContentFieldsFromFormData(formData);
  const goal = contentFields.goal || null;

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("student_id,course_id,start_time")
    .eq("enrollment_id", enrollmentId)
    .single();

  if (enrollmentError || !enrollment) {
    throw enrollmentError ?? new Error("Enrollment not found.");
  }

  const { error } = await supabase.from("lesson_records").insert({
    student_id: enrollment.student_id,
    course_id: enrollment.course_id,
    staff_id: staffId,
    lesson_date: requiredText(formData, "lesson_date"),
    start_time: optionalText(formData, "start_time") ?? enrollment.start_time,
    end_time: optionalText(formData, "end_time"),
    attendance_status: null,
    title: goal,
    content: buildLessonRecordContent(contentFields),
    homework: optionalText(formData, "next_plan"),
    memo: optionalText(formData, "remarks")
  });

  if (error) throw error;

  const draftDate = resolveIsoDateParam(requiredText(formData, "lesson_date"));
  const draftWeekday = weekdayFromDate(draftDate) ?? "";

  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
  revalidatePath(`/students/${enrollment.student_id}`);

  redirect(
    lessonRecordsNewHrefFromFields({
      weekday: draftWeekday,
      date: draftDate,
      message: "下書きを保存しました。"
    })
  );
}

export async function deleteEnrollment(formData: FormData) {
  const supabase = await createClient();
  const enrollmentId = requiredText(formData, "enrollment_id");
  const studentId = requiredText(formData, "student_id");

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("enrollment_id", enrollmentId);

  if (error) throw error;

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/lesson-records/new");
  revalidatePath("/schedule");
}

export async function bulkPromoteGrades() {
  await assertCurrentUserIsAdmin();

  const supabase = await createClient();

  const { data: students, error } = await supabase
    .from("students")
    .select("student_id,grade")
    .eq("status", "active");

  if (error) throw error;

  await Promise.all(
    (students ?? [])
      .filter((s) => normalizeGrade(s.grade) !== null)
      .map((s) =>
        supabase
          .from("students")
          .update({ grade: nextGrade(s.grade) })
          .eq("student_id", s.student_id)
      )
  );

  revalidatePath("/students");
  revalidatePath("/dashboard");
}

export async function createCourse(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("courses").insert({
    course_name: requiredText(formData, "course_name"),
    description: optionalText(formData, "description"),
    status: "active"
  });

  if (error) throw error;

  revalidatePath("/courses");
  revalidatePath("/lesson-records/new");
  revalidatePath("/students");
}

export async function updateCourse(formData: FormData) {
  const supabase = await createClient();
  const courseId = requiredText(formData, "course_id");

  const { error } = await supabase
    .from("courses")
    .update({
      course_name: requiredText(formData, "course_name"),
      description: optionalText(formData, "description"),
      status: requiredText(formData, "status")
    })
    .eq("course_id", courseId);

  if (error) throw error;

  revalidatePath("/courses");
  revalidatePath("/lesson-records/new");
  revalidatePath("/students");
}

export async function archiveCourse(formData: FormData) {
  const supabase = await createClient();
  const courseId = requiredText(formData, "course_id");
  const currentStatus = requiredText(formData, "current_status");
  const newStatus = currentStatus === "active" ? "inactive" : "active";

  const { error } = await supabase
    .from("courses")
    .update({ status: newStatus })
    .eq("course_id", courseId);

  if (error) throw error;

  revalidatePath("/courses");
  revalidatePath("/lesson-records/new");
  revalidatePath("/students");
}
