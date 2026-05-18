# エージェント引き継ぎメモ

最終更新日: 2026-05-18（授業記録の仮データ投入・曜日分配改善）

このファイルは、別のエージェントが最初に読むための引き継ぎメモです。アプリの目的、構成、DB、運用方針、セキュリティ課題、次にやることをまとめています。秘密情報、実データ、Supabaseキー、オーナーの認証情報は絶対に書かないでください。

## プロダクト概要

**ClassNote** — 学習塾・教室向けの生徒管理Webアプリです。表示名は `lib/branding.ts` の `APP_NAME` で一元管理。生徒、保護者、緊急連絡先、受講コース、授業記録、出席、教材・書類、講師、週間スケジュールを管理する想定です。

現在の方針は、追加機能を増やすよりも先に、本番運用に向けたセキュリティ、権限、バックアップ、オーナーへの引き継ぎを固めることです。

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
- `staff`: 講師・職員情報。Supabase Authの `auth.users` と `auth_user_id` で紐づく。`role` は `admin` または `staff`。
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
- `/students`: 生徒一覧、検索、フィルター、CSV出力
- `/students/[student_id]`: 生徒詳細
- `/lesson-records`: 授業記録一覧
- `/lesson-records/new`: 授業記録作成
- `/lesson-records/[lesson_record_id]`: 授業記録詳細・編集・履歴
- `/attendance`: 出席管理
- `/schedule`: 週間スケジュールと担当講師割り当て
- `/documents`: 生徒関連書類のアップロード・一覧・ダウンロード・削除
- `/staff`: 講師・職員管理

Server Actions は主に `app/actions.ts` にあります。

主な処理:

- ログイン、ログアウト、サインアップ
- 必要に応じてログインユーザーの `staff` レコードを自動作成
- 生徒の作成・更新。保存時に学年を正規化
- 授業記録の更新時に、更新前の内容を `lesson_record_history` に保存
- 出席ステータス更新
- スケジュールの担当講師割り当て
- 講師プロフィールの作成・更新

API Routes:

- `app/api/students/export/route.ts`: 生徒情報CSV出力。表示用の正規化を含む。
- `app/api/schedule/assignment/route.ts`: Scheduleページの担当講師割り当て更新。

## 主要ユーティリティ

- `lib/supabase/server.ts`: サーバー側Supabaseクライアント
- `lib/supabase/client.ts`: ブラウザ側Supabaseクライアント
- `lib/supabase/middleware.ts`: 認証必須ページのリダイレクト制御
- `lib/types.ts`: DB関連の型
- `lib/grades.ts`: 学年の正規化・表示
- `lib/courses.ts`: コース名の正規化
- `lib/enrollments.ts`: 重複受講データの整理
- `lib/relations.ts`: Supabaseのリレーション値を1件に揃えるヘルパー
- `lib/format.ts`: 表示フォーマット
- `lib/weekdays.ts`: 曜日選択肢
- `lib/lesson-times.ts`: 授業時間選択肢
- `lib/lesson-records.ts`: 授業記録関連ヘルパー

## 実装済み機能

- Supabase Authによるログイン必須化
- ダッシュボード
- 生徒一覧・詳細・作成・更新
- 保護者・緊急連絡先の管理
- 受講コース表示
- 授業記録の作成・一覧・詳細・編集・削除
- 授業記録の編集履歴
- 授業記録の出欠入力（記録作成時・詳細編集・出欠ページで一括保存）
- 授業記録の CSV エクスポート（全件・生徒別・期間指定）
- 授業記録の印刷ビュー（詳細ページに印刷ボタン）
- 授業記録一覧のコースフィルター
- 授業記録一覧の「仮データ追加」ボタン：画面確認用の仮生徒・受講登録・直近8週分の授業記録を upsert で投入
- 授業記録入力ページの曜日分け：前回の授業記録の曜日を優先し、前回記録がない場合は `enrollments.weekday` を使う
- 出欠管理（日付選択 + 一括保存）
- 教材・書類アップロード
- 週間スケジュールと担当講師割り当て
- 生徒情報CSV出力
- 学年表記の正規化
- コース名の正規化
- 学年一括進級（4月進級ボタン）：active生徒を全員 +1 学年。高3 → grade = null → 生年月日から年齢表示
- `lib/grades.ts` に `nextGrade` / `calcAge` / `formatGradeOrAge` を追加
- 生徒詳細ページの授業履歴：出欠バッジ・コース色・行ホバーで削除ボタン表示・CSV出力

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
- `/staff` は現状、ログイン済みユーザーならアクセスできる可能性がある
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

最優先:

1. admin仮アカウントが `staff.auth_user_id` に紐づき、`staff.role = 'admin'` になっているか確認
2. セキュリティ強化。adminガード、admin限定ページ・操作の実装
3. role-based RLS のマイグレーション作成
4. バックアップ・復元手順の運用ドキュメント作成
5. Staging用Supabaseプロジェクトの作成
6. Scheduleのコンパクト表示がコミット・プッシュ済みか確認

機能追加は、上記の本番運用準備が終わってから優先度を決める。

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
