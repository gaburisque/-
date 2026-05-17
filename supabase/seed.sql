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
  schedule_label,
  weekday,
  start_time,
  start_date,
  status
)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-000000000201',
    '月 15:00', '月', '15:00',
    current_date - 60,
    'active'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-000000000202',
    '水 16:00', '水', '16:00',
    current_date - 60,
    'active'
  )
on conflict (enrollment_id) do update set
  schedule_label = excluded.schedule_label,
  weekday        = excluded.weekday,
  start_time     = excluded.start_time;

-- ============================================================
-- デモ生徒（佐藤 陽太）の授業記録 8件（月曜日 15:00〜16:30）
-- ============================================================
insert into public.lesson_records (
  lesson_record_id, student_id, course_id,
  lesson_date, start_time, end_time,
  title, content, homework, attendance_status
) values
(
  '30000301-0001-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7),
  '15:00', '16:30',
  '変数ブロックでスコアを作ろう',
  E'今日の目的：スコアカウンターを変数で実装する\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：先週より正確性が上がった。5分間ミスなしで続けられた。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：変数ブロックの仕組みを自分で試しながら理解していた。スコアが増えるたびに「できた！」と声に出していた。\n\n今日のワクワクの様子：ゲームにスコアが表示された瞬間、テンションが一気に上がった。「次はランキングを作りたい」とアイデアが出てきた。',
  '作ったゲームを家でも動かしてみること。スコアの数値を変えて試す。',
  'present'
),
(
  '30000301-0002-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 7,
  '15:00', '16:30',
  'クローンで敵キャラを複製しよう',
  E'今日の目的：クローンブロックを使って敵を複製する\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：ホームポジションを意識しながら練習できていた。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：クローンの概念を最初は難しそうにしていたが、動作を確認しながら理解が深まった。自分でクローンの動きをアレンジする応用もできた。\n\n今日のワクワクの様子：敵が次々と現れるゲームに仕上がり、自分でも何度もプレイして楽しんでいた。',
  '次回はクローンに当たり判定をつける。ゲームを家で遊んでみること。',
  'present'
),
(
  '30000301-0003-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 14,
  '15:00', '16:30',
  '当たり判定でゲームオーバーを実装',
  E'今日の目的：敵とキャラクターが触れたらゲームオーバーにする\n\nタイピング使用ツール：Keybr\n\nタイピングの様子：英字キーの位置が定着してきた。スピードが少しずつ上がっている。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：当たり判定を試行錯誤しながら実装できた。「色に触れた」ブロックと「スプライトに触れた」の違いを自分で実験して理解した。\n\n今日のワクワクの様子：完成したゲームを何度もプレイし「友達に見せたい」と話していた。',
  '次回はゲームのスタート画面を作る。デザインを考えておくこと。',
  'present'
),
(
  '30000301-0004-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 21,
  '15:00', '16:30',
  'スタート画面とゲームオーバー画面',
  E'今日の目的：背景を切り替えてゲームの流れを作る\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：今日は集中して練習できていた。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：メッセージブロックを使って画面遷移を実装した。スプライトの表示・非表示を組み合わせてゲームとして完成度が上がった。\n\n今日のワクワクの様子：ゲームが完成に近づき、とても嬉しそうにしていた。次のゲームのアイデアも話してくれた。',
  '完成したゲームを保存して次回持ってくること。',
  'present'
),
(
  '30000301-0005-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 28,
  '15:00', '16:30',
  '欠席', null, null, 'absent'
),
(
  '30000301-0006-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 35,
  '15:00', '16:30',
  'リストを使った単語ゲーム',
  E'今日の目的：リストに単語を入れてランダムに表示するゲームを作る\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：コンスタントに上達している。今日は長文に挑戦した。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：リストの概念は初めてだったが「配列みたいなものだ」と自分で整理していた。乱数と組み合わせて単語をランダム表示できた。\n\n今日のワクワクの様子：自分で考えた問題を出せるゲームになり「家族にやってもらう」と話していた。',
  '家族に単語ゲームをプレイしてもらい、感想を教えてくること。',
  'present'
),
(
  '30000301-0007-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 42,
  '15:00', '16:30',
  'ペンブロックでお絵かき機能を作ろう',
  E'今日の目的：ペンブロックを使ってマウスで絵が描けるようにする\n\nタイピング使用ツール：Keybr\n\nタイピングの様子：今日は少し不注意なミスが多かった。次回意識して練習する。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：ペンの太さや色を変える機能を追加し、お絵かきアプリとして完成させた。消しゴム機能も自分で考えて実装できた。\n\n今日のワクワクの様子：描いた絵をスタンプで押せる機能を自分でアレンジして追加していた。発想が豊かで驚いた。',
  '次回は音楽プレイヤーを作る予定。お気に入りの音楽を調べてくること。',
  'present'
),
(
  '30000301-0008-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000301',
  '00000000-0000-4000-8000-000000000201',
  current_date - ((extract(dow from current_date)::int - 1 + 7) % 7) - 49,
  '15:00', '16:30',
  '音を鳴らすプログラムを作ろう',
  E'今日の目的：音ブロックを使って音楽を演奏するプログラムを作る\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：集中して練習できていた。今日は最高記録が出た。\n\nレッスン使用ツール：Scratch 3.0\n\nレッスンの様子：音ブロックを使って、キーボードで鍵盤を鳴らせるプログラムを作った。音の高さや長さを変えて実験していた。\n\n今日のワクワクの様子：作ったプログラムでドレミファソラシドを弾いて、とても嬉しそうにしていた。',
  '作った鍵盤プログラムで簡単な曲を弾いてみること。',
  'present'
)
on conflict (lesson_record_id) do nothing;

