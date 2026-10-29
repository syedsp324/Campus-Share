export default function Loading() {
  return (
    <div className="space-y-3" role="status"><span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />)}
    </div>);
}
