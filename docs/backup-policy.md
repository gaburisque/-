# バックアップ・復元ポリシー

最終更新日: 2026-05-17

## 方針

DBの消失・破損に備えて、**3段階の保護**を持つ。

| レイヤー | 手段 | 頻度 | 保管場所 |
|----------|------|------|----------|
| 1次 | Supabase自動バックアップ | 毎日（Pro以上） | Supabase内部 |
| 2次 | SQLダンプの手動エクスポート | 週1回 | Google Drive / 外部ストレージ |
| 3次 | 復元テスト | 月1回 | Supabase Staging |

---

## 1次バックアップ: Supabase自動バックアップ

### 設定箇所

Supabase Dashboard → **Project Settings → Backups**

### プラン別の機能

| プラン | 自動バックアップ | 保持期間 | PITR |
|--------|----------------|---------|------|
| Free | なし | - | なし |
| Pro ($25/月〜) | 毎日 | 7日間 | なし |
| Team ($599/月〜) | 毎日 | 14日間 | あり |

**本番で生徒情報を扱うなら Pro 以上を推奨。**  
Free プランの場合は2次バックアップを必須とする。

---

## 2次バックアップ: 手動SQLダンプ

### 手順（週1回・月曜推奨）

1. Supabase Dashboard → **Project Settings → Database**
2. **Connection string** を確認（`Host`, `Port`, `Database`, `User` をメモ）
3. ローカルで以下を実行

```bash
pg_dump \
  --host=db.xxxx.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --format=custom \
  --file=backup_$(date +%Y%m%d).dump
```

またはSupabase Dashboardの **Database → Backups（Proプラン）** からダウンロード。

### 保管

- Google Drive の専用フォルダ（例: `教室名/DB_バックアップ/`）
- 最新8週分を保持、古いものは都度削除
- ファイル名例: `backup_20260517.dump`

### CSVでの簡易バックアップ（緊急用）

重要テーブルだけCSVで取得する場合:

```sql
-- Supabase SQL Editor で実行してコピー
select * from students;
select * from lesson_records;
select * from guardians;
select * from enrollments;
```

または生徒CSVエクスポート機能（adminアカウントで `/students` → CSVエクスポート）を活用。

---

## 3次: 復元テスト（月1回）

### 目的

「バックアップはある」だけでなく「実際に戻せる」を確認する。

### 手順

1. Supabase **Staging** プロジェクトを用意する（後述）
2. 最新バックアップファイルを準備する
3. Staging プロジェクトに適用する

```bash
pg_restore \
  --host=db.staging-xxxx.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --clean \
  backup_20260517.dump
```

4. アプリを Staging に向けてローカルで起動し、生徒一覧・授業記録が表示されるか確認する

### 確認チェックリスト

- [ ] 生徒一覧が表示される
- [ ] 授業記録が1件以上表示される
- [ ] ログインできる
- [ ] 担当スケジュールが表示される
- [ ] ファイルが閲覧できる（Storage）

---

## 退職者アカウントの停止手順

スタッフが退職・異動した場合:

1. Supabase Dashboard → **Authentication → Users**
2. 対象ユーザーの右端メニュー → **Ban user** または **Delete user**
3. `staff` テーブルの該当行の `auth_user_id` を NULL に更新（削除ではなく無効化）

```sql
update public.staff
set auth_user_id = null
where email = '退職者のメール@example.com';
```

4. 授業記録等の `staff_id` は残す（履歴として保持するため）

---

## 担当者・実施記録

| 項目 | 担当 | 最終実施日 |
|------|------|-----------|
| 週次手動バックアップ | オーナーまたは管理者 | - |
| 月次復元テスト | 開発者または管理者 | - |
| 退職者アカウント停止 | オーナー | - |

---

## Supabase Staging 設定

Stagingとは、本番に影響せずに動作確認できる「テスト専用のDB環境」。

### 作成手順（初回1回だけ）

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. プロジェクト名: `教室名-staging`（例: `gacoding-staging`）
3. 同じ Organization の中に作成
4. **パスワードはメモしておく**
5. 作成後、以下のマイグレーションを順番に実行

```
supabase/schema.sql
supabase/migrations/001_add_features.sql
supabase/migrations/002_normalize_grades_and_courses.sql
supabase/migrations/003_fix_course_display_names.sql
supabase/migrations/004_role_based_rls.sql
```

6. Staging の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を控える

### Vercel Preview 環境との紐づけ

1. Vercel Dashboard → 対象プロジェクト → **Settings → Environment Variables**
2. **Preview** 環境に Staging の URL とキーを設定する

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | StagingプロジェクトURL | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key | Preview |

これで `main` 以外のブランチでVercel Previewを開いたとき、本番DBではなくStagingに繋がる。

### ローカルで Staging を使う場合

`.env.local` を一時的に Staging の URL に切り替える。  
本番に戻す前に必ず元に戻すこと。
