import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fixer.guru Platform Admin",
  description: "Owner console for the Fixer.guru partner real estate platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
