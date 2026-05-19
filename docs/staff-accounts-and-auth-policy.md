# ClassNote（学習塾・教室向け生徒管理）— 単体完結引き継ぎドキュメント

このファイルは **単独で別の AI や担当者に渡して**、アプリの全貌・運用・認証・DB・セキュリティ認識を揃えるためのものです。

**本文のルール**

- **外部 URL や Markdown のリンク記法は使いません**（パスはすべてリポジトリ内のファイルパスをバッククォートで示します）。
- **秘密情報（キー値・実データ・ログイン情報）は書きません。** 環境変数は名前と用途のみ。
- リポジトリのコードが進んだ場合は **コードと突合**し、この文書を更新してください。

---

## 合意したログイン・アカウント運用方針（製品決定・2026-05）

教室側との擦り合わせで確定した前提。実装はこの方針に合わせて揃える（未実装項目は下記「実装ギャップ」）。

| 項目 | 決定 |
|------|------|
| ログイン方式 | **メール＋パスワード**（OAuth・マジックリンクは使わない） |
| 新規アカウント | **管理者のみ**が作成（公開 Sign up・本人登録なし） |
| 初回ログイン | **管理者が一時パスワードを設定して伝える**（招待メールは使わない） |
| パスワード忘れ | **公開のリセットリンクは作らない**。**管理者（admin）が再設定** |
| **ログインメールの変更** | **原則不可**（作成時に決めたメールをログイン ID として固定） |
| 管理者の人数 | **`staff.role = admin` をおおよそ 3 名**想定 |
| staff → admin 昇格 | **ほぼ行わない**（UI は残しても運用では使わない想定） |
| 退職・休止 | **ログインだけ止める**。`staff` 行と過去記録の **`staff_id` は残す** |
| ログイン停止の操作者 | **admin 3 名のいずれも**実行できる（オーナー1人限定ではない） |
| インフラ画面 | **日常は Vercel / Supabase Dashboard を開かない**。認証・環境変数は **リリース前の初期設定のみ** |
| 社内の追加ルール | **特になし** |

**メールを変更不可にする意味（B の解釈）**

- 講師本人が `/settings/account` でメールを変えない（**本人によるメール変更 UI は不要／削除してよい**）。
- `/staff` の一覧で **既存ユーザーのメールを編集しても Auth のログイン ID は変えない**運用でよい（現状の挙動と整合）。**登録ミス**は原則 **アカウント作り直し**（旧アカウント停止＋新メールで新規作成）で対応。
- `staff.email` は **表示・連絡用ラベル**として作成時の値を維持してもよいが、**ログイン ID とは別物として扱わない**方が混乱が少ない（作成時に Auth と `staff` で同じメールを入れる）。

**ログイン停止（admin 3 名・退職時）の望ましい実装**

- Auth ユーザーは **ban（ログイン不可）**。
- **`staff.auth_user_id` は NULL にしない**（過去の授業記録の記録者表示を維持）。
- 操作は **`/staff` から admin が実行**（Dashboard の Users を開かない）。

**実装済み（2026-05 方針反映）**

1. admin による **パスワード再設定** — `resetStaffLoginPassword`（`/staff` 一覧）。
2. admin による **ログイン停止／再開** — `setStaffLoginEnabled`（Auth ban / 解除。`auth_user_id` は維持）。
3. **`/settings/account` はパスワード変更のみ**（メール変更 UI なし。`updateOwnEmail` は拒否）。
4. `/staff` で **ログイン連携済みのメールは表示のみ**（`updateStaffProfile` は名前・role のみ更新。未連携時のみ email 可変）。
5. **role（admin / staff）は admin が自由に変更**（一覧のセレクト＋保存）。

**任意の今後**

- 初回ログイン後のパスワード変更の案内文。

**採用しないもの（今回）**

- 招待メール、Google ログイン、公開「パスワードを忘れた」、本人によるメール変更。

---

## A. プロダクト概要

