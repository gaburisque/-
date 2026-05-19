# エージェント引き継ぎメモ

最終更新日: 2026-05-18（`staff-accounts-and-auth-policy.md` を単体完結・リンクなしに全面改訂）

このファイルは、別のエージェントが最初に読むための引き継ぎメモです。アプリの目的、構成、DB、運用方針、セキュリティ課題、次にやることをまとめています。秘密情報、実データ、Supabaseキー、オーナーの認証情報は絶対に書かないでください。

## プロダクト概要

**ClassNote** — 学習塾・教室向けの生徒管理Webアプリです。表示名は `lib/branding.ts` の `APP_NAME` で一元管理。生徒、保護者、緊急連絡先、受講コース、授業記録、出席、教材・書類、講師、週間スケジュールを管理する想定です。

現在の方針は、追加機能を増やすよりも先に、本番運用に向けたセキュリティ、権限、バックアップ、オーナーへの引き継ぎを固めることです。

**スタッフ認証・アカウント運用およびアプリ俯瞰の単体完結版**は **`docs/staff-accounts-and-auth-policy.md`**（文中に外部リンクなし）。**ログイン運用の製品決定（2026-05）**: メール＋パスワード、管理者のみ作成・一時パスワード、パスワード再設定は admin、**メール変更不可**、admin 約3名がログイン停止可、退職時は記録者残す — 同ドキュメントの「合意したログイン・アカウント運用方針」節。

## 技術スタック

- フレームワーク: Next.js App Router
- 言語: TypeScript
- UI: Tailwind CSS と `components/ui` 配下のローカルUIコンポーネント
- 認証: Supabase Auth
- データベース: Supabase PostgreSQL
- ファイル保存: Supabase Storage
- ホスティング: Vercel
- コード管理: GitHub

よく使うコマンド:

```bash
npm run dev
npm run build
npm run typecheck
```

`package.json` には `lint` スクリプトがありますが、Next.jsのバージョンとの相性を確認してから信頼してください。

## 本番運用の推奨構成

推奨構成:

- GitHub `main` -> Vercel Production -> Supabase Production
- feature/preview ブランチ -> Vercel Preview -> Supabase Staging
- 本番用Supabaseと検証用Supabaseは分ける
- 実際の生徒情報を扱うなら、DB消失対策として Supabase Pro などバックアップ・復元を重視した構成を優先する

GitHub Pagesだけでの本番運用は不可です。このアプリはサーバー処理、認証、DB、Storageを使います。

## 主なDB構造

基本スキーマは `supabase/schema.sql` です。

主要テーブル:

- `students`: 生徒の基本情報。学年、学校、住所、ステータスなど。
- `schools`: 学校マスタ。
- `addresses`: 住所情報。
- `guardians`: 保護者情報。生徒に紐づく。
- `emergency_contacts`: 緊急連絡先。生徒に紐づく。
- `courses`: コースマスタ。
- `enrollments`: 受講情報。曜日 `weekday`、開始時間 `start_time` を持つ。
- `lesson_records`: 授業記録。生徒、コース、講師に紐づく。
- `staff`: 講師・職員情報。Supabase Authの `auth.users` と `auth_user_id` で紐づく。`role` は `admin` または `staff`。運用・セットアップの単体完結ドキュメントは **`docs/staff-accounts-and-auth-policy.md`**。
- `student_accounts`: 将来の生徒ログイン用。現時点では主要UIでは使っていない。

追加マイグレーション:

- `supabase/migrations/001_add_features.sql`
  - `lesson_records.attendance_status` を追加
  - `lesson_record_history` を追加
  - `student_documents` を追加
  - `lesson_assignments` を追加
  - Supabase Storage バケット `student-documents` はSupabase UIで作る必要がある
- `supabase/migrations/002_normalize_grades_and_courses.sql`
  - 学年表記とコースIDの正規化
- `supabase/migrations/003_fix_course_display_names.sql`
  - `Scratch` / `Roblox` の表示名修正

注意: リポジトリにSQLファイルがあるだけでは本番DBは変わりません。Supabase SQL Editor、または管理されたマイグレーション手順で実行する必要があります。

## アプリ構成

主なルート:

