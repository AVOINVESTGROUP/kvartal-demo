import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KVARTAL Admin",
  description: "KVARTAL Moscow partner organization console.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