- **名称**: ClassNote（表示名は `lib/branding.ts` の `APP_NAME` で一元管理）。
- **用途**: 学習塾・教室向け Web アプリ。生徒、保護者、緊急連絡先、受講コース、授業記録、出席、教材・書類、講師、週間スケジュールを管理する想定。
- **組織方針**: 機能追加より先に、本番運用向けの **セキュリティ・権限・バックアップ・オーナーへの引き継ぎ** を優先したい。
- **運用上の希望**: リリース後は **Supabase Dashboard と Vercel を極力触らず**日常運用したい（認証基盤として Supabase Auth は継続）。

---

## B. 技術スタック

| 領域 | 内容 |
|------|------|
| フレームワーク | Next.js App Router |
| 言語 | TypeScript |
| UI | Tailwind CSS、`components/ui`（ローカル・shadcn/ui 相当） |
| 認証 | Supabase Auth（Cookie セッション、`@supabase/ssr`） |
| DB | Supabase PostgreSQL |
| ファイル | Supabase Storage |
| ホスティング | Vercel |
| コード管理 | GitHub |

**パッケージ名**: `classnote`（`package.json`）。

**よく使うコマンド**

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run lint
```

`lint` は Next.js バージョンとの相性を確認してから信頼する前提のメモが過去にあった。

---

## C. デプロイと環境の典型像

- **本番**: GitHub の `main` ブランチ → Vercel Production → Supabase Production。
- **検証**: feature / preview ブランチ → Vercel Preview → **別プロジェクトの Supabase Staging を指す**構成が推奨。
- **本番 DB と検証 DB は分離**する。
- **GitHub Pages だけでは本番運用不可**（サーバー処理・認証・DB・Storage が必要）。

**ローカル開発の注意**: `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` が本番プロジェクトを指していると、`npm run dev` でも **本番データを読み書きする**。検証用 Supabase の URL と anon key を入れる。複数環境を切り替える場合は `.env.local` のコピーを別名で保管し、作業前に差し替える。

**Vercel Preview と Staging の対応（意図）**: Vercel の Environment Variables で **Preview** 環境に Staging の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を入れると、`main` 以外のブランチの Preview が本番 DB に触れない。

---

## D. 環境変数（名前だけ）

| 変数 | 公開 | 用途 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | クライアントに露出 | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアントに露出 | anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバーのみ**。Git に含めない | Admin API（例: スタッフの Auth ユーザー作成）。**漏洩時の影響は極大** |
| `SUPABASE_EMAIL` | 開発・スクリプト用（任意） | `scripts/seed-mock.ts` 実行時のログイン用メール |
| `SUPABASE_PASSWORD` | 開発・スクリプト用（任意） | 上記スクリプト用パスワード |

---

## E. 初期セットアップ手順（リポジトリ基準）

### E.1 依存関係

```bash
npm install
```

### E.2 Supabase で実行する SQL の順序

Supabase の SQL Editor で、次を **この順番で** 実行する。

1. `supabase/schema.sql`
2. `supabase/migrations/001_add_features.sql`
3. `supabase/migrations/002_normalize_grades_and_courses.sql`
4. `supabase/migrations/003_fix_course_display_names.sql`
5. `supabase/migrations/004_role_based_rls.sql`

リポジトリにファイルがあるだけでは DB は変わらない。**必ずプロジェクト上で実行する。**

`supabase/seed.sql` は動作確認用サンプル。**本番では投入しない**前提。

過去記録の仮データ: `supabase/seed_lesson_records.sql`（例: テスト生徒に直近数週分）。別スクリプト `supabase/seed_past_lesson_records_for_active_enrollments.sql` は active 受講ごとに欠けた週を埋める用途（SQL Editor で実行、再実行安全とされている）。

### E.3 `.env.local` のテンプレート（値は各自で入れる）

```
NEXT_PUBLIC_SUPABASE_URL=<Supabase Project Settings に表示される Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key・サーバーのみ>
```

最後の一行は **スタッフをアプリから「ログインアカウントも作成する」で追加する場合のみ必須**。取得場所は Supabase の Project Settings → API の **service_role**（Dashboard 内の画面）。クライアントや公開リポジトリに載せない。

### E.4 初回オーナー（admin）アカウントの作り方（Dashboard 経由）

1. Supabase Dashboard → Authentication → Users → Add user でオーナー用メールとパスワード（または招待）。
2. 作成ユーザーの **User UID（UUID）** をコピー。
3. Table Editor → `staff` で対応行の **`auth_user_id`** にその UUID。**`staff.email` は Auth のメールと一致させると運用しやすい**。
4. アプリにログインできることを確認。
5. その `staff` 行の **`role` を `admin`** にする。

### E.5 講師を Dashboard のみで紐づける場合（フォールバック）

1. Authentication で **`staff.email` と同じメール**のユーザーを作成。
2. User UID を **`staff.auth_user_id`** に設定。

例（SQL Editor）:

```sql
update public.staff
set auth_user_id = 'ここに-auth-users-の-uuid'
where email = 'teacher@example.com';
```

### E.6 アプリから講師を追加する場合（`/staff`）

管理者が「ログイン用アカウントも作成する」を **オン** にすると、`SUPABASE_SERVICE_ROLE_KEY` で Admin API が呼ばれ **`auth.users` 作成後に `staff` を `auth_user_id` 付きで INSERT** する（`app/actions.ts` の `createStaffProfile`）。オフのときは **`staff` 行のみ**で、ログイン連携なし。

**注意**: `/staff` の一覧で **ログイン連携済みの先生のメールだけ**管理者が書き換えても、**Authentication 側のログインメールは自動では変わらない**。本人に `/settings/account` で変更してもらうか、Dashboard の Users で揃える。

### E.7 Storage バケット

1. Dashboard → Storage → New bucket。
2. 名前: **`student-documents`**、公開オフ（Private）。
3. SQL Editor で次を実行（Storage の policy）。

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

### E.8 起動

```bash
npm run dev
```

ブラウザでローカル開発サーバーを開く（Next の既定はポート 3000）。未ログインで保護ルートに入ると **`/login`** へ。

---

## F. 認証・ミドルウェア

**ルート** `middleware.ts` は matcher でほぼ全リクエストにマッチし、`lib/supabase/middleware.ts` の **`updateSession`** を呼ぶ。

**環境変数が欠ける場合**: `updateSession` は Supabase クライアントを作らず、**認証リダイレクトをスキップ**する実装。

**ログイン必須パス**（いずれかに該当すると未ログインは `/login` へ、`next` クエリに元パスを付与）:

- `/`（ルート）
- `/dashboard` で始まるパス
- `/students` で始まるパス
- `/lesson-records` で始まるパス
- `/attendance` で始まるパス
- `/documents` で始まるパス
- `/courses` で始まるパス
- `/staff` で始まるパス
- `/settings` で始まるパス

**ログイン済みが `/login` に来た場合**: **`/lesson-records/new` にリダイレクト**。

**`/signup`**: 公開サインアップは止める方針。実装上 `/signup` はログインへ誘導する流れ（一覧・導線削除済みの経緯あり）。

**ロール（admin / staff）**: ミドルウェアは **ログインの有無のみ**。**管理者判定はページ・Server Action・API 側**。

---

## G. 権限モデル（意図どおりの表）

| 操作 | admin | staff |
|------|:-----:|:-----:|
| 生徒一覧・詳細・記録の閲覧 | ○ | ○ |
| 授業記録の作成・編集 | ○ | ○ |
| 出席・スケジュール更新 | ○ | ○ |
| CSV エクスポート | ○ | × |
| Staff ページ（権限管理） | ○ | × |
| 書類削除 | ○ | × |
| DB の削除系（RLS で admin のみ意図） | ○ | × |

アカウント作成は Supabase Auth 側。**`/signup` は停止**。

---

## H. アプリ側の権限実装（コードの芯）

- **`lib/authz.ts`**: `isCurrentUserAdmin()`、`assertCurrentUserIsAdmin()`。
- **`components/app-shell.tsx`**: ナビの「生徒登録」など **オーナーのみ表示**。
- **`app/staff/page.tsx`**: **`isCurrentUserAdmin` でなければ `/settings` へリダイレクト**（講師が URL を知っていてもスタッフ管理 UI に入れない）。
- **生徒作成・進級・保護者まわりなど**: `assertCurrentUserIsAdmin()` でガード。
- **書類**: `documents` の削除ボタンは admin のみ UI（経緯あり）。

---

## I. RLS と `is_admin_user()`（004 の要点）

`supabase/migrations/004_role_based_rls.sql` の核心は次のとおり。

**関数 `public.is_admin_user()`**（security definer、`auth.uid()` と突合）:

- `staff.role = 'admin'` かつ
- **`staff.auth_user_id = auth.uid()`** または **移行用フォールバックで `staff.email` が `auth.users` のメールと一致**

**多くの業務テーブル**: authenticated に対し **select は常に可**、**insert/update も with check true で広く許可**、**delete は `is_admin_user()` のみ**、というパターンがループで適用される。

**例外**: `staff` テーブルは **insert/update を admin のみ**（`staff admin insert` / `staff admin update`）。

**読み取りの広さ**: 設計上「ログインしたユーザーなら多くのテーブルを読める」状態が残りやすく、**個人情報の画面側マスキングやクエリ省略**とセットで見る必要がある。**本番の個人情報システムとしては RLS だけに依存しない強化余地あり**。

---

## J. データモデルとマイグレーション一覧

**DB 設計メモ**

- 主キーは各テーブル `xxx_id` の UUID。
- リレーションは名前ではなく ID。
- `students` を中心に `guardians`、`emergency_contacts`、`enrollments`、`lesson_records` などがぶら下がる。
- `student_accounts` は将来の生徒ログイン用。**現状メイン UI では未使用**。

**主要テーブル（概要）**

| テーブル | 役割 |
|----------|------|
| `students` | 生徒 |
| `schools` | 学校マスタ |
| `addresses` | 住所 |
| `guardians` | 保護者 |
| `emergency_contacts` | 緊急連絡先 |
| `courses` | コースマスタ |
| `enrollments` | 受講（曜日 `weekday`、開始時刻など） |
| `lesson_records` | 授業記録（**`staff_id` で記録者**） |
| `staff` | 講師・職員（**`auth_user_id`**、`role` は `admin` / `staff`） |
| `lesson_record_history` | 記録の編集履歴（001） |
| `student_documents` | 書類メタデータ（001） |
| `lesson_assignments` | 担当割り当て関係（001） |
| `student_accounts` | 将来用 |

**マイグレーション内容の一行表**

| ファイル | 内容 |
|----------|------|
| `schema.sql` | 基底スキーマ・RLS 有効化 |
| `001_add_features.sql` | 出欠、履歴、書類、担当割り当てなど |
| `002_normalize_grades_and_courses.sql` | 学年・コースの正規化 |
| `003_fix_course_display_names.sql` | Scratch / Roblox 等の表示名 |
| `004_role_based_rls.sql` | `is_admin_user()` とポリシー置換、`staff` のみ insert/update 制限 |

---

## K. スタッフと Auth の二層（最重要）

| レイヤー | 役割 |
|----------|------|
| `auth.users` | ログイン・パスワード・セッション・メール確認 |
| `public.staff` | 名前・メール・**role**・**auth_user_id** |

**差分の結論**

1. **ログインできる**ことと **`lesson_records.staff_id` が埋まる**ことは別。
2. **`ensureCurrentStaffId`**（`app/actions.ts`）は **`staff.auth_user_id = 現在の auth.uid()`** の行だけを見て **`staff_id` を返す**。**メールフォールバックは無い**。未連携だと **null** になりうる。
3. **`isCurrentUserAdmin`** は **`auth_user_id` 優先**＋ **`staff.email` とログインメール一致**のフォールバックあり。

---

## L. 画面ルート一覧（詳細付き）

| パス | 説明 |
|------|------|
| `/login` | ログイン |
| `/signup` | サインアップ無効化の経緯・ログインへ誘導 |
| `/dashboard` | ダッシュボード |
| `/students` | 生徒一覧。詳細条件・学年・学校。admin のみ連絡先・学校列など。一覧から CSV ボタンは無し（エクスポートは API） |
| `/students/new` | 生徒新規。**admin のみ**（他ロールは `/students` へ）。基本情報＋任意で保護者・緊急連絡先・受講1件を同一フォームで可。学校はテキスト入力でマスタ照合。性別は選択肢 |
| `/students/[student_id]` | 生徒詳細。基本・保護者・緊急連絡先は **admin のみ**閲覧・編集（講師は運用に必要な範囲のみ） |
| `/lesson-records` | 記録一覧。詳細条件・グループ化・並び替え等 |
| `/lesson-records/new` | **記録入力**。記録日のカレンダー曜日とタブ整合。左リストは直近記録の曜日バケット（無記録は `enrollments.weekday`）。曜日タブは近傍日付同期（`lib/weekdays.ts`）。下書き保存など |
| `/lesson-records/[lesson_record_id]` | 詳細・編集・履歴 |
| `/attendance` | 出席（日付・一括保存） |
| `/courses` | コース管理（追加・名称・説明・停止/再開） |
| `/schedule` | 週間スケジュール・担当講師割当 |
| `/documents` | 書類のアップロード・一覧・ダウンロード・削除（削除 UI は admin のみ） |
| `/staff` | 講師・職員管理。**ページレベルで admin のみ** |
| `/settings` | 設定ハブ。オーナー向けカード（進級・生徒登録・一覧など）は admin のみ |
| `/settings/account` | **ログイン本人**のメール・パスワード変更 |

---

## M. Server Actions・API・その他サーバー処理

**中心ファイル**: `app/actions.ts`

含まれる処理の例:

- ログイン・ログアウト・サインアップ（停止メッセージ）
- **スタッフ**: `createStaffProfile`（Admin API オプション）、`updateStaffProfile`、`deleteUnlinkedStaffProfiles`
- **本人**: `updateOwnEmail`、`updateOwnPassword`
- 生徒・保護者・受講・記録・出席・スケジュール・進級など多数
- **`ensureCurrentStaffId`**: 上記 K 参照（auth_user_id のみ）

**API Routes**

- `app/api/students/export/route.ts` — 生徒 CSV（管理者のみ意図）
- `app/api/lesson-records/export/route.ts` — 授業記録 CSV（経緯として UI からの一覧 CSV は無い場合あり）
- `app/api/schedule/assignment/route.ts` — スケジュール担当更新

---

## N. ユーティリティ・コンポーネント索引（主要のみ）

| パス | 役割 |
|------|------|
| `lib/supabase/server.ts` | サーバー用クライアント（Cookie） |
| `lib/supabase/client.ts` | ブラウザ用 |
| `lib/supabase/service-role.ts` | Service Role（Admin API） |
| `lib/supabase/middleware.ts` | `updateSession` |
| `middleware.ts` | 上記を呼ぶ matcher 設定 |
| `lib/authz.ts` | 管理者判定 |
| `lib/types.ts` | 型 |
| `lib/branding.ts` | アプリ名など |
| `lib/grades.ts` | 学年・進級 |
| `lib/courses.ts` | コース名 |
| `lib/enrollments.ts` | 受講データ整理 |
| `lib/relations.ts` | Supabase の relation 正規化 |
| `lib/format.ts` | 表示 |
| `lib/weekdays.ts` | 曜日・記録入力の日付同期 |
| `lib/lesson-times.ts` | 時刻選択肢 |
| `lib/lesson-records.ts` | 記録ヘルパー |
| `lib/lesson-record-content.ts` | 記録本文の構造化 |
| `lib/lesson-records-list-url.ts` / `lib/lesson-records-new-url.ts` | URL 組み立て |

---

## O. 実装済み機能のチェックリスト（プロダクト視点）

- Supabase Auth によるログイン必須化。
- ダッシュボード。
- 生徒一覧・詳細（講師は個人情報を抑えた範囲）。**生徒の作成・更新・進級はオーナーのみ**。
- **保護者・緊急連絡先はオーナーのみ**閲覧・追加（UI・ガード・一覧クエリ）。
- 受講・スケジュール変更・記録 CRUD・編集履歴。
- 出欠（記録フォーム・詳細・出欠ページ）。
- 記録 CSV（API 経由、一覧ヘッダーからの CSV UI は無い経緯）。
- 記録印刷ビュー。
- 記録一覧の検索・グループ化・並び替え。
- 記録入力画面のリニューアル（曜日タブ・下書き・構造化フォーム・左リストの曜日バケットなど）。
- コース管理ページ。
- ナビ整理（コース追加など）。
- 出欠ページ、書類、スケジュール。
- `/settings/account` のメール・パスワード変更。
- `/staff` でのスタッフ追加（オプションで Auth 同時作成）。
- 学年一括進級（設定から、`bulkPromoteGrades` はオーナーのみ）。
- 生徒詳細の授業履歴 UI（講師も閲覧可の範囲）。

---

## P. Schedule ページの経緯（簡潔）

- 何度か UI を変更。グリッド全体が縦に長いというフィードバックあり。
- 現状は曜日タブで切り替えるコンパクトな方向。
- 関連: `app/schedule/page.tsx`、`app/schedule/schedule-grid.tsx`、`app/api/schedule/assignment/route.ts`、`lib/enrollments.ts`、`lib/courses.ts`。
- 作業再開時は **未コミットの有無を git で確認**との過去メモあり。

---

## Q. スタッフ本人・管理者の運用（実装済み）

- **`/settings/account`**: `updateOwnPassword`（現在パスワード確認）、`updateOwnEmail`（Auth のメール更新＋`staff.email` 同期。確認メールは Supabase 設定依存）。
- **`/staff`**: チェックボックスでログインアカウント作成の有無。作成時は **`email_confirm: true` で Auth ユーザー作成**→ `staff` INSERT。失敗時は Auth ユーザーを削除するロールバック経路あり。

---

## R. セキュリティの現状認識（時点メモ）

**進んだこと（経緯としての一覧）**

- Supabase の公開 Sign up 無効化の運用。
- `/signup` 導線停止。
- `ensureCurrentStaffId` の **自動 staff 作成はしない**（勝手に講師行が増えない）。
- `/staff` の管理・CSV API・書類削除 UI など **admin 寄せの対応**が進んだ経緯。
- `004_role_based_rls.sql` の導入、`student-documents` の削除を `is_admin_user()` に寄せるポリシー。
- admin / staff の実機確認の経緯。

**残る高優先の論点（チェックリスト的思考）**

- Sign up が有効だと URL 周知でアカウント作成されるリスク（運用でオフ継続）。
- **広い read/write RLS** と **画面側ガードのズレ**が無いか継続確認。
- **API・ページすべてで admin 制御が十分か**の棚卸し。
- **監査ログ**不足（記録履歴以外）。
- **書類**の Storage とアプリ権限の両面整合。

**過去メモとの整合**: 古いメモに「`/staff` がログイン済みなら誰でも入る可能性」とあるが、**現状の `app/staff/page.tsx` は admin でなければ `/settings` に飛ばす**。それでも **API や将来のルート追加**では再確認が必要。

**本番前にやりたいことの型**

1. Sign up 無効維持。
2. オーナーの `staff.role = admin` と `auth_user_id` の確認。
3. 権限ヘルパーの統一的利用。
4. Staff・CSV・削除・書類・重要設定の admin 制約の継続。
5. RLS の段階的強化。
6. 監査ログ。
7. バックアップ・復元・退職者アカウント停止の運用固定。

---

## S. バックアップ・復元・Staging（方針の要約）

**三層の考え方**

1. **1次**: Supabase の自動バックアップ（プラン依存。本番で生徒データを扱うなら有料プラン検討）。
2. **2次**: `pg_dump` 等の手動エクスポートを週次などで外部保管（Drive 等）。ファイル名に日付。保持数のルールを決める。
3. **3次**: 月次などで **Staging に復元テスト**。「バックアップがある」だけでなく **戻せる**ことを確認。

**復元テストの確認例**: 生徒一覧・記録・ログイン・スケジュール・Storage の閲覧。

**退職者（合意後の望ましい運用）**

1. **admin がアプリから** Auth ユーザーを ban（ログイン不可）— 未実装なら Dashboard は使わない方針のため要実装。
2. **`staff.auth_user_id` は NULL にしない**（記録者表示を維持）。`staff` 行は残す。
3. 授業記録の `staff_id` は履歴として残す。

**Staging 新規プロジェクト時**: 本番と同じ順で `schema.sql` と `001`〜`004` を実行。Preview 用に Staging の URL と anon key を Vercel Preview 環境変数へ。

---

## T. オーナーへの共有・権限譲渡（方針）

**初期共有**: 本番 URL とログインアカウントのみ。.env、service role、管理者の秘密は共有しない。オーナーは `admin`、講師は `staff`。Vercel / Supabase / GitHub の管理者は最初開発側でもよいとの経緯。

**完全譲渡時**: Supabase・Vercel・GitHub のオーナー移譲、請求の移管、必要なら開発者を Collaborator で残すだけにする。

---

## U. 次にやること・環境メモ・開発フロー（リポジトリ由来）

**プロジェクトが挙げている「次」**

1. Supabase 本番と検証（Staging）の分離の徹底。
2. バックアップ・復元テストの運用化。
3. Vercel の Production / Preview の環境変数をそれぞれの Supabase に向ける。

**環境**

- `scripts/seed-mock.ts` はログインが必要で、`SUPABASE_EMAIL` / `SUPABASE_PASSWORD` を使う経緯。
- Vercel の向き先が本番か Staging かはプロジェクトごとに要確認。

**Git の運用の型**

- `main` はリリース可能に。
- `feature/*` で実装 → Preview で確認 → `main` マージ → 本番デプロイ。
- DB 変更は破壊を避け、`supabase/migrations/` に追番追加。

---

## V. 現場運用チェックリスト（抜粋）

本番化の土台、セキュリティ、データ運用、品質、リリースのチェックボックスが README にあった。重要項目のみ再掲:

- 本番と Staging の Supabase 分離。
- Sign up 無効、admin の staff 紐づけ、`004` 適用、Storage 削除ポリシー。
- バックアップ方針・復元リハーサル・退職者手順の文書化。
- PR 前 `typecheck` / `build`、権限テスト。

---

## W. 障害時に最初に見る項目

- Supabase プロジェクトが停止していないか。
- Vercel の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` の誤り・空白混入。
- 環境変数変更後の Redeploy。

---

## X. スタッフアカウント運用の課題（製品論点・合意前メモ）

方針は上記「合意したログイン・アカウント運用方針」に集約。残作業は主に **実装ギャップ** の解消。

---

## Y. 将来検討（今回は採用しない）

- 招待メール、OAuth、公開パスワードリセット、本人によるメール変更。
- 監査ログ（誰が誰を停止・再設定したか）。

---

## Z. この文書の保守

次が変わったら **このファイルを更新**する。

- 認証・ミドルウェア・環境変数・スタッフ作成フロー。
- RLS・`is_admin_user()`・Storage ポリシー。
- 主要ルート・権限モデル・バックアップ方針。
- セキュリティ上の「進んだこと／残論点」のバランス。

**単体で渡すとき**: このファイル＋作業対象のソースファイルがあれば十分に着手できるようにしておく。コードが真実であり、本文はその説明書である。
