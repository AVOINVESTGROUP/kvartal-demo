import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner Admin",
  description: "Partner organization console for Fixer.guru real estate network.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
