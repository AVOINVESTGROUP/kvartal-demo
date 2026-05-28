import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KVARTAL — центр недвижимости",
  description: "Коммерческая недвижимость, земельные участки и инвестиционные объекты KVARTAL.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
