import {
  createStaffProfile,
  deleteUnlinkedStaffProfiles,
  resetStaffLoginPassword,
  setStaffLoginEnabled,
  updateStaffProfile
} from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { FlashToast } from "@/components/flash-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isCurrentUserAdmin } from "@/lib/authz";
import { fetchLoginDisabledByAuthUserIds } from "@/lib/staff-auth-admin";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function StaffPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const flash = await searchParams;
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    redirect("/settings");
  }

  const supabase = await createClient();
  const { data } = await supabase.from("staff").select("*").order("name");
  const staff = (data ?? []) as Staff[];
  const visibleStaff = staff.filter((member) => member.auth_user_id || member.email);
  const importedStaffCount = staff.length - visibleStaff.length;

  const authUserIds = visibleStaff
    .map((m) => m.auth_user_id)
    .filter((id): id is string => Boolean(id));

  let loginDisabledByAuthUserId = new Map<string, boolean>();
  let canManageAuth = true;
  try {
    loginDisabledByAuthUserId = await fetchLoginDisabledByAuthUserIds(authUserIds);
  } catch {
    canManageAuth = false;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">スタッフ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            記録者として表示する先生情報とログインアカウントを管理します。ログイン用メールは作成後に変更できません（登録ミスは新規作成＋旧アカウント停止）。
          </p>
        </div>

        {!canManageAuth ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            SUPABASE_SERVICE_ROLE_KEY が未設定のため、パスワード再設定・ログイン停止は利用できません。
          </div>
        ) : null}

        <FlashToast message={flash.message} error={flash.error} />

        <Card>
          <CardHeader>
            <CardTitle>先生一覧</CardTitle>
            <CardDescription>
              名前・権限（admin / staff）はいつでも変更できます。ログイン連携済みのメールは固定です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleStaff.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>メール</TableHead>
                      <TableHead>権限</TableHead>
                      <TableHead>ログイン</TableHead>
                      <TableHead>パスワード再設定</TableHead>
                      <TableHead className="w-[100px]">保存</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStaff.map((member) => {
                      const hasLogin = Boolean(member.auth_user_id);
                      const loginDisabled = member.auth_user_id
                        ? (loginDisabledByAuthUserId.get(member.auth_user_id) ?? false)
                        : false;

                      return (
                        <TableRow key={member.staff_id}>
                          <TableCell>
                            <form id={`staff-${member.staff_id}`} action={updateStaffProfile}>
                              <input type="hidden" name="staff_id" value={member.staff_id} />
                              <Input name="name" defaultValue={member.name} required className="min-w-[140px]" />
                            </form>
                          </TableCell>
                          <TableCell>
                            {hasLogin ? (
                              <div className="space-y-0.5">
                                <p className="text-sm">{member.email ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">作成後は変更不可</p>
                              </div>
                            ) : (
                              <Input
                                form={`staff-${member.staff_id}`}
                                name="email"
                                type="email"
                                defaultValue={member.email ?? ""}
                                className="min-w-[200px]"
                                placeholder="ログイン未作成時のみ編集可"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              form={`staff-${member.staff_id}`}
                              name="role"
                              defaultValue={member.role}
                              className="min-w-[100px]"
                            >
                              <option value="staff">staff</option>
                              <option value="admin">admin</option>
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            {!hasLogin ? (
                              <span className="text-xs text-muted-foreground">未連携</span>
                            ) : !canManageAuth ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : loginDisabled ? (
                              <span className="text-xs font-medium text-destructive">停止中</span>
                            ) : (
                              <span className="text-xs font-medium text-primary">有効</span>
                            )}
                            {hasLogin && canManageAuth ? (
                              <form action={setStaffLoginEnabled} className="mt-2">
                                <input type="hidden" name="staff_id" value={member.staff_id} />
                                <input
                                  type="hidden"
                                  name="enabled"
                                  value={loginDisabled ? "true" : "false"}
                                />
                                <Button type="submit" size="sm" variant={loginDisabled ? "secondary" : "outline"}>
                                  {loginDisabled ? "ログイン再開" : "ログイン停止"}
                                </Button>
                              </form>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {hasLogin && canManageAuth ? (
                              <form action={resetStaffLoginPassword} className="flex flex-wrap items-end gap-2">
                                <input type="hidden" name="staff_id" value={member.staff_id} />
                                <Input
                                  name="new_password"
                                  type="password"
                                  autoComplete="new-password"
                                  minLength={8}
                                  placeholder="新パスワード"
                                  className="min-w-[120px] max-w-[160px]"
                                />
                                <Button type="submit" size="sm" variant="outline">
                                  再設定
                                </Button>
                              </form>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button form={`staff-${member.staff_id}`} type="submit" size="sm" variant="secondary">
                              保存
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>表示できる先生がまだ登録されていません。</EmptyState>
            )}
          </CardContent>
        </Card>

        {importedStaffCount > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>インポート由来の先生データ</CardTitle>
              <CardDescription>
                XLSX取り込み時に混ざった未連携データが {importedStaffCount} 件あります。授業記録側の記録者は空欄になります。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={deleteUnlinkedStaffProfiles}>
                <Button type="submit" variant="destructive">
                  未連携データを削除
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>先生を追加</CardTitle>
            <CardDescription>
              「ログイン用アカウントも作成する」をオンにすると Auth ユーザーと staff を一度に作成します（サーバーに
              SUPABASE_SERVICE_ROLE_KEY が必要）。メールは作成後に変更できません。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createStaffProfile} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_min-content]">
                <div className="space-y-2">
                  <Label htmlFor="name">名前</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メール（ログイン ID）</Label>
                  <Input id="email" name="email" type="email" autoComplete="off" />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="role">権限</Label>
                  <NativeSelect id="role" name="role" defaultValue="staff" className="min-w-[110px]">
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </NativeSelect>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="create_login"
                  value="on"
                  defaultChecked
                  className="mt-1 rounded border-input"
                />
                <span>
                  <span className="font-medium">ログイン用アカウントも作成する</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    初回パスワードを設定し、本人へ安全な経路で伝えてください。
                  </span>
                </span>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="initial_password">初回パスワード（8文字以上）</Label>
                  <Input
                    id="initial_password"
                    name="initial_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </div>
              <Button type="submit">追加</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
