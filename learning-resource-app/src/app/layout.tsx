import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ScholarFlow",
    template: "%s | ScholarFlow",
  },
  description: "Quản lý, phân loại và tìm kiếm học liệu theo ngữ nghĩa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
