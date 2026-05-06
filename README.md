# 生徒情報管理アプリ MVP

学習塾・教室向けの生徒管理Webアプリです。Next.js、TypeScript、Supabase、PostgreSQL、Tailwind CSS、shadcn/ui相当のローカルUIコンポーネントで構成しています。

## 機能

- Supabase Authによるログイン必須化
- Dashboardで生徒数、今日の授業記録数、最近更新された生徒を表示
- 生徒一覧、検索、学年・学校フィルター
- 生徒登録・基本情報編集
- 生徒詳細で保護者、緊急連絡先、受講コース、授業履歴を表示
- 保護者、緊急連絡先、受講コース、授業記録の追加
- 授業記録一覧、生徒別・日付別フィルター

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. Supabaseプロジェクトを用意

Supabaseでプロジェクトを作成し、SQL Editorで以下を順に実行します。

```bash
supabase/schema.sql
supabase/seed.sql
```

`seed.sql` は動作確認用のサンプルデータです。本番利用では必要に応じて省略してください。

### 3. 環境変数を設定

`.env.local.example` を参考に `.env.local` を作成します。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. ログインユーザーを作成

Supabase Dashboardの Authentication から職員用ユーザーを作成します。

このMVPでは、RLSにより `authenticated` ユーザーだけが各テーブルを閲覧・操作できます。パスワードはSupabase Authが管理し、アプリDBには保存しません。

### 5. 起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。未ログイン時は `/login` に移動します。

## 開発用コマンド

```bash
npm run typecheck
npm run build
```

## DB設計メモ

- 主キーは各テーブルで `xxx_id` のUUIDです。
- リレーションは名前ではなくIDで管理します。
- `students` を中心に、`guardians`、`emergency_contacts`、`enrollments`、`lesson_records` を紐付けています。
- `student_accounts` は将来の生徒ログイン用テーブルとして定義していますが、初期MVPのUIには表示していません。
- 移行用の `raw_student_name` や `source_sheet` などは本番UIには出していません。
