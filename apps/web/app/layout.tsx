import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grantly",
  description: "Find scholarships you actually qualify for, and know what to do today.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
