import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { updateOwnPassword } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { FlashToast } from "@/components/flash-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function AccountSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 h-8 px-2" asChild>
            <Link href="/settings">
              <ArrowLeft className="mr-1 h-4 w-4" />
              設定へ戻る
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">アカウント</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ログイン用メールは変更できません。パスワードのみ変更できます。
          </p>
        </div>

        <FlashToast message={params.message} error={params.error} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">パスワードを変更</CardTitle>
            <CardDescription>現在のパスワードを確認したうえで、新しいパスワードを設定します。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOwnPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">現在のパスワード</Label>
                <Input
                  id="current_password"
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">新しいパスワード（8文字以上）</Label>
                <Input
                  id="new_password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">新しいパスワード（確認）</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" size="sm">
                パスワードを更新
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
