import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users
} from "lucide-react";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/branding";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/students", label: "生徒", icon: Users },
  { href: "/lesson-records", label: "授業記録", icon: ClipboardList },
  { href: "/attendance", label: "出席", icon: CalendarCheck },
  { href: "/courses", label: "コース", icon: GraduationCap },
  { href: "/schedule", label: "スケジュール", icon: CalendarRange },
  { href: "/documents", label: "教材", icon: FileStack },
  { href: "/staff", label: "スタッフ", icon: UserCog }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
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
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {navItems.map((item) => {
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
