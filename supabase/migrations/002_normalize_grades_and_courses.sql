-- 学年表記の統一（小1 / 中1 / 高1）
update public.students
set grade = '小' || substring(grade from '^([1-6])年$')
where grade ~ '^[1-6]年$';

update public.students
set grade = '小' || substring(grade from '^(?:小学|小)([1-6])年?$')
where grade ~ '^(?:小学|小)[1-6]年?$';

update public.students
set grade = '中' || substring(grade from '^(?:中学|中)([1-3])年?$')
where grade ~ '^(?:中学|中)[1-3]年?$';

update public.students
set grade = '高' || substring(grade from '^(?:高校|高)([1-3])年?$')
where grade ~ '^(?:高校|高)[1-3]年?$';

-- コース名の統合（正式4コース）
-- scratch: A:スクラッチ / B:スクラッチ
-- Roblox: A:ロブロックス / B:ロブロックス
-- ITオンライン部: B:＃ITオンライン部
-- イラスト: B:イラスト

-- 代表 course_id（importデータの既存ID）
-- scratch  397ecd10-d1aa-5be5-8cb1-cbc4687d26f9
-- Roblox   c6f4fbdc-b7ea-5a44-8064-acf91a14dc35
-- IT       8d25a1db-1140-54e9-a1c5-19ab5e2f9ae4
-- イラスト b51811b0-9c03-5be9-a310-74816601faf5

update public.enrollments set course_id = '397ecd10-d1aa-5be5-8cb1-cbc4687d26f9'
where course_id in ('8e766074-8184-5679-b357-dbda9aa57722');

update public.lesson_records set course_id = '397ecd10-d1aa-5be5-8cb1-cbc4687d26f9'
where course_id in ('8e766074-8184-5679-b357-dbda9aa57722');

update public.enrollments set course_id = 'c6f4fbdc-b7ea-5a44-8064-acf91a14dc35'
where course_id in ('06b9fb6f-8f05-5863-b5a0-be511f0ce995');

update public.lesson_records set course_id = 'c6f4fbdc-b7ea-5a44-8064-acf91a14dc35'
where course_id in ('06b9fb6f-8f05-5863-b5a0-be511f0ce995');

update public.courses set course_name = 'scratch', status = 'active'
where course_id = '397ecd10-d1aa-5be5-8cb1-cbc4687d26f9';

update public.courses set course_name = 'Roblox', status = 'active'
where course_id = 'c6f4fbdc-b7ea-5a44-8064-acf91a14dc35';

update public.courses set course_name = 'ITオンライン部', status = 'active'
where course_id = '8d25a1db-1140-54e9-a1c5-19ab5e2f9ae4';

update public.courses set course_name = 'イラスト', status = 'active'
where course_id = 'b51811b0-9c03-5be9-a310-74816601faf5';

update public.courses set status = 'inactive'
where course_id in (
  '8e766074-8184-5679-b357-dbda9aa57722',
  '06b9fb6f-8f05-5863-b5a0-be511f0ce995',
  'e07c8df9-9b63-5156-9b71-28e13b3ca0d4'
);

-- B:ロボットは別コースのまま無効化（Robloxとは別扱い）
update public.courses set status = 'inactive'
where course_id = 'e07c8df9-9b63-5156-9b71-28e13b3ca0d4'
  and course_name like '%ロボット%';
