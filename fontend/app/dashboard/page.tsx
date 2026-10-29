import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listActiveBookings, listMyBookings, listOwnerRequests } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { EmptyState } from "@/components/Feedback";
import { HAS_LIFECYCLE, asList, fmt } from "@/lib/format";
const LIVE = ["REQUESTED", "APPROVED", "CHECKED_IN", "WAITLISTED"];
const Stat = ({ n, label, href }: { n: number; label: string; href: string }) => <Link href={href} className="card block hover:border-indigo-400"><p className="text-3xl font-bold">{n}</p><p className="text-sm text-slate-600">{label}</p></Link>;
export default async function Dashboard() {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  const staff = u.role !== "user";
  const mine = asList(await listMyBookings());
  const upcoming = mine.filter((b) => LIVE.includes(b.status) && Date.parse(b.endAt) > Date.now()).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
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
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Welcome back, {u.name}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={upcoming.length} label="Upcoming bookings" href="/my-bookings" /><Stat n={waiting} label="Awaiting review" href="/my-bookings" />
        {staff && <Stat n={queue.length} label="Requests to decide" href="/owner/requests" />}{staff && HAS_LIFECYCLE && <Stat n={handover.length} label="To hand over / return" href="/owner/active" />}
      </div>
      <section className="card"><h2 className="font-semibold">Next actions</h2>
        {tips.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{tips.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="mt-1 text-sm text-slate-600">You're all caught up. <Link href="/resources" className="text-indigo-700 underline">Browse resources</Link> to make a booking.</p>}</section>
      <section><h2 className="mb-2 font-semibold">Upcoming bookings</h2>
        {!upcoming.length ? <EmptyState title="Nothing booked" hint="Find a lab, camera or room and request a slot." /> :
          <ul className="space-y-2">{upcoming.slice(0, 5).map((b) => <li key={b.id} className="card flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{b.resourceName}</p><p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST</p></div><BookingStatusBadge status={b.status} /></li>)}</ul>}</section>
    </div>);
}
