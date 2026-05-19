-- 過去の授業記録を仮生成する（任意の active 受講に対して）
--
-- 使い方: Supabase SQL Editor で実行（ローカルなら psql でも可）。
-- 各受講の曜日に合わせ直近24週ぶんの日付でレコードを追加します。
-- 同じ生徒・コース・授業日が既にあればスキップするので、再実行しても重複しません。
--
-- 注意: 本番の実データに混ぜる場合は、実行前にバックアップを取ってください。

with
weekday_dow (weekday, dow) as (
  select *
  from (
    values
      ('月'::text, 1),
      ('火', 2),
      ('水', 3),
      ('木', 4),
      ('金', 5),
      ('土', 6),
      ('日', 0)
  ) as v (weekday, dow)
),
slots as (
  select
    e.student_id,
    e.course_id,
    e.start_time,
    (
      current_date
      - ((extract(dow from current_date)::int - wd.dow + 7) % 7)
      - (gs.n * 7)
    )::date as lesson_date,
    gs.n as week_index
  from public.enrollments e
  inner join weekday_dow wd on wd.weekday = e.weekday
  cross join generate_series(0, 23) as gs (n)
  where
    e.status = 'active'
    and e.weekday is not null
    and e.start_time is not null
),
to_insert as (
  select *
  from slots s
  where
    s.lesson_date <= current_date
    and not exists (
      select 1
      from public.lesson_records lr
      where
        lr.student_id = s.student_id
        and lr.course_id = s.course_id
        and lr.lesson_date = s.lesson_date
    )
)
insert into public.lesson_records (
  lesson_record_id,
  student_id,
  course_id,
  lesson_date,
  start_time,
  end_time,
  attendance_status,
  title,
  content,
  homework,
  memo
)
select
  gen_random_uuid(),
  t.student_id,
  t.course_id,
  t.lesson_date,
  t.start_time,
  (t.start_time + interval '90 minutes')::time,
  case
    when mod(abs(hashtext(t.student_id::text)) + t.week_index, 15) = 0 then 'absent'::text
    when mod(abs(hashtext(t.student_id::text)) + t.week_index, 17) = 5 then 'late'::text
    else 'present'::text
  end,
  case
    when mod(abs(hashtext(t.student_id::text)) + t.week_index, 15) = 0 then '欠席'
    else format('デモ授業（第%s週）', t.week_index + 1)
  end,
  case
    when mod(abs(hashtext(t.student_id::text)) + t.week_index, 15) = 0 then null::text
    else '画面確認用の仮データです。内容は編集・削除して問題ありません。'
  end,
  case
    when mod(abs(hashtext(t.student_id::text)) + t.week_index, 15) = 0 then null::text
    else '次回までに前回の復習をしておくこと。'
  end,
  'seed_past_lesson_records_for_active_enrollments.sql'
from to_insert t;