- `/login`: ログイン
- `/signup`: サインアップ。本番では無効化またはadmin招待制にするべき
- `/dashboard`: ダッシュボード
- `/students`: 生徒一覧。**詳細条件**（記録一覧と同様の折りたたみ）で検索・学年・学校を指定。**オーナーのみ**電話・メール・学校列。講師は氏名・学年・状態のみ。一覧からのCSVボタンはなし（エクスポートAPIは残す）
- `/students/new`: 生徒新規登録（**オーナーのみ**。それ以外は `/students` へリダイレクト）。**基本情報に加え、任意で保護者・緊急連絡先・1件の受講コースを同一フォームで登録可能**。学校はテキスト入力（同名があれば既存 `schools` に紐づけ、なければ新規行を作成）。性別は「男／女／その他」の選択。
- `/students/[student_id]`: 生徒詳細。**基本情報・保護者・緊急連絡先はオーナーのみ**閲覧・編集（DBクエリもスキップ）。講師は氏名・学年・受講コース・授業履歴など運用に必要な範囲
- `/lesson-records`: 授業記録一覧（詳細条件・学年・グループ化・並び替え）。詳細条件で生徒を選ぶと即 `student_id` 付きURLへ遷移。生徒絞り込み時はバナーとカード右「編集」で詳細ページへ
- `/lesson-records/new`: **授業記録入力**。**タブの曜日は「記録する日付のカレンダー曜日」**（`weekday` クエリと日付がずれていればリダイレクトで整合）。左一覧は **直近記録の曜日** で並べるバケット（無記録は **`enrollments.weekday`**）。曜日タブは **±3日以内で最も近い日付**に移動（`shiftDateToNearestWeekday`）。**「定:○曜」バッジなし**。左の **生徒検索** は **候補選択時はクライアント状態のみ更新**。受講 **1件なら** `router.replace` で `enrollment_id`、**複数**はパネル内リンク。**`?student_id=`** 単一受講はサーバーリダイレクト。**`enrollment_id` は一覧外でもフォーム表示**。**xl** 右 sticky。**学年・コースの左カード絞り込みなし**。
- `/lesson-records/[lesson_record_id]`: 授業記録詳細・編集・履歴
- `/attendance`: 出席管理
- `/courses`: **コース管理（新規）**。コースの追加・名称変更・説明編集・停止/再開
- `/schedule`: 週間スケジュールと担当講師割り当て
- `/documents`: 生徒関連書類のアップロード・一覧・ダウンロード・削除
- `/staff`: 講師・職員管理
- `/settings`: 各種管理へのハブ。**オーナー**には上部に「4月進級」「生徒を登録」「生徒一覧」カードを表示（講師には非表示）
- `/settings/account`: **ログインのメール・パスワード変更**（認証済みユーザー全員）

Server Actions は主に `app/actions.ts` にあります。

主な処理:

- ログイン、ログアウト、サインアップ
- **`staff` の自動作成は行わない。** `/staff` で「ログイン用アカウントも作成する」オン時は **`SUPABASE_SERVICE_ROLE_KEY`** を使った Admin API で `auth.users` を作成し、続けて **`staff` に `auth_user_id` を設定**（`createStaffProfile`）。オフ時は従来どおり `staff` 行のみ。Dashboard 手動運用も可。`ensureCurrentStaffId` は **`auth_user_id` のみ**で講師を解決（メールフォールバックなし）
- ログインユーザーの **メール・パスワード変更**: `updateOwnEmail` / `updateOwnPassword`（`/settings/account`）
- 生徒の作成（同一フォームで任意の保護者・緊急連絡先・受講1件を続けて作成可能）、更新、保護者・緊急連絡先の追加、一括進級は **`assertCurrentUserIsAdmin()`** によりオーナーのみ（それ以外はエラー）
- 授業記録の更新時に、更新前の内容を `lesson_record_history` に保存
- 出席ステータス更新
- スケジュールの担当講師割り当て
- 講師プロフィールの作成・更新

API Routes:

- `app/api/students/export/route.ts`: 生徒情報CSV出力（**管理者のみ**。一覧UIからの導線は撤去済み）
- `app/api/schedule/assignment/route.ts`: Scheduleページの担当講師割り当て更新。

## 主要ユーティリティ

