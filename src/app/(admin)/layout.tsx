import type { Metadata } from "next";
import "./tokens.css";
import "@/styles/admin.css";
import "@/styles/app.css";
import "./legacy.css";

export const metadata: Metadata = {
  title: { default: "Admin | Waste2Light Store", template: "%s | Waste2Light Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: "#f7f8f3" }}>{children}</body>
    </html>
  );
}
