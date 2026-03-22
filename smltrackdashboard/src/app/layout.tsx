import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SML Mini CRM — AI Chat Intelligence",
  description: "ระบบ Mini CRM อัจฉริยะ วิเคราะห์สนทนา LINE / Facebook / Instagram อัตโนมัติ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderWrapper>
          <ThemeProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0 overflow-y-auto">
                {children}
              </main>
            </div>
          </ThemeProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
