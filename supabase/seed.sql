insert into public.schools (school_id, school_name, school_type)
values
  ('00000000-0000-4000-8000-000000000101', '青葉中学校', 'junior_high'),
  ('00000000-0000-4000-8000-000000000102', '桜丘高校', 'high_school')
on conflict (school_id) do nothing;

insert into public.courses (course_id, course_name, description)
values
  ('00000000-0000-4000-8000-000000000201', '中学数学 標準', '学校進度に合わせた数学コース'),
  ('00000000-0000-4000-8000-000000000202', '英語 文法演習', '英文法と読解の基礎定着'),
  ('00000000-0000-4000-8000-000000000203', '高校数学 IAIIB', '高校数学の定期試験対策')
on conflict (course_id) do nothing;

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
    '計算演習を継続'
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
    '英語長文に注力'
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
    '一次関数',
    '傾きと切片の確認、グラフ作成演習',
    'テキスト p.42-43'
  )
on conflict (lesson_record_id) do nothing;
