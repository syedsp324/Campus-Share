import type { BookingStatus } from "@/src/types/common";
const S: Record<BookingStatus, [string, string]> = {
  REQUESTED: ["◔", "bg-slate-100 text-slate-800"], VERIFYING: ["◔", "bg-slate-100 text-slate-800"], PENDING_REVIEW: ["⏳", "bg-amber-100 text-amber-900"],
  APPROVED: ["✔", "bg-green-100 text-green-900"], REJECTED: ["✖", "bg-red-100 text-red-900"], WAITLISTED: ["☰", "bg-blue-100 text-blue-900"],
  CHECKED_IN: ["▶", "bg-indigo-100 text-indigo-900"], RETURNED: ["↩", "bg-teal-100 text-teal-900"], CLOSED: ["■", "bg-slate-200 text-slate-800"],
  CANCELLED: ["⊘", "bg-slate-200 text-slate-800"], OVERDUE: ["!", "bg-red-100 text-red-900"], DISPUTED: ["⚠", "bg-orange-100 text-orange-900"] };
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const [icon, cls] = S[status];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}><span aria-hidden>{icon}</span>{status.replace("_", " ")}</span>;
}
