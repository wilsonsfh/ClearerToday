import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ClearerToday — practice that adapts to you",
  description:
    "Practice something to improve yourself every day. ClearerToday uses capture, retrieval, scoring, and adaptive drills for phoneme articulation, speaking clarity, and rhythm.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col antialiased font-[var(--font-inter)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
