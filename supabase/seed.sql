insert into public.schools (school_id, school_name, school_type)
values
  ('00000000-0000-4000-8000-000000000101', '青葉中学校', 'junior_high'),
  ('00000000-0000-4000-8000-000000000102', '桜丘高校', 'high_school')
on conflict (school_id) do nothing;

insert into public.courses (course_id, course_name, description, status)
values
  ('00000000-0000-4000-8000-000000000201', 'Scratch', 'ブロックプログラミング', 'active'),
  ('00000000-0000-4000-8000-000000000202', 'Roblox', 'Roblox Studio による制作', 'active'),
  ('00000000-0000-4000-8000-000000000203', 'ITオンライン部', 'オンライン IT 学習', 'active'),
  ('00000000-0000-4000-8000-000000000204', 'イラスト', 'デジタルイラスト', 'active')
on conflict (course_id) do update set
  course_name = excluded.course_name,
  description = excluded.description,
  status = excluded.status;

insert into public.students (
  student_id,
  school_id,
  last_name,
  first_name,
  last_name_kana,
  first_name_kana,
  grade,
  phone,
  email,
  notes
)
values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000101',
    '佐藤',
    '陽太',
    'さとう',
    'ようた',
    '中2',
    '090-0000-0001',
    'yota.sato@example.com',
    'Scratch 変数ブロックの復習を継続'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000102',
    '田中',
    '美咲',
    'たなか',
    'みさき',
    '高1',
    '090-0000-0002',
    'misaki.tanaka@example.com',
    'Roblox 脚本制作に注力'
  )
on conflict (student_id) do nothing;

insert into public.guardians (
  guardian_id,
  student_id,
  last_name,
  first_name,
  relationship,
  phone,
  email,
  is_primary
)
values
  (
    '00000000-0000-4000-8000-000000000401',
    '00000000-0000-4000-8000-000000000301',
    '佐藤',
    '真由美',
    '母',
    '090-1000-0001',
    'mayumi.sato@example.com',
    true
  )
on conflict (guardian_id) do nothing;

insert into public.emergency_contacts (
  emergency_contact_id,
  student_id,
  name,
  relationship,
  phone,
  priority
)
values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000301',
    '佐藤 真由美',
    '母',
    '090-1000-0001',
    1
  )
on conflict (emergency_contact_id) do nothing;

insert into public.enrollments (
  enrollment_id,
  student_id,
  course_id,
  start_date,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000201',
    current_date - 30,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000202',
    current_date - 14,
    'active'
  )
on conflict (enrollment_id) do nothing;

insert into public.lesson_records (
  lesson_record_id,
  student_id,
  course_id,
  lesson_date,
  start_time,
  end_time,
  title,
  content,
  homework
)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000201',
    current_date,
    '18:00',
    '19:30',
    '変数とメッセージ',
    'スプライトの動きと変数ブロックの確認',
    '同じプロジェクトを家で保存して提出'
  )
on conflict (lesson_record_id) do nothing;

-- Staging 動作確認用: 約100人の仮生徒データ
with seed_students as (
  select
    n,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as student_id,
    case
      when n % 2 = 0 then '00000000-0000-4000-8000-000000000102'
      else '00000000-0000-4000-8000-000000000101'
    end::uuid as school_id,
    (array['小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3', '高1', '高2', '高3'])[((n - 1) % 12) + 1] as grade
  from generate_series(1, 100) as n
)
insert into public.students (
  student_id,
  school_id,
  last_name,
  first_name,
  last_name_kana,
  first_name_kana,
  grade,
  phone,
  email,
  notes
)
select
  student_id,
  school_id,
  'テスト',
  '生徒' || lpad(n::text, 3, '0'),
  'てすと',
  'せいと' || lpad(n::text, 3, '0'),
  grade,
  '090-2000-' || lpad(n::text, 4, '0'),
  'student' || lpad(n::text, 3, '0') || '@example.com',
  'Staging 動作確認用の仮データ'
from seed_students
on conflict (student_id) do update set
  school_id = excluded.school_id,
  last_name = excluded.last_name,
  first_name = excluded.first_name,
  last_name_kana = excluded.last_name_kana,
  first_name_kana = excluded.first_name_kana,
  grade = excluded.grade,
  phone = excluded.phone,
  email = excluded.email,
  notes = excluded.notes;

with seed_guardians as (
  select
    n,
    ('10000001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as guardian_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as student_id
  from generate_series(1, 100) as n
)
insert into public.guardians (
  guardian_id,
  student_id,
  last_name,
  first_name,
  relationship,
  phone,
  email,
  is_primary
)
select
  guardian_id,
  student_id,
  'テスト',
  '保護者' || lpad(n::text, 3, '0'),
  '保護者',
  '090-3000-' || lpad(n::text, 4, '0'),
  'guardian' || lpad(n::text, 3, '0') || '@example.com',
  true
from seed_guardians
on conflict (guardian_id) do update set
  last_name = excluded.last_name,
  first_name = excluded.first_name,
  relationship = excluded.relationship,
  phone = excluded.phone,
  email = excluded.email,
  is_primary = excluded.is_primary;

with seed_enrollments as (
  select
    n,
    ('10000002-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as enrollment_id,
    ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as student_id,
    (array[
      '00000000-0000-4000-8000-000000000201',
      '00000000-0000-4000-8000-000000000202',
      '00000000-0000-4000-8000-000000000203',
      '00000000-0000-4000-8000-000000000204'
    ])[((n - 1) % 4) + 1]::uuid as course_id,
    (array['月', '火', '水', '木', '金', '土'])[((n - 1) % 6) + 1] as weekday,
    ('15:00'::time + (((n - 1) % 6) * interval '1 hour'))::time as start_time
  from generate_series(1, 100) as n
)
insert into public.enrollments (
  enrollment_id,
  student_id,
  course_id,
  schedule_label,
  weekday,
  start_time,
  frequency,
  start_date,
  status
)
select
  enrollment_id,
  student_id,
  course_id,
  weekday || ' ' || to_char(start_time, 'HH24:MI'),
  weekday,
  start_time,
  'weekly',
  current_date - ((n % 60) + 1),
  'active'
from seed_enrollments
on conflict (enrollment_id) do update set
  course_id = excluded.course_id,
  schedule_label = excluded.schedule_label,
  weekday = excluded.weekday,
  start_time = excluded.start_time,
  frequency = excluded.frequency,
  start_date = excluded.start_date,
  status = excluded.status;