-- ============================================================
-- デモ生徒（田中 美咲）の授業記録 8件（水曜日 16:00〜17:30）
-- ============================================================
insert into public.lesson_records (
  lesson_record_id, student_id, course_id,
  lesson_date, start_time, end_time,
  title, content, homework, attendance_status
) values
(
  '30000302-0001-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7),
  '16:00', '17:30',
  'ゲームのゴール条件を実装しよう',
  E'今日の目的：プレイヤーがゴールに到達したらクリア画面を表示する\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：英語の長文タイピングに挑戦。かなりスムーズになってきた。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：Luaスクリプトを使ってゴール判定を実装した。条件分岐の書き方を自分で調べながら進められた。ゲームとして完成度が上がった。\n\n今日のワクワクの様子：自分でクリアして「よし！」と喜んでいた。友達にプレイしてもらいたいと話していた。',
  '次回はハイスコアをデータストアに保存する機能を実装する。',
  'present'
),
(
  '30000302-0002-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 7,
  '16:00', '17:30',
  'UIデザイン〜HUDを作ろう〜',
  E'今日の目的：HP・スコア・残り時間をHUDとして画面に表示する\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：今日は特に集中できていた。ミスが少なかった。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：StarterGuiを使ってHUDを作成。ScreenGuiとBillboardGuiの違いを実験しながら理解した。デザインにもこだわりが見られた。\n\n今日のワクワクの様子：UIが表示されてゲームらしくなり大喜びだった。「もっとおしゃれにしたい」とデザイン欲が出てきた。',
  '次回はアイテム収集システムを実装する。アイテムのアイデアを考えてくること。',
  'present'
),
(
  '30000302-0003-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 14,
  '16:00', '17:30',
  'アイテム収集システムの実装',
  E'今日の目的：コインを収集してスコアに加算するシステムを作る\n\nタイピング使用ツール：Typing.com\n\nタイピングの様子：英字ブロックも安定してきた。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：Touchedイベントを実装した。スクリプトのデバッグを自分で行えた。コインが消えてスコアに加算される動作を確認できた。\n\n今日のワクワクの様子：コインをとってスコアが増えるのを見て「気持ちいい！」と言っていた。',
  '作ったゲームに敵キャラを追加するアイデアを考えてくること。',
  'present'
),
(
  '30000302-0004-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 21,
  '16:00', '17:30',
  'NPCの巡回AIを実装する',
  E'今日の目的：NPCが自動でルートを巡回するAIを作る\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：今日は少し時間が短かったが集中して取り組んだ。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：PathfindingServiceを使ってNPCの移動を実装した。経路計算の概念を初めて学んだが、サンプルコードを読んで理解しようとしていた。\n\n今日のワクワクの様子：NPCが自分でルートを計算して動く様子に「すごい」と驚いていた。',
  '次回はNPCに攻撃判定を追加する。',
  'late'
),
(
  '30000302-0005-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 28,
  '16:00', '17:30',
  'NPCの攻撃とプレイヤーのHP管理',
  E'今日の目的：NPCがプレイヤーにダメージを与えてHPを減らす仕組みを作る\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：先週より速くなった。英語の長文もミスが少なかった。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：Humanoid.Healthを操作してダメージ処理を実装した。ローカルスクリプトとサーバースクリプトの違いを学んだ。難しかったが最後まで諦めずに完成させた。\n\n今日のワクワクの様子：ゲームらしくなってきて「完成が見えてきた！」と興奮していた。',
  '次回はサウンドエフェクトを追加する。お気に入りのSEのイメージを考えてくること。',
  'present'
),
(
  '30000302-0006-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 35,
  '16:00', '17:30',
  'サウンドエフェクトとBGMの追加',
  E'今日の目的：ゲームにSEとBGMを追加して完成度を上げる\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：今日も安定して練習できていた。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：SoundServiceを使ってBGMを追加した。効果音はコイン取得時・ダメージ時に設定できた。音のボリューム調整も実装した。\n\n今日のワクワクの様子：BGMが流れた瞬間、ゲームの雰囲気が変わって大喜びだった。「これゲームっぽい！」と何度も言っていた。',
  '次回はゲームを完成させてPublishする。友達に見せるメッセージを考えておくこと。',
  'present'
),
(
  '30000302-0007-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 42,
  '16:00', '17:30',
  'ゲームPublish & 発表会',
  E'今日の目的：作ったゲームをPublishして完成報告をする\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：今日は発表に集中するためショートセッション。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：ゲームをPublishして動作確認を行った。バグがいくつかあったが自分で修正できた。最後に振り返りをして次の目標を話し合った。\n\n今日のワクワクの様子：自分のゲームが公開されて大喜び。すぐに親のスマホで遊んでいた。',
  '次のプロジェクトのアイデアを考えてくること。どんなゲームを作りたいか。',
  'present'
),
(
  '30000302-0008-4000-8000-000000000000',
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000202',
  current_date - ((extract(dow from current_date)::int - 3 + 7) % 7) - 49,
  '16:00', '17:30',
  '新プロジェクト〜企画・設計〜',
  E'今日の目的：次のゲームの企画を立てて必要な機能をリストアップする\n\nタイピング使用ツール：e-Typing\n\nタイピングの様子：先月から毎回コンスタントに上達している。\n\nレッスン使用ツール：Roblox Studio\n\nレッスンの様子：次のプロジェクトとして「迷路脱出ゲーム」を企画した。必要な機能を紙に書き出して設計した。地形の基本構造を作り始めた。\n\n今日のワクワクの様子：自分でゲームデザインを考えるのが楽しそうだった。「もっと複雑にしたい」と意欲的だった。',
  '迷路のデザインをスケッチしてくること。次回は壁を作り込む。',
  'present'
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

-- ============================================================
-- テスト生徒 1〜20 の授業記録
-- 受講登録の weekday から授業日を逆算して直近12週分を生成。
-- 曜日ごとのグループに自動で分配される。
-- ============================================================
with
weekday_dow (weekday, dow) as (
  values ('月'::text,1),('火',2),('水',3),('木',4),('金',5),('土',6)
),
-- 対象生徒（n=1〜20）の受講情報
enrollments_20 as (
  select
    n.n,
    e.student_id,
    e.course_id,
    e.start_time,
    wd.dow
  from generate_series(1, 20) as n(n)
  join public.enrollments e
    on e.student_id = ('10000000-0000-4000-8000-' || lpad(n.n::text, 12, '0'))::uuid
    and e.status = 'active'
  join weekday_dow wd on wd.weekday = e.weekday
),
-- 直近12週の授業日（受講登録の曜日に対応するMonday〜Saturday）
dates_12w as (
  select
    e20.n,
    e20.student_id,
    e20.course_id,
    e20.start_time,
    (current_date
      - ((extract(dow from current_date)::int - e20.dow + 7) % 7)
      - (w.week_offset * 7))::date as lesson_date,
    w.week_offset
  from enrollments_20 e20
  cross join generate_series(0, 11) as w(week_offset)
  where (current_date
    - ((extract(dow from current_date)::int - e20.dow + 7) % 7)
    - (w.week_offset * 7)) <= current_date
),
-- タイトルをコース×週インデックスで決定
titles as (
  select course_id, idx, title from (values
    ('00000000-0000-4000-8000-000000000201'::uuid,0,'変数ブロックの練習'),
    ('00000000-0000-4000-8000-000000000201'::uuid,1,'スプライトのコスチューム切り替え'),
    ('00000000-0000-4000-8000-000000000201'::uuid,2,'条件分岐を使ったゲーム制作'),
    ('00000000-0000-4000-8000-000000000201'::uuid,3,'ループでアニメーションを作ろう'),
    ('00000000-0000-4000-8000-000000000201'::uuid,4,'クローンで複製してみよう'),
    ('00000000-0000-4000-8000-000000000201'::uuid,5,'スコア機能を追加しよう'),
    ('00000000-0000-4000-8000-000000000202'::uuid,0,'地形ツールで島を作る'),
    ('00000000-0000-4000-8000-000000000202'::uuid,1,'スクリプトの基礎〜Luaを書いてみよう〜'),
    ('00000000-0000-4000-8000-000000000202'::uuid,2,'パーツ配置とグループ化'),
    ('00000000-0000-4000-8000-000000000202'::uuid,3,'NPCの動きを設定しよう'),
    ('00000000-0000-4000-8000-000000000202'::uuid,4,'ゲームループの実装'),
    ('00000000-0000-4000-8000-000000000202'::uuid,5,'ゲームUI〜スコア表示〜制作'),
    ('00000000-0000-4000-8000-000000000203'::uuid,0,'タイピング練習〜ホームポジション〜'),
    ('00000000-0000-4000-8000-000000000203'::uuid,1,'HTML基礎〜見出しとリスト〜'),
    ('00000000-0000-4000-8000-000000000203'::uuid,2,'CSSで色とフォントを変えよう'),
    ('00000000-0000-4000-8000-000000000203'::uuid,3,'フォームとボタンの作り方'),
    ('00000000-0000-4000-8000-000000000203'::uuid,4,'Python基礎〜変数と演算〜'),
    ('00000000-0000-4000-8000-000000000203'::uuid,5,'プロジェクト制作〜自己紹介ページ〜'),
    ('00000000-0000-4000-8000-000000000204'::uuid,0,'線画練習〜基本的な形〜'),
    ('00000000-0000-4000-8000-000000000204'::uuid,1,'色塗りの基礎〜グラデーション〜'),
    ('00000000-0000-4000-8000-000000000204'::uuid,2,'レイヤーを使った作画'),
    ('00000000-0000-4000-8000-000000000204'::uuid,3,'キャラクターデザインに挑戦'),
    ('00000000-0000-4000-8000-000000000204'::uuid,4,'背景イラストを描こう'),
    ('00000000-0000-4000-8000-000000000204'::uuid,5,'ポートフォリオ用作品制作')
  ) as t(course_id, idx, title)
),
lesson_rows as (
  select
    d.*,
    t.title,
    case
      when ((d.n * 13 + d.week_offset) % 10) = 0 then 'absent'::text
      when ((d.n * 7  + d.week_offset) % 12) = 5 then 'late'::text
      else 'present'::text
    end as attendance_status
  from dates_12w d
  join titles t
    on t.course_id = d.course_id
    and t.idx = d.week_offset % 6
)
insert into public.lesson_records (
  lesson_record_id, student_id, course_id,
  lesson_date, start_time, end_time,
  title, content, homework, attendance_status
)
select
  ('2' || lpad(lr.n::text, 7, '0') || '-' || lpad(lr.week_offset::text, 4, '0') || '-4000-8000-000000000000')::uuid,
  lr.student_id,
  lr.course_id,
  lr.lesson_date,
  lr.start_time,
  (lr.start_time + interval '90 minutes')::time,
  case when lr.attendance_status = 'absent' then '欠席' else lr.title end,
  case
    when lr.attendance_status = 'absent' then null
    when lr.course_id = '00000000-0000-4000-8000-000000000204'::uuid then
      '今日の目的：' || lr.title ||
      E'\n\nレッスン使用ツール：Clip Studio Paint\n\nレッスンの様子：' ||
      (array[
        '筆圧を意識しながら丁寧に描いていた。線がきれいになってきた。',
        '構図を何度も試行錯誤しながら進めていた。',
        '色の組み合わせを楽しみながら塗れていた。センスが光る。'
      ])[((lr.n + lr.week_offset) % 3) + 1] ||
      E'\n\n今日のワクワクの様子：' ||
      (array[
        '完成した絵を見て「上手くなった！」と喜んでいた。',
        '次は背景も描きたいと話していた。創作意欲が高い。',
        '大切にスクリーンショットを撮って帰った。'
      ])[(lr.week_offset % 3) + 1]
    else
      '今日の目的：' || lr.title ||
      E'\n\nタイピング使用ツール：' ||
      (array['Typing.com', 'Keybr', 'e-Typing'])[((lr.n + lr.week_offset) % 3) + 1] ||
      E'\n\nタイピングの様子：' ||
      (array[
        '集中して取り組んでいた。先週よりスピードが上がった。',
        'ホームポジションを意識しながら練習できていた。',
        'ミスが減ってきた。正確さを意識して練習していた。'
      ])[(lr.week_offset % 3) + 1] ||
      E'\n\nレッスン使用ツール：' ||
      case lr.course_id
        when '00000000-0000-4000-8000-000000000201'::uuid then 'Scratch 3.0'
        when '00000000-0000-4000-8000-000000000202'::uuid then 'Roblox Studio'
        else 'VS Code / ブラウザ'
      end ||
      E'\n\nレッスンの様子：' ||
      (array[
        '積極的に質問してくれた。ヒントなしで課題をクリアできた。',
        '少し詰まる場面もあったが、自分でエラーを修正できた。',
        '前回の内容をしっかり覚えていてスムーズに進んだ。'
      ])[((lr.n + lr.week_offset) % 3) + 1] ||
      E'\n\n今日のワクワクの様子：' ||
      (array[
        '完成したものを何度も動かして「できた！」と喜んでいた。',
        '自分でアレンジを加えて楽しんでいた。次回も意欲的。',
        '友達に見せたいと話していた。制作意欲が高まっている。'
      ])[(lr.week_offset % 3) + 1]
  end,
  case
    when lr.attendance_status = 'absent' then null
    when lr.course_id = '00000000-0000-4000-8000-000000000201'::uuid then
      (array[
        '今日の続きを家で進めてみること。',
        '作ったゲームを保存して次回持ってくること。',
        '次回はクローンブロックに挑戦する予定。'
      ])[(lr.week_offset % 3) + 1]
    when lr.course_id = '00000000-0000-4000-8000-000000000202'::uuid then
      (array[
        '作った地形をさらに作り込んでくること。',
        'スクリプトのサンプルを読んでおくこと。',
        '次回はゲームの勝利条件を実装する予定。'
      ])[(lr.week_offset % 3) + 1]
    when lr.course_id = '00000000-0000-4000-8000-000000000203'::uuid then
      (array[
        'HTMLで好きなテーマのページを作ってくること。',
        'CSSでスタイルを変えて試してみること。',
        '次回はJavaScriptの基礎を学ぶ予定。'
      ])[(lr.week_offset % 3) + 1]
    else
      (array[
        'スケッチブックで練習してくること。',
        '好きなキャラクターを模写してみること。',
        '次回は背景イラストに挑戦する予定。'
      ])[(lr.week_offset % 3) + 1]
  end,
  lr.attendance_status
from lesson_rows lr
on conflict (lesson_record_id) do nothing;
