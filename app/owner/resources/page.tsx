import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, listManageableResources } from "@/lib/api";
import { EmptyState } from "@/components/Feedback";
export default async function ManageResources() {
  const u = await getCurrentUser(); if (!u) redirect("/login");
  if (u.role === "user") return <EmptyState title="Owners and managers only" />;
  const allItems = await listManageableResources({});
  // Owners only manage their own listings. Manager/admin scope must also be enforced by server actions/RLS.
  const items = u.role === "owner" ? allItems.filter((r) => r.ownerId === u.id) : allItems;
  return (<>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-2xl font-bold">Manage resources</h1>{(u.role === "owner" || u.role === "admin") && <Link href="/owner/resources/new" className="btn">+ Add resource</Link>}</div>
    {!items.length ? <EmptyState title="No resources yet" hint="Add your first resource so students can book it." /> :
      <ul className="space-y-3">{items.map((r) => (
        <li key={r.id} className="card flex flex-wrap items-center justify-between gap-2">
          <div><p className="font-semibold">{r.name} {!r.isActive && <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Inactive</span>} {r.isHighDemand && <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">High demand</span>}</p>
            <p className="text-sm text-slate-600">{r.category.replace("_", " ")} · {r.location ?? "No location"} · Owner: {r.ownerName}</p></div>
          {(u.role === "admin" || (u.role === "owner" && r.ownerId === u.id)) && <Link href={`/owner/resources/${r.id}/edit`} className="btn-ghost">Edit</Link>}</li>))}</ul>}
    <p className="mt-3 text-xs text-slate-500">Owners can edit their own resources. Admins can edit any resource. The server and database enforce this.</p>
  </>);
}
