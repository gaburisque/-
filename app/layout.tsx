import type { Metadata } from "next";
import { Toaster } from "sonner";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // ブラウザ拡張が <html> に属性を注入すると hydration mismatch になるため抑制
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
