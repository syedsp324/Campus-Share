import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, getResource } from "@/lib/api";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { BookingForm } from "@/components/BookingForm";
import { Suspense } from "react";
export default function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="loading-panel">Loading resource details…</div>}><ResourceDetails params={params} /></Suspense>;
}

async function ResourceDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getResource(id); if (!r) notFound();
  const user = await getCurrentUser();
  const elig = {
    eligible: Boolean(user && r.isActive),
    results: [
      {
        requirementId: "resource_active",
        label: "Resource available",
        status: r.isActive ? "MET" as const : "MISSING" as const,
        message: r.isActive ? "This resource is open for booking." : "This resource is currently inactive.",
        howToFix: r.isActive ? null : "Choose an active resource.",
      },
    ],
  };
  return (
    <div className="page-stack">
      <Link href="/resources" className="back-link">← All resources</Link>
      <section className={`resource-detail-hero tone-${r.category.toLowerCase()}`}>
        <div className="detail-orbit" aria-hidden="true">✦</div>
        <div className="relative z-10"><p className="eyebrow">{r.category.replaceAll("_", " ")} · SHARED RESOURCE</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{r.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{r.description ?? "A shared campus resource, ready for your next project."}</p><div className="mt-5 flex flex-wrap gap-2"><span className="hero-chip">⌖ {r.location ?? "Location TBA"}</span><span className="hero-chip">Shared by {r.ownerName}</span>{r.isHighDemand && <span className="hero-chip">Popular resource</span>}</div></div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="card"><p className="eyebrow">BEFORE YOU BOOK</p><h2 className="mt-1 text-lg font-semibold">Usage rules & limits</h2>
        <p className="mt-1 text-sm">{r.usageRules ?? "No special rules."}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{r.requiresStaffPresent && <li>Staff must be present</li>}{r.isHighDemand && <li>High demand: requests are reviewed by the owner</li>}{user ? <><li>Max {r.maxBookingLengthHours}h per booking, {r.maxHoursPerUserPerWeek}h per week</li><li>Up to {r.maxActiveBookingsPerUser} active bookings</li>{r.depositAmount > 0 && <li>Deposit: ₹{r.depositAmount}</li>}</> : <li>Max {r.maxBookingLengthHours}h per booking</li>}</ul></section>
      <div className="space-y-4">{user ? <><EligibilityChecklist result={elig} /><BookingForm resourceId={r.id} maxHours={r.maxBookingLengthHours} canBook={elig.eligible} /></> : <div className="card space-y-3 text-sm"><p>Sign in to check eligibility and request this resource.</p><Link href="/login" className="btn-ghost">Sign in</Link></div>}</div>
      </div>
    </div>);
}
