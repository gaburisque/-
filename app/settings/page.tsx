import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileStack,
  UserCog
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { isCurrentUserAdmin } from "@/lib/authz";

type SettingsCard = {
  href: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const cards: SettingsCard[] = [
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

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">設定</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            コース・出欠・教材・スタッフの管理
          </p>
        </header>

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
