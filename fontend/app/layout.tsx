import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/api";
import { signOutAction } from "./form-actions";
export const metadata: Metadata = { title: "CampusShare", description: "Share campus labs, equipment and rooms." };
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const links = [["/resources", "Resources"], ...(user ? [["/dashboard", "Dashboard"], ["/my-bookings", "My bookings"]] : []), ...(user && user.role !== "user" ? [["/owner/requests", "Requests"], ["/owner/resources", "Manage resources"], ["/owner/active", "Check-in / return"]] : [])];
  return (
    <html lang="en"><body>
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 shadow-sm backdrop-blur-xl"><nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/resources" className="mr-2 flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-950"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm text-white shadow-sm">C</span>CampusShare</Link>
        {links.map(([h, l]) => <Link key={h} href={h} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700">{l}</Link>)}
        <span className="ml-auto flex items-center gap-2 text-sm">{user ? <><span className="text-slate-600">{user.name} ({user.role})</span><form action={signOutAction}><button className="btn-ghost">Sign out</button></form></> : <Link href="/login" className="btn">Sign in</Link>}</span>
      </nav></header>
      <main className="mx-auto min-h-[calc(100vh-70px)] max-w-6xl px-4 py-7 sm:px-6 sm:py-10">{children}</main>
    </body></html>);
}
