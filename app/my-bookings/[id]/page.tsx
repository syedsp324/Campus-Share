import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBookingDetail, getCurrentUser } from "@/lib/api";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";
import { fmt } from "@/lib/format";
import { ConditionForm } from "@/components/ConditionForm";
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) redirect("/login");
  const r = await getBookingDetail((await params).id);
  if (!r.ok) { if (r.error.code === "NOT_FOUND") notFound(); return <p role="alert" className="card text-red-900">✖ {r.error.message}</p>; }
  const b = r.data;
  const damaged = b.conditionReports.some((c) => c.phase === "AFTER" && (c.overall === "DAMAGED" || c.overall === "MISSING_PARTS"));
  return (
    <div className="space-y-4">
      <Link href="/my-bookings" className="text-sm text-indigo-700 hover:underline">← My bookings</Link>
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">{b.resourceName}</h1><BookingStatusBadge status={b.status} /></div>
      <p className="text-sm text-slate-600">{fmt(b.startAt)} → {fmt(b.endAt)} IST · {b.purpose.replace("_", " ")} · Requested by {b.requesterName}</p>
      {b.purposeNote && <p className="card text-sm"><strong>Your reason for booking:</strong> {b.purposeNote}</p>}
      {b.decisionReason && <p className="card text-sm"><strong>Decision reason:</strong> {b.decisionReason}</p>}
      {damaged && <p role="alert" className="rounded-md bg-orange-50 p-3 text-sm text-orange-900">⚠ The return report notes damage or missing parts. The owner may follow up.</p>}
      <section className="card"><h2 className="font-semibold">Condition reports</h2>
        {!b.conditionReports.length ? <p className="mt-1 text-sm text-slate-600">None yet. Reports are filed at check-in and return.</p> :
          <ul className="mt-2 space-y-2 text-sm">{b.conditionReports.map((c) => <li key={c.phase}><strong>{c.phase === "BEFORE" ? "Before use" : "After use"}:</strong> {c.overall.replace("_", " ")}{c.notes && <> — {c.notes}</>}
            {c.checklist.some((x) => !x.ok) && <p className="text-amber-800">Not ticked: {c.checklist.filter((x) => !x.ok).map((x) => x.item).join(", ")}</p>}</li>)}</ul>}</section>
      <section className="card"><h2 className="font-semibold">Timeline</h2>
        <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-4 text-sm">{b.timeline.map((e, i) => <li key={i}><span className="font-medium">{e.action.replaceAll("_", " ").toLowerCase()}</span> · {e.actor} <span className="text-slate-500">· {fmt(e.at)}</span>{e.reason && <p className="text-slate-600">“{e.reason}”</p>}</li>)}</ol></section>
      {b.status === "APPROVED" && <ConditionForm bookingId={b.id} phase="BEFORE" />}
      {b.status === "CHECKED_IN" && <ConditionForm bookingId={b.id} phase="AFTER" />}
    </div>);
}
