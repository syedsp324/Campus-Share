import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UserNavigation } from "@/components/UserNavigation";
export const metadata: Metadata = { title: "CampusShare", description: "Share campus labs, equipment and rooms." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-screen antialiased">
        <header className="site-header sticky top-0 z-30">
          <nav aria-label="Main" className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
            <Link href="/resources" className="brand-mark mr-2 flex items-center gap-2.5">
              <span className="brand-icon" aria-hidden="true">C</span>
              <span>Campus<span className="text-teal-700">Share</span></span>
            </Link>
            <Link href="/resources" className="nav-link">Book on campus</Link>
            <Link href="/resources#resources" className="nav-link">Find equipment</Link>
            <Suspense fallback={<span className="ml-auto text-sm text-slate-500">Loading account…</span>}>
              <UserNavigation />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto min-h-[calc(100vh-76px)] max-w-7xl px-4 py-7 sm:px-6 sm:py-10">{children}</main>
        <footer className="site-footer"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs sm:px-6"><span>CampusShare · Shared campus resources, made simple.</span><span>Built for your campus community</span></div></footer>
      </body>
    </html>
  );
}
