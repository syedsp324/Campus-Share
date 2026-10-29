import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listMyBookings } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { EmptyState } from "@/components/Feedback";
import { cancelAction } from "../form-actions";
import { fmt } from "@/lib/format";
const CANCELLABLE = ["REQUESTED", "APPROVED", "WAITLISTED"]; // matches cancel_booking() in the database
export default async function MyBookings() {
  if (!(await getCurrentUser())) redirect("/login");
  const r = await listMyBookings();
  const items = r.ok ? r.data : [];
  return (<>
    <h1 className="mb-4 text-2xl font-bold">My bookings</h1>
    {!r.ok && <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-900">✖ {r.error.message}</p>}
    {!items.length ? <EmptyState title="No bookings yet" hint="Browse resources to make your first request." /> :
      <ul className="space-y-3">{items.map((b) => (
        <li key={b.id} className="card"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold"><Link href={`/my-bookings/${b.id}`} className="hover:underline">{b.resourceName}</Link></h2><BookingStatusBadge status={b.status} /></div>
          <p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST · {b.purpose.replace("_", " ")}</p>
          {b.decisionReason && <p className="mt-1 text-sm"><strong>Reason:</strong> {b.decisionReason}</p>}
          <div className="mt-2 flex gap-2"><Link href={`/my-bookings/${b.id}`} className="btn-ghost">View details</Link>
            {CANCELLABLE.includes(b.status) && <form action={cancelAction}><input type="hidden" name="bookingId" value={b.id} /><button className="btn-ghost">Cancel booking</button></form>}</div>
        </li>))}</ul>}
  </>);
}
