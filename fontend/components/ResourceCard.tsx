import Link from "next/link";
import type { ResourceSummary } from "@/src/types/resource";
export function ResourceCard({ r }: { r: ResourceSummary }) {
  return (
    <Link href={`/resources/${r.id}`} className="card block transition hover:border-indigo-400">
      <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{r.name}</h2>{r.isHighDemand && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">High demand</span>}</div>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{r.category.replace("_", " ")} · {r.location ?? "Location TBA"}</p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{r.description ?? "No description yet."}</p>
    </Link>);
}
