import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TreasuryPilot — Adaptive Treasury",
  description:
    "AI interprets the situation. Policy protects liquidity. Airwallex Sandbox executes.",
  robots: { index: true, follow: true },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
