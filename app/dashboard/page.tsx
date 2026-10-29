import Link from "next/link";
import { redirect } from "next/navigation";
import { io } from "next/cache";
import { Suspense } from "react";
import { getCurrentUser, listActiveBookings, listMyBookings, listOwnerRequests } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { EmptyState } from "@/components/Feedback";
import { HAS_LIFECYCLE, asList, fmt } from "@/lib/format";
const LIVE = ["REQUESTED", "APPROVED", "CHECKED_IN", "WAITLISTED"];
const Stat = ({ n, label, href, icon }: { n: number; label: string; href: string; icon: string }) => <Link href={href} className="stat-card"><span className="stat-icon">{icon}</span><span className="mt-5 block text-3xl font-bold tracking-tight">{n}</span><span className="mt-1 block text-sm text-slate-500">{label}</span></Link>;
export default function Dashboard() {
  return <Suspense fallback={<div className="loading-panel">Preparing your dashboard…</div>}><DashboardContent /></Suspense>;
}

async function DashboardContent() {
  await io();
  const u = await getCurrentUser(); if (!u) redirect("/login");
  const staff = u.role !== "user";
  const mine = asList(await listMyBookings());
  // This clock value is request-specific; io() above keeps it out of the prerendered shell.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = mine.filter((b) => LIVE.includes(b.status) && Date.parse(b.endAt) > now).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const waiting = upcoming.filter((b) => b.status === "REQUESTED").length;
  const queue = staff ? asList(await listOwnerRequests()) : [];
  const handover = staff && HAS_LIFECYCLE ? asList(await listActiveBookings()) : [];
  const next = upcoming.find((b) => b.status === "APPROVED");
  const tips: string[] = [];
  if (waiting) tips.push(`${waiting} request${waiting > 1 ? "s are" : " is"} waiting for an owner's decision.`);
  if (next) tips.push(`Next up: ${next.resourceName} on ${fmt(next.startAt)} IST. Check-in opens 15 minutes before.`);
  if (staff && queue.length) tips.push(`${queue.length} request${queue.length > 1 ? "s need" : " needs"} your decision.`);
  if (handover.length) tips.push(`${handover.length} booking${handover.length > 1 ? "s" : ""} to hand over or take back.`);
  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
        <div className="relative z-10 max-w-2xl">
          <p className="eyebrow text-indigo-200">YOUR CAMPUS, SHARED</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Welcome back, {u.name.split(" ")[0]}.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">A better way to discover and book the tools, rooms, and spaces that help your ideas take shape.</p>
          <Link href="/resources" className="hero-button mt-6">Explore resources <span aria-hidden="true">→</span></Link>
        </div>
        <div className="hero-stamp"><span>CS</span><small>Campus<br />Share</small></div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat n={upcoming.length} label="Upcoming bookings" href="/my-bookings" icon="◷" /><Stat n={waiting} label="Awaiting review" href="/my-bookings" icon="⌁" />
        {staff && <Stat n={queue.length} label="Requests to decide" href="/owner/requests" icon="◇" />}{staff && HAS_LIFECYCLE && <Stat n={handover.length} label="To hand over / return" href="/owner/active" icon="↗" />}
      </div>
      <section className="card next-actions"><div><p className="eyebrow">A QUICK CHECK-IN</p><h2 className="mt-1 text-lg font-semibold">Next actions</h2></div>
        {tips.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{tips.map((t) => <li key={t} className="action-tip"><span className="action-dot">•</span>{t}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">You’re all caught up. Browse resources and find something useful for your next project.</p>}</section>
      <section><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2 className="mt-1 text-xl font-semibold">Upcoming bookings</h2></div><Link href="/my-bookings" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">View all <span aria-hidden="true">→</span></Link></div>
        {!upcoming.length ? <EmptyState title="Nothing booked" hint="Find a lab, camera or room and request a slot." /> :
          <ul className="space-y-2">{upcoming.slice(0, 5).map((b) => <li key={b.id} className="card flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{b.resourceName}</p><p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST</p></div><BookingStatusBadge status={b.status} /></li>)}</ul>}</section>
    </div>);
}
