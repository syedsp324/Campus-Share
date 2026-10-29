import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getEligibility, getResource } from "@/lib/api";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { BookingForm } from "@/components/BookingForm";
export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getResource(id); if (!r) notFound();
  const [user, elig] = await Promise.all([getCurrentUser(), getEligibility(id)]);
  return (
    <div className="space-y-4">
      <Link href="/resources" className="text-sm text-indigo-700 hover:underline">← All resources</Link>
      <div><h1 className="text-2xl font-bold">{r.name}</h1><p className="text-sm text-slate-600">{r.category.replace("_", " ")} · {r.location} · Owner: {r.ownerName}</p><p className="mt-2">{r.description}</p></div>
      <section className="card"><h2 className="font-semibold">Usage rules & limits</h2>
        <p className="mt-1 text-sm">{r.usageRules ?? "No special rules."}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600"><li>Max {r.maxBookingLengthHours}h per booking, {r.maxHoursPerUserPerWeek}h per week</li><li>Up to {r.maxActiveBookingsPerUser} active bookings</li>{r.requiresStaffPresent && <li>Staff must be present</li>}{r.depositAmount > 0 && <li>Deposit: ₹{r.depositAmount}</li>}{r.isHighDemand && <li>High demand: requests are reviewed by the owner</li>}</ul></section>
      {user ? <><EligibilityChecklist result={elig} /><BookingForm resourceId={r.id} maxHours={r.maxBookingLengthHours} canBook={elig.eligible} /></> : <p className="card text-sm"><Link href="/login" className="text-indigo-700 underline">Sign in</Link> to check eligibility and request a booking.</p>}
    </div>);
}
