import Link from "next/link";
import type { ComponentType } from "react";
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileStack,
  KeyRound,
  UserCog,
  UserPlus
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { GradePromotionButton } from "@/components/grade-promotion-button";
import { Button } from "@/components/ui/button";
import { isCurrentUserAdmin } from "@/lib/authz";
import { nextGrade, normalizeGrade } from "@/lib/grades";
import { createClient } from "@/lib/supabase/server";

type SettingsCard = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const cards: SettingsCard[] = [
  {
    href: "/settings/account",
    label: "アカウント",
    description: "ログインのパスワードを変更",
    icon: KeyRound
  },
  {
    href: "/courses",
    label: "コース",
    description: "コースの追加・名称変更・停止",
    icon: BookOpen
  },
  {
    href: "/attendance",
    label: "出欠の一括入力",
    description: "日付ごとに出欠をまとめて入力",
    icon: CalendarCheck
  },
  {
    href: "/documents",
    label: "教材・書類",
    description: "生徒関連書類のアップロード・一覧",
    icon: FileStack
  },
  {
    href: "/staff",
    label: "スタッフ",
    description: "講師・職員の管理（管理者のみ）",
    icon: UserCog,
    adminOnly: true
  }
];

export default async function SettingsPage() {
  const isAdmin = await isCurrentUserAdmin();
  const visibleCards = cards.filter((c) => !c.adminOnly || isAdmin);

  let ownerStudentTools = null;
  if (isAdmin) {
    const supabase = await createClient();
    const { data: gradeRows } = await supabase.from("students").select("grade").eq("status", "active");

    const promotingStudents = (gradeRows ?? []).filter((s) => normalizeGrade(s.grade) !== null);
    const graduatingCount = promotingStudents.filter((s) => nextGrade(s.grade) === null).length;

    ownerStudentTools = (
      <section className="rounded-lg border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
        <h2 className="text-sm font-semibold tracking-tight">オーナー向け（生徒）</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          4月進級の一括処理・新規の生徒登録は管理者のみ実行できます。一覧の電話・メールも管理者のみ表示されます。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <GradePromotionButton
            promotingCount={promotingStudents.length}
            graduatingCount={graduatingCount}
          />
          <Button asChild variant="secondary" size="sm">
            <Link href="/students/new">
              <UserPlus className="h-4 w-4" />
              生徒を登録
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/students">生徒一覧へ</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">設定</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            コース・出欠・教材・スタッフの管理
          </p>
        </header>

        {ownerStudentTools}

        <div className="grid gap-3 sm:grid-cols-2">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex items-center gap-4 rounded-md border bg-card px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{card.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {card.description}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
