import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apart4U Real Estate",
  description: "Apart4U Tbilisi partner site powered by Fixer.guru shared public inventory.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
