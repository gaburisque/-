import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardEdit,
  ClipboardList,
  FileStack,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users
} from "lucide-react";

import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/lesson-records", label: "Lesson records", icon: ClipboardList },
  { href: "/lesson-records/new", label: "Record input", icon: ClipboardEdit },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/staff", label: "Staff", icon: UserCog }
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
            <span>生徒情報管理</span>
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
