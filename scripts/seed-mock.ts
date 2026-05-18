/**
 * 画面確認用の仮データを Supabase に直接投入するスクリプト。
 *
 * 使い方:
 *   SUPABASE_EMAIL=your@email SUPABASE_PASSWORD=yourpass npx tsx scripts/seed-mock.ts
 *
 * 本番DBには絶対に実行しないこと。
 */

import { createClient } from "@supabase/supabase-js";

// ────────────────────────────────────────────────────────────
// 設定
// ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const EMAIL = process.env.SUPABASE_EMAIL ?? "";
const PASSWORD = process.env.SUPABASE_PASSWORD ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ .env.local の NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が未設定です");
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error("❌ 実行方法: SUPABASE_EMAIL=xxx SUPABASE_PASSWORD=yyy npx tsx scripts/seed-mock.ts");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────
const COURSES = [
  { course_id: "00000000-0000-4000-8000-000000000201", course_name: "Scratch",      description: "ブロックプログラミング",    status: "active" },
  { course_id: "00000000-0000-4000-8000-000000000202", course_name: "Roblox",       description: "Roblox Studio による制作", status: "active" },
  { course_id: "00000000-0000-4000-8000-000000000203", course_name: "ITオンライン部", description: "オンライン IT 学習",       status: "active" },
  { course_id: "00000000-0000-4000-8000-000000000204", course_name: "イラスト",      description: "デジタルイラスト",          status: "active" },
];

// [苗字, 名前, 苗字かな, 名前かな, 学年, 曜日, 開始時刻, コースIndex]
const STUDENTS = [
  ["青木", "奏太", "あおき", "そうた", "小4", "月", "15:00", 0],
  ["石田", "結衣", "いしだ", "ゆい",   "小5", "火", "16:00", 1],
  ["上田", "湊",   "うえだ", "みなと", "小6", "水", "17:00", 2],
  ["遠藤", "莉子", "えんどう","りこ",  "中1", "木", "18:00", 3],
  ["小川", "悠真", "おがわ", "ゆうま", "中2", "金", "19:00", 0],
  ["加藤", "紗奈", "かとう", "さな",   "中3", "土", "14:00", 1],
  ["木村", "大翔", "きむら", "ひろと", "小3", "月", "16:00", 2],
  ["近藤", "美月", "こんどう","みつき","小6", "火", "17:00", 3],
  ["齋藤", "陸",   "さいとう","りく",  "中1", "水", "18:00", 0],
  ["高橋", "杏",   "たかはし","あん",  "中2", "木", "19:00", 1],
  ["中村", "陽菜", "なかむら","ひな",  "高1", "金", "18:00", 2],
  ["森",   "蓮",   "もり",   "れん",  "高2", "土", "15:00", 3],
] as const;

const DOW: Record<string, number> = { 日:0, 月:1, 火:2, 水:3, 木:4, 金:5, 土:6 };

const TITLES: Record<string, string[]> = {
  Scratch:    ["変数ブロックでスコアを作ろう","クローンで敵キャラを複製しよう","当たり判定でゲームオーバーを実装","スタート画面と画面切り替え","リストを使った単語ゲーム","ペンブロックでお絵かき機能"],
  Roblox:     ["地形ツールで島を作る","Luaスクリプトの基礎","アイテム収集システムの実装","NPCの巡回AIを作る","ゲームUIとスコア表示","Publish前の動作確認"],
  ITオンライン部:["タイピングとホームポジション","HTMLで自己紹介ページ","CSSで色と余白を整える","フォームとボタンの基礎","Pythonの変数と計算","小さなWebページ制作"],
  イラスト:    ["線画練習と基本の形","色塗りの基礎","レイヤーを使った作画","キャラクターデザイン","背景イラストに挑戦","作品の仕上げ"],
};

// ────────────────────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────────────────────
function uuid(prefix: string, n: number) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function recordUuid(si: number, wi: number) {
  return `20000002-${String(wi).padStart(4, "0")}-4000-8000-${String(si).padStart(12, "0")}`;
}

function lessonDate(weekday: string, weeksAgo: number): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = (today.getDay() - DOW[weekday] + 7) % 7;
  today.setDate(today.getDate() - diff - weeksAgo * 7);
  return today.toLocaleDateString("sv-SE");   // YYYY-MM-DD
}

