import { createStaffProfile, deleteUnlinkedStaffProfiles, updateStaffProfile } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/lib/types";

export default async function StaffPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("staff").select("*").order("name");
  const staff = (data ?? []) as Staff[];
  const visibleStaff = staff.filter((member) => member.auth_user_id || member.email);
  const importedStaffCount = staff.length - visibleStaff.length;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            記録者として表示する先生情報を管理します。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>先生一覧</CardTitle>
            <CardDescription>
              ログインに紐づいた先生、またはメールが登録されている先生だけを表示します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibleStaff.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>メール</TableHead>
                      <TableHead>権限</TableHead>
                      <TableHead>ログイン連携</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleStaff.map((member) => (
                      <TableRow key={member.staff_id}>
                        <TableCell>
                          <form id={`staff-${member.staff_id}`} action={updateStaffProfile}>
                            <input type="hidden" name="staff_id" value={member.staff_id} />
                            <Input name="name" defaultValue={member.name} required className="min-w-[180px]" />
                          </form>
                        </TableCell>
                        <TableCell>
                          <Input
                            form={`staff-${member.staff_id}`}
                            name="email"
                            type="email"
                            defaultValue={member.email ?? ""}
                            className="min-w-[220px]"
                          />
                        </TableCell>
                        <TableCell>
                          <NativeSelect form={`staff-${member.staff_id}`} name="role" defaultValue={member.role} className="min-w-[110px]">
                            <option value="staff">staff</option>
                            <option value="admin">admin</option>
                          </NativeSelect>
                        </TableCell>
                        <TableCell>{member.auth_user_id ? "あり" : "なし"}</TableCell>
                        <TableCell>
                          <Button form={`staff-${member.staff_id}`} type="submit" size="sm" variant="secondary">
                            保存
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
              ログインする先生は `/signup` またはSupabase Authでアカウント作成してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createStaffProfile} className="grid gap-4 md:grid-cols-[1fr_1fr_140px_auto]">
              <div className="space-y-2">
                <Label htmlFor="name">名前</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メール</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">権限</Label>
                <NativeSelect id="role" name="role" defaultValue="staff">
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </NativeSelect>
              </div>
              <div className="flex items-end">
                <Button type="submit">追加</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
