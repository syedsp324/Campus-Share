import { redirect } from "next/navigation";
import { getBookingDetail, getCurrentUser, listOwnerRequests } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { DecideForm } from "@/components/DecideForm";
import { EmptyState } from "@/components/Feedback";
import { fmt } from "@/lib/format";
export default async function OwnerRequests() {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  if (u.role === "user") return <EmptyState title="Owners and managers only" hint="Sign in with an owner or manager role." />;
  const requests = await listOwnerRequests();
  const items = await Promise.all(requests.map(async (booking) => {
    const detail = await getBookingDetail(booking.id);
    return { ...booking, purposeNote: detail.ok ? detail.data.purposeNote : null };
  }));
  return (<>
    <h1 className="mb-4 text-2xl font-bold">Booking requests</h1>
    {!items.length ? <EmptyState title="All caught up" hint="No requests waiting for review." /> :
      <ul className="space-y-3">{items.map((b) => (
        <li key={b.id} className="card"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{b.resourceName} · {b.requesterName}</h2><BookingStatusBadge status={b.status} /></div>
          <p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST · {b.purpose.replace("_", " ")}{b.priorityScore != null && <> · Priority score {b.priorityScore}</>}</p>
          {b.purposeNote && <p className="requester-reason"><strong>Requester’s reason:</strong> {b.purposeNote}</p>}
          <DecideForm bookingId={b.id} /></li>))}</ul>}
  </>);
}