function addMins(time: string, mins: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m + mins);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function content(courseName: string, title: string, si: number, wi: number) {
  const parts: string[] = [];
  const push = (label: string, val: string) => parts.push(`${label}：${val}`);

  if (courseName === "イラスト") {
    push("今日の目的", title);
    push("レッスン使用ツール", "Clip Studio Paint");
    push("レッスンの様子", ["線を丁寧に引けていた。形の取り方も安定してきた。","色の組み合わせを楽しみながら進めていた。","構図を何度も試しながら粘り強く描いていた。"][(si+wi)%3]);
    push("今日のワクワクの様子", ["完成が近づいて嬉しそうだった。","次は背景も描きたいと話していた。","自分の作品を大切そうに見返していた。"][wi%3]);
  } else {
    const tool = courseName === "Scratch" ? "Scratch 3.0" : courseName === "Roblox" ? "Roblox Studio" : "VS Code / ブラウザ";
    push("今日の目的", title);
    push("タイピング使用ツール", ["Typing.com","Keybr","e-Typing"][(si+wi)%3]);
    push("タイピングの様子", ["集中して取り組めていた。","ホームポジションを意識できていた。","前回よりミスが減っていた。"][wi%3]);
    push("レッスン使用ツール", tool);
    push("レッスンの様子", ["積極的に質問しながら進められた。","少し詰まったが自分で修正できた。","前回の内容を覚えていてスムーズだった。"][(si+wi)%3]);
    push("今日のワクワクの様子", ["完成したものを何度も動かして喜んでいた。","自分でアレンジを加えて楽しんでいた。","友達に見せたいと話していた。"][wi%3]);
  }
  return parts.join("\n\n");
}

// ────────────────────────────────────────────────────────────
// メイン
// ────────────────────────────────────────────────────────────
async function run() {
  // ── 認証
  console.log("🔑 サインイン中...");
  const { error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (authError) { console.error("❌ サインイン失敗:", authError.message); process.exit(1); }
  console.log("✅ サインイン成功");

  // ── コース upsert
  const { error: ce } = await supabase.from("courses").upsert(COURSES, { onConflict: "course_id" });
  if (ce) throw new Error("コース upsert: " + ce.message);
  console.log(`📚 コース: ${COURSES.length}件`);

  // ── 生徒 upsert
  const students = STUDENTS.map((s, i) => ({
    student_id:      uuid("20000000", i + 1),
    last_name:       s[0], first_name:       s[1],
    last_name_kana:  s[2], first_name_kana:  s[3],
    grade:           s[4],
    phone: `090-4000-${String(i+1).padStart(4,"0")}`,
    email: `mock-s${String(i+1).padStart(2,"0")}@example.com`,
    notes: "画面確認用の仮データ",
  }));
  const { error: se } = await supabase.from("students").upsert(students, { onConflict: "student_id" });
  if (se) throw new Error("生徒 upsert: " + se.message);
  console.log(`👤 生徒: ${students.length}件`);

  // ── 受講登録 upsert
  const enrollments = STUDENTS.map((s, i) => ({
    enrollment_id: uuid("20000001", i + 1),
    student_id:    uuid("20000000", i + 1),
    course_id:     COURSES[s[7]].course_id,
    schedule_label:`${s[5]} ${s[6]}`,
    weekday:       s[5],
    start_time:    s[6],
    frequency:     "weekly",
    start_date:    lessonDate(s[5], 10),
    status:        "active",
  }));
  const { error: ee } = await supabase.from("enrollments").upsert(enrollments, { onConflict: "enrollment_id" });
  if (ee) throw new Error("受講登録 upsert: " + ee.message);
  console.log(`📋 受講登録: ${enrollments.length}件`);

  // ── 授業記録 upsert (8週 × 12人 = 最大96件)
  const records = STUDENTS.flatMap((s, si) => {
    const courseName = COURSES[s[7]].course_name;
    return Array.from({ length: 8 }, (_, wi) => {
      const absent = (si + wi) % 11 === 0;
      const late   = !absent && (si * 2 + wi) % 13 === 0;
      const status = absent ? "absent" : late ? "late" : "present";
      const titleList = TITLES[courseName] ?? TITLES.Scratch;
      const title     = absent ? "欠席" : titleList[wi % titleList.length];
      return {
        lesson_record_id: recordUuid(si + 1, wi),
        student_id:       uuid("20000000", si + 1),
        course_id:        COURSES[s[7]].course_id,
        lesson_date:      lessonDate(s[5], wi),
        start_time:       s[6],
        end_time:         addMins(s[6], 90),
        attendance_status: status,
        title,
        content: absent ? null : content(courseName, title, si, wi),
        homework: absent ? null : ["今日の続きを家で試してみること。","作ったものを保存して次回見せること。","次回やりたいアレンジを考えてくること。"][wi%3],
        memo: "仮データ",
      };
    });
  });

  const CHUNK = 20;
  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error: re } = await supabase.from("lesson_records").upsert(chunk, { onConflict: "lesson_record_id" });
    if (re) throw new Error(`授業記録 upsert (chunk ${i}): ${re.message}`);
    inserted += chunk.length;
    process.stdout.write(`\r📝 授業記録: ${inserted}/${records.length}件`);
  }
  console.log("\n✅ 完了！");

  await supabase.auth.signOut();
}

run().catch((err) => { console.error("\n❌", err.message); process.exit(1); });
