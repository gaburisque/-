# 生徒情報管理アプリ

学習塾・教室向けの生徒管理Webアプリです。Next.js、TypeScript、Supabase、PostgreSQL、Tailwind CSS、shadcn/ui相当のローカルUIコンポーネントで構成しています。

## 機能

- Supabase Authによるログイン必須化（admin / staff ロール制御あり）
- Dashboardで生徒数、今日の授業記録数、最近更新された生徒を表示
- 生徒一覧、検索、学年・学校フィルター、CSVエクスポート（adminのみ）
- 生徒登録・基本情報編集
- 生徒詳細で保護者、緊急連絡先、受講コース、授業履歴を表示
- 保護者、緊急連絡先、受講コース、授業記録の追加
- 授業記録一覧・詳細・編集・編集履歴
- 出席管理（日付別の出欠ステータス更新）
- 週間スケジュール（担当講師割り当て）
- 教材・書類アップロード（Supabase Storage）
- スタッフ管理（adminのみ）

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. Supabaseプロジェクトを用意

Supabaseでプロジェクトを作成し、SQL Editorで以下を**順番に**実行します。

```
supabase/schema.sql
supabase/migrations/001_add_features.sql
supabase/migrations/002_normalize_grades_and_courses.sql
supabase/migrations/003_fix_course_display_names.sql
supabase/migrations/004_role_based_rls.sql
```

`supabase/seed.sql` は動作確認用のサンプルデータです。本番では省略してください。

### 3. 環境変数を設定

`.env.local` を作成します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. adminアカウントを作成

1. Supabase Dashboard → **Authentication → Users → Add user** でオーナー用メールを登録
2. アプリに一度ログイン
3. Supabase **Table Editor → staff** でそのユーザーの `role` を `admin` に変更

### 5. Storageバケットを作成

1. Supabase Dashboard → **Storage** → **New bucket**
2. バケット名: `student-documents`、公開設定: オフ（Private）
3. **SQL Editor** で以下を実行してStorageポリシーを設定

```sql
create policy "student_documents_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'student-documents');

create policy "student_documents_insert_authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'student-documents');

create policy "student_documents_delete_admin_only"
on storage.objects for delete to authenticated
using (bucket_id = 'student-documents' and public.is_admin_user());
```

### 6. 起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。未ログイン時は `/login` に移動します。

## 権限モデル

| 操作 | admin | staff |
|------|-------|-------|
| 生徒一覧・詳細・記録の閲覧 | ○ | ○ |
| 授業記録の作成・編集 | ○ | ○ |
| 出席・スケジュール更新 | ○ | ○ |
| CSVエクスポート | ○ | × |
| Staffページ（権限管理） | ○ | × |
| 書類削除 | ○ | × |
| DBの削除系操作（RLS） | ○ | × |

アカウント作成はSupabase Authで管理者が行います。`/signup` は停止しています。

## 開発用コマンド

```bash
npm run typecheck
npm run build
npm run lint
```

## DB設計メモ

- 主キーは各テーブルで `xxx_id` のUUIDです。
- リレーションは名前ではなくIDで管理します。
- `students` を中心に、`guardians`、`emergency_contacts`、`enrollments`、`lesson_records` を紐付けています。
- `student_accounts` は将来の生徒ログイン用テーブルです。現在はUIに表示していません。
- 権限ヘルパー `public.is_admin_user()` が `staff.role = 'admin'` を判定します。

## マイグレーション実行順

| ファイル | 内容 |
|----------|------|
| `schema.sql` | 基本テーブル・RLS有効化 |
| `001_add_features.sql` | 出欠、履歴、書類、担当割り当てテーブル追加 |
| `002_normalize_grades_and_courses.sql` | 学年・コース名のDB正規化 |
| `003_fix_course_display_names.sql` | Scratch / Roblox 表記修正 |
| `004_role_based_rls.sql` | role-based RLS と `is_admin_user()` 関数 |

## 現場運用チェックリスト

### 1. 本番化の土台

- [ ] Supabaseを本番用と検証用（Staging）に分離する
- [ ] VercelにProductionとPreviewを用意する（GitHub連携）
- [ ] Vercel環境変数に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定する
- [ ] 本番URLを確定し、運用メンバーに共有する

### 2. セキュリティ・権限

- [x] Supabaseの公開Sign upを無効化する
- [x] adminアカウントを作成し `staff.role = 'admin'` にする
- [x] role-based RLS を適用する（`004_role_based_rls.sql`）
- [x] Storageの削除をadminのみに制限する
- [ ] 退職者・異動者アカウントの無効化手順を決める
- [ ] 個人情報の閲覧範囲を明文化する

### 3. データ運用

- [ ] バックアップ方針（頻度・保存期間・担当者）を決める
- [ ] 復元手順をリハーサルして記録する（検証Supabaseで実施）
- [ ] 生徒登録/更新/削除ルール（重複防止含む）を決める

### 4. 品質担保

- [ ] PR前に `npm run typecheck` / `npm run build` を必須化する
- [ ] 権限テスト（admin / staff / 未ログイン）を毎回実施する
- [ ] リリース前チェックリストでGo/No-Goを判断する

### 5. 現場リリース

- [ ] 先行運用（1〜2週間）する
- [ ] 問い合わせ窓口と優先度ルール（緊急/通常）を定義する
- [ ] 月1回で改善要望を棚卸しし、次サイクルへ反映する

## 機能アップデートの進め方

### 基本ルール

- `main` は常にリリース可能状態を維持する
- 実装は `feature/*` ブランチで進める
- PR作成後にPreviewで確認してから `main` にマージする
- `main` マージ後に本番デプロイする（Vercel連携）

### 1機能ごとの流れ

1. 要望を「誰の業務をどう改善するか」で1〜3行に定義する
2. 最小実装単位に分割して優先順位を決める
3. `feature/*` で実装し、PRに確認項目と影響範囲を記載する
4. Preview環境で現場担当に動作確認してもらう
5. 承認後に `main` マージして本番反映する

### DB変更を含む場合の注意

- 破壊的変更（列削除/型変更）は避け、追加ベースで進める
- 本番前に検証DBで同じ変更を適用して確認する
- 新しいマイグレーションファイルは `supabase/migrations/` に追番で追加する

## 次にやること

1. Supabaseの本番/検証（Staging）プロジェクト分離
2. バックアップ・復元テストの手順を決めて運用化
3. VercelのProduction/Preview環境変数をそれぞれの Supabase に向ける

## 障害時チェック（最初に確認）

- [ ] Supabaseプロジェクトの稼働状態を確認する（停止/一時停止していないか）
- [ ] Vercelの環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）を確認する
- [ ] 環境変数の値に前後の空白や改行が混ざっていないか確認する
- [ ] 環境変数更新後に `Redeploy` / `Clear cache and redeploy` を実行する
