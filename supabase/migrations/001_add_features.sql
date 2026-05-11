-- ============================================================
-- 機能追加マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. lesson_records に出欠ステータス列を追加
alter table public.lesson_records
  add column if not exists attendance_status text
  check (attendance_status in ('present', 'absent', 'late', 'substitute'));

-- 2. 授業記録の編集履歴テーブル
create table if not exists public.lesson_record_history (
  history_id      uuid primary key default gen_random_uuid(),
  lesson_record_id uuid not null references public.lesson_records(lesson_record_id) on delete cascade,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_at      timestamptz not null default now(),
  lesson_date     date,
  attendance_status text,
  title           text,
  content         text,
  homework        text,
  memo            text
);
create index if not exists lesson_record_history_record_id_idx
  on public.lesson_record_history(lesson_record_id);
alter table public.lesson_record_history enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lesson_record_history'
    and policyname = 'lesson_record_history authenticated access'
  ) then
    execute 'create policy "lesson_record_history authenticated access"
      on public.lesson_record_history for all to authenticated
      using (true) with check (true)';
  end if;
end $$;

-- 3. 教材・ファイル管理テーブル
create table if not exists public.student_documents (
  document_id  uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(student_id) on delete cascade,
  uploaded_by  uuid references auth.users(id) on delete set null,
  file_name    text not null,
  storage_path text not null,
  file_type    text,
  tag          text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists student_documents_student_id_idx
  on public.student_documents(student_id);
alter table public.student_documents enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'student_documents'
    and policyname = 'student_documents authenticated access'
  ) then
    execute 'create policy "student_documents authenticated access"
      on public.student_documents for all to authenticated
      using (true) with check (true)';
  end if;
end $$;

-- 4. 担当スケジュールテーブル（受講 × 担当スタッフ）
create table if not exists public.lesson_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(enrollment_id) on delete cascade,
  staff_id      uuid not null references public.staff(staff_id) on delete cascade,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (enrollment_id)
);
create index if not exists lesson_assignments_enrollment_id_idx
  on public.lesson_assignments(enrollment_id);
create index if not exists lesson_assignments_staff_id_idx
  on public.lesson_assignments(staff_id);
alter table public.lesson_assignments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'lesson_assignments'
    and policyname = 'lesson_assignments authenticated access'
  ) then
    execute 'create policy "lesson_assignments authenticated access"
      on public.lesson_assignments for all to authenticated
      using (true) with check (true)';
  end if;
end $$;
create trigger set_lesson_assignments_updated_at
  before update on public.lesson_assignments
  for each row execute function public.set_updated_at();

-- ============================================================
-- Supabase Storage バケット（UIで作成してください）
-- バケット名: student-documents
-- 公開設定: false（認証ユーザーのみ）
-- Storage > Policies で authenticated ユーザーの read/write を許可
-- ============================================================
