"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isCurrentUserAdmin } from "@/lib/authz";
import { nextGrade, normalizeGrade } from "@/lib/grades";
import {
  buildLessonRecordContent,
  lessonContentFieldsFromFormData,
  structuredLessonContent
} from "@/lib/lesson-record-content";
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

const mockCourses = [
  {
    course_id: "00000000-0000-4000-8000-000000000201",
    course_name: "Scratch",
    description: "ブロックプログラミング",
    status: "active"
  },
  {
    course_id: "00000000-0000-4000-8000-000000000202",
    course_name: "Roblox",
    description: "Roblox Studio による制作",
    status: "active"
  },
  {
    course_id: "00000000-0000-4000-8000-000000000203",
    course_name: "ITオンライン部",
    description: "オンライン IT 学習",
    status: "active"
  },
  {
    course_id: "00000000-0000-4000-8000-000000000204",
    course_name: "イラスト",
    description: "デジタルイラスト",
    status: "active"
  }
];

const mockStudentSeeds = [
  ["青木", "奏太", "あおき", "そうた", "小4", "月", "15:00", 0],
  ["石田", "結衣", "いしだ", "ゆい", "小5", "火", "16:00", 1],
  ["上田", "湊", "うえだ", "みなと", "小6", "水", "17:00", 2],
  ["遠藤", "莉子", "えんどう", "りこ", "中1", "木", "18:00", 3],
  ["小川", "悠真", "おがわ", "ゆうま", "中2", "金", "19:00", 0],
  ["加藤", "紗奈", "かとう", "さな", "中3", "土", "14:00", 1],
  ["木村", "大翔", "きむら", "ひろと", "小3", "月", "16:00", 2],
  ["近藤", "美月", "こんどう", "みつき", "小6", "火", "17:00", 3],
  ["齋藤", "陸", "さいとう", "りく", "中1", "水", "18:00", 0],
  ["高橋", "杏", "たかはし", "あん", "中2", "木", "19:00", 1],
  ["中村", "陽菜", "なかむら", "ひな", "高1", "金", "18:00", 2],
  ["森", "蓮", "もり", "れん", "高2", "土", "15:00", 3]
] as const;

const weekdayToDow: Record<string, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6
};

function mockUuid(prefix: string, n: number) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function mockLessonRecordUuid(studentIndex: number, weekOffset: number) {
  return `20000002-${String(weekOffset).padStart(4, "0")}-4000-8000-${String(studentIndex).padStart(12, "0")}`;
}

