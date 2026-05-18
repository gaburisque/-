import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";

import { createStudent } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { gradeOptions } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";
import type { School } from "@/lib/types";

export default async function NewStudentPage() {
  const supabase = await createClient();
  const schoolsResult = await supabase
    .from("schools")
    .select("school_id,school_name,school_type")
    .order("school_name");
  const schools = (schoolsResult.data ?? []) as School[];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="px-0">
            <Link href="/students">
              <ArrowLeft className="h-4 w-4" />
              生徒一覧へ戻る
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <UserPlus className="h-5 w-5" />
              生徒登録
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              新しい生徒の基本情報を入力します
            </p>
          </div>
        </div>

        <form action={createStudent} className="grid max-w-3xl gap-5 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="last_name">姓 *</Label>
            <Input id="last_name" name="last_name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first_name">名 *</Label>
            <Input id="first_name" name="first_name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name_kana">姓かな</Label>
            <Input id="last_name_kana" name="last_name_kana" placeholder="さとう" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first_name_kana">名かな</Label>
            <Input id="first_name_kana" name="first_name_kana" placeholder="はなこ" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade">学年</Label>
            <NativeSelect id="grade" name="grade">
              <option value="">未選択</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school_id">学校</Label>
            <NativeSelect id="school_id" name="school_id">
              <option value="">未選択</option>
              {schools.map((school) => (
                <option key={school.school_id} value={school.school_id}>
                  {school.school_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birth_date">生年月日</Label>
            <Input id="birth_date" name="birth_date" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">性別</Label>
            <Input id="gender" name="gender" placeholder="男 / 女 / その他" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">電話番号</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">メール</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea id="notes" name="notes" className="min-h-[88px] resize-y" />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit">登録</Button>
            <Button asChild type="button" variant="ghost">
              <Link href="/students">キャンセル</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
