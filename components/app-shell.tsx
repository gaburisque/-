import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ClipboardList,
  ListChecks,
  LogOut,
  Settings,
  UserPlus,
  Users
} from "lucide-react";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";
import { isCurrentUserAdmin } from "@/lib/authz";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** オーナー（staff.role = admin）のみ表示 */
  ownerOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/lesson-records/new", label: "記録入力", icon: ClipboardList },
  { href: "/lesson-records", label: "記録一覧", icon: ListChecks },
  { href: "/students", label: "生徒", icon: Users },
  { href: "/students/new", label: "生徒登録", icon: UserPlus, ownerOnly: true },
  { href: "/settings", label: "設定", icon: Settings }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const isOwner = await isCurrentUserAdmin();
  const visibleNav = navItems.filter((item) => !item.ownerOnly || isOwner);

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/lesson-records/new" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>{APP_NAME}</span>
          </Link>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
              ログアウト
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[180px_1fr] lg:px-8">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} asChild variant="ghost" className="justify-start">
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