function formatDateForDb(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function previousLessonDateForWeekday(weekday: string, weekOffset: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDow = weekdayToDow[weekday] ?? 1;
  const diff = (today.getDay() - targetDow + 7) % 7;
  today.setDate(today.getDate() - diff - weekOffset * 7);
  return formatDateForDb(today);
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function mockLessonTitle(courseName: string, weekOffset: number) {
  const titles: Record<string, string[]> = {
    Scratch: [
      "変数ブロックでスコアを作ろう",
      "クローンで敵キャラを複製しよう",
      "当たり判定でゲームオーバーを実装",
      "スタート画面と画面切り替え",
      "リストを使った単語ゲーム",
      "ペンブロックでお絵かき機能"
    ],
    Roblox: [
      "地形ツールで島を作る",
      "Luaスクリプトの基礎",
      "アイテム収集システムの実装",
      "NPCの巡回AIを作る",
      "ゲームUIとスコア表示",
      "Publish前の動作確認"
    ],
    ITオンライン部: [
      "タイピングとホームポジション",
      "HTMLで自己紹介ページ",
      "CSSで色と余白を整える",
      "フォームとボタンの基礎",
      "Pythonの変数と計算",
      "小さなWebページ制作"
    ],
    イラスト: [
      "線画練習と基本の形",
      "色塗りの基礎",
      "レイヤーを使った作画",
      "キャラクターデザイン",
      "背景イラストに挑戦",
      "作品の仕上げ"
    ]
  };

  const courseTitles = titles[courseName] ?? titles.Scratch;
  return courseTitles[weekOffset % courseTitles.length];
}

function mockLessonContent(courseName: string, title: string, n: number, weekOffset: number) {
  if (courseName === "イラスト") {
    return structuredLessonContent([
      ["今日の目的", title],
      ["レッスン使用ツール", "Clip Studio Paint"],
      [
        "レッスンの様子",
        ["線を丁寧に引けていた。形の取り方も安定してきた。", "色の組み合わせを楽しみながら進めていた。", "構図を何度も試しながら粘り強く描いていた。"][
          (n + weekOffset) % 3
        ]
      ],
      [
        "今日のワクワクの様子",
        ["完成が近づいて嬉しそうだった。", "次は背景も描きたいと話していた。", "自分の作品を大切そうに見返していた。"][
          weekOffset % 3
        ]
      ]
    ]);
  }

  const lessonTool =
    courseName === "Scratch" ? "Scratch 3.0" : courseName === "Roblox" ? "Roblox Studio" : "VS Code / ブラウザ";

  return structuredLessonContent([
    ["今日の目的", title],
    ["タイピング使用ツール", ["Typing.com", "Keybr", "e-Typing"][(n + weekOffset) % 3]],
    [
      "タイピングの様子",
      ["集中して取り組めていた。", "ホームポジションを意識できていた。", "前回よりミスが減っていた。"][
        weekOffset % 3
      ]
    ],
    ["レッスン使用ツール", lessonTool],
    [
      "レッスンの様子",
      ["積極的に質問しながら進められた。", "少し詰まったが自分で修正できた。", "前回の内容を覚えていてスムーズだった。"][
        (n + weekOffset) % 3
      ]
    ],
    [
      "今日のワクワクの様子",
      ["完成したものを何度も動かして喜んでいた。", "自分でアレンジを加えて楽しんでいた。", "友達に見せたいと話していた。"][
        weekOffset % 3
      ]
    ]
  ]);
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

  const { data, error } = await supabase
    .from("lesson_records")
    .insert({
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
    })
    .select("lesson_record_id")
    .single();

  if (error) throw error;

  revalidatePath("/dashboard");
  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
  revalidatePath(`/students/${enrollment.student_id}`);

  const redirectTo = optionalText(formData, "redirect_to");
  if (redirectTo && redirectTo.startsWith("/lesson-records/new")) {
    redirect(redirectTo);
  }
  redirect(`/lesson-records/${data.lesson_record_id}`);
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

  const { data, error } = await supabase
    .from("lesson_records")
    .insert({
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
    })
    .select("lesson_record_id")
    .single();

  if (error) throw error;

  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
  revalidatePath(`/students/${enrollment.student_id}`);

  const redirectTo = optionalText(formData, "redirect_to");
  if (redirectTo && redirectTo.startsWith("/lesson-records/new")) {
    redirect(redirectTo);
  }
  redirect(`/lesson-records/${data.lesson_record_id}`);
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

export async function createMockLessonRecords() {
  const supabase = await createClient();

  const { error: coursesError } = await supabase.from("courses").upsert(mockCourses, {
    onConflict: "course_id"
  });
  if (coursesError) throw coursesError;

  const students = mockStudentSeeds.map(([lastName, firstName, lastNameKana, firstNameKana, grade], index) => ({
    student_id: mockUuid("20000000", index + 1),
    last_name: lastName,
    first_name: firstName,
    last_name_kana: lastNameKana,
    first_name_kana: firstNameKana,
    grade,
    phone: `090-4000-${String(index + 1).padStart(4, "0")}`,
    email: `mock-student-${String(index + 1).padStart(2, "0")}@example.com`,
    notes: "画面確認用の仮生徒データ"
  }));

  const { error: studentsError } = await supabase.from("students").upsert(students, {
    onConflict: "student_id"
  });
  if (studentsError) throw studentsError;

  const enrollments = mockStudentSeeds.map((seed, index) => {
    const [, , , , , weekday, startTime, courseIndex] = seed;
    return {
      enrollment_id: mockUuid("20000001", index + 1),
      student_id: mockUuid("20000000", index + 1),
      course_id: mockCourses[courseIndex].course_id,
      schedule_label: `${weekday} ${startTime}`,
      weekday,
      start_time: startTime,
      frequency: "weekly",
      start_date: previousLessonDateForWeekday(weekday, 10),
      status: "active"
    };
  });

  const { error: enrollmentsError } = await supabase.from("enrollments").upsert(enrollments, {
    onConflict: "enrollment_id"
  });
  if (enrollmentsError) throw enrollmentsError;

  const lessonRecords = mockStudentSeeds.flatMap((seed, index) => {
    const [, , , , , weekday, startTime, courseIndex] = seed;
    const courseName = mockCourses[courseIndex].course_name;

    return Array.from({ length: 8 }, (_, weekOffset) => {
      const attendanceStatus =
        (index + weekOffset) % 11 === 0 ? "absent" : (index * 2 + weekOffset) % 13 === 0 ? "late" : "present";
      const title = attendanceStatus === "absent" ? "欠席" : mockLessonTitle(courseName, weekOffset);

      return {
        lesson_record_id: mockLessonRecordUuid(index + 1, weekOffset),
        student_id: mockUuid("20000000", index + 1),
        course_id: mockCourses[courseIndex].course_id,
        lesson_date: previousLessonDateForWeekday(weekday, weekOffset),
        start_time: startTime,
        end_time: addMinutes(startTime, 90),
        attendance_status: attendanceStatus,
        title,
        content: attendanceStatus === "absent" ? null : mockLessonContent(courseName, title, index, weekOffset),
        homework:
          attendanceStatus === "absent"
            ? null
            : [
                "今日の続きを家で試してみること。",
                "作ったものを保存して次回見せること。",
                "次回やりたいアレンジを考えてくること。"
              ][weekOffset % 3],
        memo: "仮データ"
      };
    });
  });

  const { error: lessonRecordsError } = await supabase.from("lesson_records").upsert(lessonRecords, {
    onConflict: "lesson_record_id"
  });
  if (lessonRecordsError) throw lessonRecordsError;

  revalidatePath("/dashboard");
  revalidatePath("/students");
  revalidatePath("/lesson-records");
  revalidatePath("/lesson-records/new");
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