- `lib/supabase/server.ts`: サーバー側Supabaseクライアント（Cookie セッション）
- `lib/supabase/service-role.ts`: **`SUPABASE_SERVICE_ROLE_KEY`** のみで Admin API 用クライアントを生成（スタッフの Auth ユーザー作成）。キーはサーバー専用
- `lib/supabase/client.ts`: ブラウザ側Supabaseクライアント
- `lib/supabase/middleware.ts`: 認証必須ページのリダイレクト制御
- `lib/types.ts`: DB関連の型
- `lib/authz.ts`: `isCurrentUserAdmin`（オーナー判定）、`assertCurrentUserIsAdmin`（Server Action ガード）
- `lib/grades.ts`: 学年の正規化・表示
- `lib/courses.ts`: コース名の正規化
- `lib/enrollments.ts`: 重複受講データの整理
- `lib/relations.ts`: Supabaseのリレーション値を1件に揃えるヘルパー
- `lib/format.ts`: 表示フォーマット
- `lib/weekdays.ts`: 曜日選択肢、`weekdayFromDate`、`addCalendarDaysInTokyo`、`shiftDateToNearestWeekday`（記録入力の曜日タブ用）
- `lib/lesson-times.ts`: 授業の開始・終了時刻の **30分刻み** 選択肢（8:00〜22:00）、既存の微妙な時刻は編集時に候補へマージ
- `lib/lesson-records.ts`: 授業記録関連ヘルパー
## 実装済み機能

- Supabase Authによるログイン必須化
- ダッシュボード
- 生徒一覧・詳細（講師は個人情報のない範囲）・**オーナーのみ**作成・更新・進級（生徒CSVはAPIのみ）
- **オーナーのみ**保護者・緊急連絡先の閲覧・追加（UI非表示＋Server Action ガード＋一覧クエリから連絡先除外）
- 受講コース表示・受講登録の削除・スケジュール（曜日・時間）変更
- 授業記録の作成・一覧・詳細・編集・削除・編集履歴
- 授業記録の出欠入力（記録作成時・詳細編集・出欠ページで一括保存）
- 授業記録の CSV エクスポート（**API** `/api/lesson-records/export`・生徒詳細のボタンなど。記録一覧ヘッダーからのCSV UIはなし）
- 授業記録の印刷ビュー
- 授業記録一覧：コース・曜日・年・学年・グループ化・並び替え。**生徒検索で一覧から選ぶとルーターで即絞り込み**。生徒指定時はバナー＋カード右「編集」で詳細編集ページへ
- **授業記録入力画面（/lesson-records/new）全面リニューアル（2026-05-18）**
  - 曜日タブ（月〜土、今日自動選択）
  - 日付選択（過去日も入力可）
  - 生徒リストに記録済 ✓ / 下書き ⏱ / 未記録 ○ のバッジ
  - 選択生徒の前回記録を折りたたみで表示
  - 構造化フォーム：出欠・目的・タイピング使用ツール・タイピングの様子・授業の様子・子どもの反応・次回予定・備考
  - 下書き保存（attendance_status=null のまま保存→詳細編集ページへ遷移）
  - タブ曜日＝記録日のカレンダー曜日。左リストのバケットは **直近記録の曜日**、無ければ **登録曜日**。タブで日付を近傍同期
- **コース管理ページ（/courses）新規追加（2026-05-18）**
  - コース一覧（開講中 / 停止中）
  - 名称・説明の編集・保存
  - 停止 / 再開の切り替え
  - 新規コースの追加
- ナビメニュー整理：「記録入力」を削除し「コース」を追加
- 過去記録の仮データ：`supabase/seed_lesson_records.sql` はテスト生徒1〜100に直近12週分を生成。任意DBでは `supabase/seed_past_lesson_records_for_active_enrollments.sql` を SQL Editor で実行（active 受講ごとに欠けている週を最大24週バックフィル・再実行安全）
- 出欠管理（日付選択 + 一括保存）
- 教材・書類アップロード
- 週間スケジュールと担当講師割り当て
- サイドナビの「生徒登録」はオーナーのみ表示（`AppShell` で `isCurrentUserAdmin` によりフィルタ）
- **`/settings/account`**: ログイン済みユーザーが **メール変更**（確認メール）・**パスワード変更**（現在パスワードの確認あり）
- **管理者の `/staff`**: 「ログイン用アカウントも作成する」で **Admin API により Auth ユーザー作成 + `staff` 挿入**（`.env` に `SUPABASE_SERVICE_ROLE_KEY` が必要）。オフ時は従来どおり `staff` のみ
- 学年一括進級（4月進級）：**設定ページのオーナー向けカード**から実行。`bulkPromoteGrades` はオーナーのみ
- `lib/grades.ts` に `nextGrade` / `calcAge` / `formatGradeOrAge` を追加
- 生徒詳細の授業履歴：カード一覧・出欠バッジ・コース色・詳細リンク・行ホバーで削除。講師も閲覧可

