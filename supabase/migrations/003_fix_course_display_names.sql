-- 002 実行済みで course_name が小文字のままの場合の修正
update public.courses set course_name = 'Scratch' where lower(course_name) = 'scratch';
update public.courses set course_name = 'Roblox' where lower(course_name) in ('roblox', 'oblox');
