# RLS・API 権限棚卸し表

最終更新: 2026-05-20

このドキュメントは ClassNote の現在のセキュリティ状態を可視化し、対応優先度を管理するためのものです。

---

## 適用状況の前提確認

`supabase/migrations/004_role_based_rls.sql` を Supabase SQL Editor で**実行済みか否かを以下に記録**してください。

| 環境 | 適用済み | 確認日 | 確認者 |
|------|---------|--------|--------|
| 本番 (Production) | 未確認 | — | — |
| 検証 (Staging) | 未確認 | — | — |

> **未適用の場合**: 全テーブルが `authenticated` ユーザーに全操作を許可する広いポリシーのままです。早急に SQL Editor で実行してください。

---

## RLS ポリシー一覧

`004_role_based_rls.sql` 適用後の状態。

| テーブル | SELECT | INSERT | UPDATE | DELETE | 備考 |
|---------|--------|--------|--------|--------|------|
| `students` | 全認証 | 全認証 | 全認証 | admin のみ | Server Action `createStudent` / `updateStudent` は `assertCurrentUserIsAdmin()` ガードあり |
| `staff` | 全認証 | **admin のみ** | **admin のみ** | admin のみ | ⚠️ SELECT は全認証ユーザーに公開（role 等が見える） |
| `guardians` | 全認証 | 全認証 | 全認証 | admin のみ | Server Action `addGuardian` は admin ガードあり |
| `emergency_contacts` | 全認証 | 全認証 | 全認証 | admin のみ | Server Action `addEmergencyContact` は admin ガードあり |
| `lesson_records` | 全認証 | 全認証 | 全認証 | admin のみ | Server Action に admin ガードなし（全 staff が記録・更新可） |
| `lesson_record_history` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `enrollments` | 全認証 | 全認証 | 全認証 | admin のみ | `addEnrollment` / `deleteEnrollment` に admin ガードなし |
| `courses` | 全認証 | 全認証 | 全認証 | admin のみ | `createCourse` / `updateCourse` / `archiveCourse` に admin ガードなし |
| `lesson_assignments` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `student_documents` | 全認証 | 全認証 | 全認証 | admin のみ | Storage ポリシーと併用 |
| `schools` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `addresses` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `tools` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `services` | 全認証 | 全認証 | 全認証 | admin のみ | — |
| `student_accounts` | 全認証 | 全認証 | 全認証 | admin のみ | 現在主要 UI では未使用 |

---

## API ルート 権限チェック一覧

| エンドポイント | 認証チェック | admin チェック | 状態 |
|--------------|------------|--------------|------|
| `GET /api/students/export` | ✓ | ✓ | OK |
| `GET /api/lesson-records/export` | ✓ | ✗ | ⚠️ **要対応**: 全 staff が全生徒の記録を CSV 取得可能 |
| `POST /api/schedule/assignment` | ✗ | ✗ | ⚠️ **要対応**: 未認証リクエストを受け付ける可能性あり |

---

## Server Action 権限チェック一覧 (`app/actions.ts`)

### admin 限定済み（`assertCurrentUserIsAdmin()` 使用）

| アクション | 内容 |
|-----------|------|
| `createStudent` | 生徒登録 |
| `updateStudent` | 生徒情報更新 |
| `addGuardian` | 保護者追加 |
| `addEmergencyContact` | 緊急連絡先追加 |
| `bulkPromoteGrades` | 一括学年進級 |

### admin 限定済み（`isCurrentUserAdmin()` チェック使用）

| アクション | 内容 |
|-----------|------|
| `createStaffProfile` | スタッフ登録 |
| `updateStaffProfile` | スタッフ情報更新 |
| `resetStaffLoginPassword` | パスワードリセット |
| `setStaffLoginEnabled` | ログイン有効化/無効化 |
| `deleteUnlinkedStaffProfiles` | 未連携スタッフ削除 |

### ⚠️ 権限チェックなし（全認証ユーザーが実行可能）

| アクション | 内容 | リスク |
|-----------|------|--------|
| `addLessonRecord` | 授業記録追加 | staff が任意記録を追加可（意図的な設計かも） |
| `updateLessonRecord` | 授業記録更新 | 他人の記録も更新できる可能性 |
| `deleteLessonRecord` | 授業記録削除 | RLS の admin delete のみで制御 |
| `saveDraftLessonRecord` | 下書き保存 | 同上 |
| `addEnrollment` | 受講登録 | — |
| `deleteEnrollment` | 受講削除 | — |
| `updateEnrollmentSchedule` | スケジュール変更 | — |
| `createCourse` | コース作成 | staff がコースを勝手に作成可能 |
| `updateCourse` | コース更新 | staff がコース名を勝手に変更可能 |
| `archiveCourse` | コース停止 | staff がコースを停止可能 |
| `upsertLessonAssignment` | 担当講師割当 | — |
| `bulkUpdateAttendanceStatus` | 一括出欠更新 | — |
| `updateAttendanceStatus` | 出欠更新 | — |
| `updateOwnPassword` | パスワード変更 | 本人操作のみ（Auth が保証） |

---

## 管理者判定の仕組み

`lib/authz.ts` の `isCurrentUserAdmin()` は以下の順で admin を判定します。

1. `staff.auth_user_id = auth.uid()` かつ `role = 'admin'`
2. 上記が取れない場合、`staff.email = auth.users.email` かつ `role = 'admin'`（移行期のフォールバック）

> **推奨**: `auth_user_id` が全 staff に設定されたら、email フォールバックを廃止する。

RLS の `is_admin_user()` 関数も同じロジック（`004_role_based_rls.sql` 参照）。

---

## 対応優先度まとめ

### 高（本番前に対応推奨）

- [ ] `004_role_based_rls.sql` を本番・Staging の両方で実行済みか確認する
- [ ] `/api/lesson-records/export` に admin チェックを追加する
- [ ] `/api/schedule/assignment` に認証チェックを追加する

### 中（運用が安定したら対応）

- [ ] `createCourse` / `updateCourse` / `archiveCourse` に admin ガードを追加する
- [ ] `addEnrollment` / `deleteEnrollment` に admin ガードを追加するか設計を明確化する
- [ ] `staff` テーブルの SELECT を admin のみに絞るか検討する（現状は全認証ユーザーが role 等を見られる）

### 低（将来的に）

- [ ] `updateLessonRecord` / `deleteLessonRecord` に「自分の記録のみ操作可」RLS を追加する（要件次第）
- [ ] email フォールバックを廃止し `auth_user_id` のみで管理者判定する
- [ ] 全 staff に `auth_user_id` が設定されているか定期確認する仕組みを入れる

---

## テスト結果記録欄（Task 2 で記入）

| 操作 | admin | staff | 期待 | 結果 | 確認日 |
|------|-------|-------|------|------|--------|
| 生徒登録 | — | — | admin のみ可 | 未確認 | — |
| 生徒情報編集 | — | — | admin のみ可 | 未確認 | — |
| 授業記録追加 | — | — | 両方可 | 未確認 | — |
| 授業記録削除 | — | — | admin のみ可 | 未確認 | — |
| コース作成 | — | — | ⚠️ 両方可（要確認） | 未確認 | — |
| コース停止 | — | — | ⚠️ 両方可（要確認） | 未確認 | — |
| スタッフ登録 | — | — | admin のみ可 | 未確認 | — |
| CSV エクスポート（生徒） | — | — | admin のみ可 | 未確認 | — |
| CSV エクスポート（記録） | — | — | ⚠️ 両方可（要対応） | 未確認 | — |
| 保護者閲覧 | — | — | admin のみ可 | 未確認 | — |
