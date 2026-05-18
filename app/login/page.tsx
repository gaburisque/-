import { Suspense } from "react";
import { signIn } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm({
  searchParams
}: {
  searchParams: { error?: string; message?: string; next?: string };
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="text-sm font-semibold text-primary">{APP_NAME}</p>
        <CardTitle className="mt-1">ログイン</CardTitle>
        <CardDescription>{APP_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={searchParams.next ?? "/lesson-records/new"} />
          {searchParams.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {searchParams.error}
            </div>
          ) : null}
          {searchParams.message ? (
            <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              {searchParams.message}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            ログイン
          </Button>
          <div className="text-center text-xs text-muted-foreground">
            アカウント作成は管理者が行います。
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm searchParams={resolvedSearchParams} />
      </Suspense>
    </main>
  );
}
