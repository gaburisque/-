import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生徒情報管理",
  description: "学習塾・教室向けの生徒管理MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
