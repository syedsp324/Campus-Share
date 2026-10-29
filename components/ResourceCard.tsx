import Link from "next/link";
import type { ResourceSummary } from "@/src/types/resource";
export function ResourceCard({ r }: { r: ResourceSummary }) {
  const categoryIcon: Record<string, string> = {
    LAB: "⌬", MAKERSPACE_TOOL: "⚒", CAMERA: "▣", COMPUTER: "⌘", ROOM: "▤", TEST_DEVICE: "◈",
  };
  const tone = `tone-${r.category.toLowerCase()}`;
  return (
    <Link href={`/resources/${r.id}`} className={`resource-card group ${tone}`}>
      <div className="resource-card-top"><span className="resource-icon">{categoryIcon[r.category] ?? "◇"}</span><span className="resource-category">{r.category.replaceAll("_", " ")}</span>{r.isHighDemand && <span className="demand-pill">Popular</span>}</div>
      <div className="mt-5"><h2 className="text-lg font-semibold tracking-tight text-slate-950">{r.name}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{r.description ?? "A shared campus resource, ready for your next idea."}</p></div>
      <div className="resource-meta"><span><span aria-hidden="true">⌖</span> {r.location ?? "Location TBA"}</span><span>Shared by {r.ownerName}</span></div>
      <div className="resource-card-footer"><span>View details</span><span className="card-arrow" aria-hidden="true">↗</span></div>
    </Link>);
}
