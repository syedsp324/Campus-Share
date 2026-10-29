import { listResources } from "@/lib/api";
import { ResourceCard } from "@/components/ResourceCard";
import { EmptyState } from "@/components/Feedback";
import type { ResourceCategory } from "@/src/types/resource";
const CATS: ResourceCategory[] = ["LAB", "MAKERSPACE_TOOL", "CAMERA", "COMPUTER", "ROOM", "TEST_DEVICE"];
export default async function Resources({ searchParams }: { searchParams: Promise<{ q?: string; category?: ResourceCategory }> }) {
  const { q, category } = await searchParams;
  const items = await listResources({ query: q, category: CATS.includes(category as ResourceCategory) ? category : undefined });
  return (<>
    <h1 className="text-2xl font-bold">Find a resource</h1>
    <form className="my-4 flex flex-col gap-2 sm:flex-row" role="search">
      <label className="flex-1 text-sm"><span className="sr-only">Search</span><input name="q" defaultValue={q} placeholder="Search labs, cameras, rooms…" className="input" /></label>
      <label className="text-sm"><span className="sr-only">Category</span><select name="category" defaultValue={category ?? ""} className="input"><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}</select></label>
      <button className="btn">Search</button>
    </form>
    {items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => <ResourceCard key={r.id} r={r} />)}</div> : <EmptyState title="No resources match" hint="Try a different search or category." />}
  </>);
}
