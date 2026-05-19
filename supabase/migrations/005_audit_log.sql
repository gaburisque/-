-- ============================================================
-- 最小構成の監査ログ
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 生徒基本情報の変更履歴
create table if not exists public.student_change_history (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid references public.students(student_id) on delete cascade,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  field_name  text not null,
  old_value   text,
  new_value   text
);

alter table public.student_change_history enable row level security;

create policy "student_change_history role-based read"
  on public.student_change_history for select to authenticated using (true);

create policy "student_change_history role-based write"
  on public.student_change_history for insert to authenticated with check (true);

create policy "student_change_history admin delete"
  on public.student_change_history for delete to authenticated using (public.is_admin_user());

-- スタッフ情報の変更履歴
create table if not exists public.staff_change_history (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.staff(staff_id) on delete cascade,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  field_name  text not null,
  old_value   text,
  new_value   text
);

alter table public.staff_change_history enable row level security;

create policy "staff_change_history role-based read"
  on public.staff_change_history for select to authenticated using (true);

create policy "staff_change_history role-based write"
  on public.staff_change_history for insert to authenticated with check (true);

create policy "staff_change_history admin delete"
  on public.staff_change_history for delete to authenticated using (public.is_admin_user());
