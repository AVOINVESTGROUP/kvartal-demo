import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fixer.guru Partner Admin",
  description: "Shared partner organization console.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
