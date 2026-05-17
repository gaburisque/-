-- ============================================================
-- Role-based RLS hardening
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 管理者判定ヘルパー
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff s
    join auth.users u on u.id = auth.uid()
    where s.role = 'admin'
      and (
        s.auth_user_id = u.id
        or (s.email is not null and s.email = u.email)
      )
  );
$$;

-- 既存の広い authenticated access policy を置換
do $$
declare
  table_name text;
  old_policy text;
begin
  foreach table_name in array array[
    'schools',
    'addresses',
    'students',
    'staff',
    'guardians',
    'emergency_contacts',
    'courses',
    'enrollments',
    'lesson_records',
    'tools',
    'services',
    'student_accounts',
    'lesson_record_history',
    'student_documents',
    'lesson_assignments'
  ]
  loop
    old_policy := table_name || ' authenticated access';
    execute format('drop policy if exists %I on public.%I', old_policy, table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' role-based read', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' role-based write', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || ' admin delete', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || ' role-based read',
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true)',
      table_name || ' role-based write',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      table_name || ' role-based write',
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_admin_user())',
      table_name || ' admin delete',
      table_name
    );
  end loop;
end $$;

-- staff は変更権限を管理者のみに絞る
drop policy if exists "staff role-based write" on public.staff;
create policy "staff admin insert"
  on public.staff for insert to authenticated
  with check (public.is_admin_user());
create policy "staff admin update"
  on public.staff for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Storage は Supabase Dashboard > Storage > Policies で
-- バケット student-documents に対して
-- 1) 読み取り: authenticated
-- 2) アップロード: authenticated
-- 3) 削除: admin のみ（可能なら metadata/email ではなく DB判定と整合）
-- を設定してください。
