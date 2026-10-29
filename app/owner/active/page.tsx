import { redirect } from "next/navigation";
import { getCurrentUser, listActiveBookings } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { ConditionForm } from "@/components/ConditionForm";
import { EmptyState } from "@/components/Feedback";
import { fmt } from "@/lib/format";
export default async function Active() {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  if (u.role === "user") return <EmptyState title="Owners and managers only" />;
  const r = await listActiveBookings(); const items = r.ok ? r.data : [];
  return (<>
    <h1 className="mb-4 text-2xl font-bold">Check-in and return</h1>
    {!r.ok && <p role="alert" className="mb-3 text-sm text-red-900">✖ {r.error.message}</p>}
    {!items.length ? <EmptyState title="Nothing to hand over" hint="Approved bookings appear here." /> :
      <ul className="space-y-3">{items.map((b) => (
        <li key={b.id} className="card"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{b.resourceName} · {b.requesterName}</h2><BookingStatusBadge status={b.status} /></div>
          <p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST</p>
          {b.status === "CHECKED_IN" && <ConditionForm bookingId={b.id} phase="AFTER" />}
          {b.status === "APPROVED" && <p className="mt-2 text-sm text-slate-600">The requester records check-in from their booking details. This page will show return reporting after check-in.</p>}
        </li>))}</ul>}
  </>);
}
