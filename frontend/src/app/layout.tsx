import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Toko Berkah BI",
    template: "%s · Toko Berkah BI",
  },
  description: "Kasir, stok, dan laporan untuk toko retail dan sembako.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="flex h-full overflow-hidden" suppressHydrationWarning>
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