## Scheduleページの経緯

Scheduleページは複数回改善されています。

- 最初は曜日ごとの一覧形式
- その後、全曜日×全時間帯のグリッド表示に変更
- ユーザーから「下に長いカレンダーになって一覧性が悪い」とフィードバックあり
- 現在の方向性は、曜日タブで切り替えるコンパクトなカレンダー・テーブル形式

関係ファイル:

- `app/schedule/page.tsx`
- `app/schedule/schedule-grid.tsx`
- `app/api/schedule/assignment/route.ts`
- `lib/enrollments.ts`
- `lib/courses.ts`

注意: 以前、Scheduleのコンパクト表示をコミット・プッシュしようとした際にユーザー操作で中断された可能性があります。Schedule作業を続ける前に `git status` を確認してください。

## セキュリティ状況

現状はMVPレベルです。本番の個人情報管理システムとしては、まだセキュリティ強化が必要です。

2026-05-17時点の進捗:

- ユーザーがSupabaseの公開Sign upを無効化済み。
- admin用の仮アカウントをSupabase Authに登録済み。
- admin仮アカウントの `staff` 紐づけと `role = admin` を確認済み。
- アプリ側で一次的なadmin制御を追加済み（`/staff` ページ、Staff管理 actions、CSV出力API）。
- `/signup` 導線は停止済み（login画面からリンク削除、`/signup` は login へリダイレクト）。
- `ensureCurrentStaffId` の自動 staff 作成は停止済み（未連携ユーザーは自動昇格しない）。
- `documents` 画面の削除ボタンは admin のみ表示に変更済み。
- role-based RLS の草案SQL `supabase/migrations/004_role_based_rls.sql` を追加済み。
- SupabaseでStorageポリシー再実行済み（`student-documents` の policy 作成成功）。
- admin / staff 実機確認完了、問題なし（2026-05-17）。
- セキュリティ第一段は完了。
- `docs/backup-policy.md` を作成済み（バックアップ手順・Staging構築・退職者対応を記載）。
- Supabase Staging プロジェクトを作成し、Vercel Preview 環境変数を Staging に向ける方針。
- `supabase/seed.sql` は Staging 動作確認用に、正式4コース（Scratch / Roblox / ITオンライン部 / イラスト）と約100人の仮生徒・保護者・受講データ、授業記録の仮データを投入する内容に更新済み。本番には投入しない。

高優先度の懸念:

- `/signup` やSupabase側のSign upが有効だと、URLを知っている人がアカウント作成できる可能性がある
- `supabase/schema.sql` のRLSが広い。現在は `authenticated` ユーザーに対して `using (true) with check (true)` の方針
- `staff.role` に `admin` / `staff` はあるが、アプリ側・API側・RLS側で十分に強制されていない
- 歴史的メモに `/staff` をログイン済みなら誰でも閲覧できる可能性と書いた箇所があるが、**現状の `app/staff/page.tsx` は admin でなければ `/settings` へリダイレクト**する。API・将来ルートでは別途確認。
- CSV出力は個人情報を含むため、admin限定にするべき
- 書類アップロード・ダウンロード・削除は、Storageポリシーとアプリ側権限の両方で制限するべき
- 監査ログが不足している。授業記録には履歴があるが、生徒・保護者・講師・書類などの変更履歴はまだ不十分

本番前の最低限のセキュリティ対応:

