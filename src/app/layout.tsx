import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { DM_Sans, Source_Serif_4 } from "next/font/google";
import { AdminBar } from "@/components/AdminBar";
import { getAdminUser } from "@/lib/admin";
import "./globals.css";

const adminBarOffsetStyle = {
  "--admin-bar-height": "3rem",
} as CSSProperties;

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Reseller Assistant",
  description:
    "Clothing listings for Mercari and Poshmark — one piece at a time.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const admin = await getAdminUser();

  return (
    <html
      lang="en"
      className={`${sourceSerif.variable} ${dmSans.variable} h-full antialiased`}
      style={admin ? adminBarOffsetStyle : undefined}
    >
      <body className="min-h-full flex flex-col font-sans">
        {admin ? <AdminBar initialAdmin /> : null}
        {children}
      </body>
    </html>
  );
}
