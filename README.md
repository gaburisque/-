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

## 現場運用チェックリスト

### 1. 本番化の土台

- [ ] Supabaseを本番用と検証用に分離する
- [ ] VercelにProductionとPreviewを用意する（GitHub連携）
- [ ] Vercel環境変数に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定する
- [ ] 本番URLを確定し、運用メンバーに共有する

### 2. セキュリティ・権限

- [ ] Supabase Authの職員ユーザー登録/停止フローを決める
- [ ] RLSポリシーが職員のみを許可していることを確認する
- [ ] 退職者・異動者アカウントの無効化手順を決める
- [ ] 個人情報の閲覧範囲を明文化する

### 3. データ運用

- [ ] バックアップ方針（頻度・保存期間・担当者）を決める
- [ ] 復元手順をリハーサルして記録する
- [ ] 生徒登録/更新/削除ルール（重複防止含む）を決める
- [ ] 更新履歴を追跡できる運用ルールを決める

### 4. 品質担保

- [ ] PR前に `npm run typecheck` / `npm run lint` / `npm run build` を必須化する
- [ ] 主要業務シナリオの受け入れテストを定義する
- [ ] 権限テスト（未ログイン/権限外）を毎回実施する
- [ ] リリース前チェックリストでGo/No-Goを判断する

### 5. 現場リリース

- [ ] 1教室または1チームで先行運用（1〜2週間）する
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
6. 問い合わせと不具合を次の改善に反映する

### DB変更を含む場合の注意

- 破壊的変更（列削除/型変更）は避け、追加ベースで進める
- 本番前に検証DBで同じ変更を適用して確認する
- 大きい変更は段階移行（追加 -> コード切替 -> 旧項目廃止）で進める

## 次にやること（最短）

1. Supabaseの本番/検証分離
2. VercelのProduction/Preview連携設定
3. PRテンプレート作成（確認項目を固定）
4. 直近で追加したい機能を1つ選び、要件を最小化して `feature/*` で着手

## 障害時チェック（最初に確認）

- [ ] Supabaseプロジェクトの稼働状態を確認する（停止/一時停止していないか）
- [ ] Vercelの環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）を確認する
- [ ] 環境変数の値に前後の空白や改行が混ざっていないか確認する
- [ ] 環境変数更新後に `Redeploy` / `Clear cache and redeploy` を実行する