1. Supabaseの公開Sign upを無効化し、`/signup` を削除またはadmin招待制にする（対応済み）
2. 教室オーナーのアカウントを作り、`staff.role = 'admin'` にする（仮アカウント作成済み、DB紐づけ確認が必要）
3. `getCurrentStaff()` / `requireAdmin()` のようなサーバー側権限ヘルパーを追加する
4. Staff管理、CSV出力、削除系、書類操作、重要設定をadmin制限する
5. broadなRLSをrole-based policyに置き換える
6. 重要操作の監査ログを追加する
7. バックアップ、外部保存、復元テスト、退職者アカウント停止の運用を決める

## バックアップとDB消失対策

オーナーはデータベース消失を懸念しています。

推奨構成:

- Supabase Production: 本番DB
- Supabase Staging: 検証・復元テスト用DB
- Supabaseの自動バックアップ。可能なら本番では有料プランを検討
- Supabase外への定期エクスポート。Google Driveや会社のストレージなど
- 月1回または四半期ごとにStagingへ復元テスト

オーナー向け説明:

> データはSupabase上で管理します。本番DBには自動バックアップを設定し、それとは別に定期的な外部バックアップも保存します。さらに検証環境で復元テストを行い、「バックアップがある」だけでなく「実際に戻せる」状態で運用します。

## オーナーへの共有・権限譲渡

初期共有:

- オーナーには本番URLとログインアカウントだけ共有する
- `.env.local`、Supabaseのservice role key、管理者認証情報は共有しない
- オーナーは `admin`、講師は `staff`
- 初期運用では、Vercel / Supabase / GitHub の管理は開発者側に残してもよい

完全譲渡する場合:

- Supabaseの組織またはプロジェクト権限をオーナーへ移す
- Vercel TeamのOwnerをオーナーにする
- GitHubリポジトリを移管、またはオーナーを管理者にする
- 請求情報をオーナー側へ移す
- 継続保守がある場合のみ、開発者をCollaboratorとして残す

## 現在の次タスク

### UI改善（進行中・ユーザー主導）

2026-05-18 のセッションでユーザーからUI改善の要望が出て対応中。以下はすでに完了済み：

- [x] 授業記録入力画面リニューアル（曜日タブ・前回記録表示・フォーム構造化・下書き保存）
- [x] コース管理ページ追加
- [x] ナビ整理

- [x] 記録一覧ページをカード型・曜日ピル・詳細条件折りたたみ・ページネーション付きで刷新（2026-05-18）

### 次にやること（UI）

- Vercel にデプロイ済みの本番環境で動作確認
- 仮データを使って記録入力画面の使い勝手を確認・フィードバック反映
- `scripts/seed-mock.ts` を使ってローカルまたはStagingに仮データを投入（要ログイン認証情報）

### 本番運用準備（優先度高）

1. admin仮アカウントが `staff.auth_user_id` に紐づき、`staff.role = 'admin'` になっているか確認
2. セキュリティ強化：adminガード・admin限定ページの実装
3. role-based RLS のマイグレーション作成
4. Staging用Supabaseプロジェクトへの `.env.local` 切り替えと仮データ投入
5. バックアップ・復元テストの運用確立

### 環境に関する注意

- **ローカルの `.env.local` は検証用 Supabase を指すこと。** 本番 URL のままだと `npm run dev` でも本番 DB に接続する。README に注意書きを追加済み（2026-05-18）。
- Supabase に2つのプロジェクトが存在（本番・仮）が確認済みだが、Vercel の向き先は未確認
- `scripts/seed-mock.ts` はログイン認証が必要。`SUPABASE_EMAIL` / `SUPABASE_PASSWORD` 環境変数で実行

## 会話で決まった重要方針

- 本番運用は Vercel + Supabase + GitHub が基本
- DBの耐久性と復元性が重要なので、課金優先度は Supabase が最も高い
- GitHub単体では本番ホスティングには向かない
- 引き継ぎメモは重要な節目で更新する。ただし会話全文のコピーにはしない
- 現時点では追加機能よりもセキュリティ・バックアップ・権限設計を優先する

## このファイルの更新ルール

以下のタイミングで更新してください。

- 機能が完了した
- DBマイグレーションを追加・変更した
- 認証、権限、RLS、セキュリティ、バックアップ方針が変わった
- デプロイや本番運用方針が変わった
- ユーザーがプロダクト、運用、所有権、課金に関する重要判断をした

このファイルは最新で、構造化され、次の行動が分かる状態に保ってください。未来のエージェントが、このファイルだけを読んでも作業を再開できることを目指します。
