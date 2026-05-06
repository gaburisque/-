import Link from "next/link";

import { signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SignupForm({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>職員アカウント登録</CardTitle>
        <CardDescription>生徒情報を扱うため、登録後はログインが必要です。</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signUp} className="space-y-4">
          {searchParams.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {searchParams.error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="name">氏名</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">パスワード確認</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            登録
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            登録済みの場合は{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              ログイン
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <SignupForm searchParams={resolvedSearchParams} />
    </main>
  );
}
