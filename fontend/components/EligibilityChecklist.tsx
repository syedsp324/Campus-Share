import type { EligibilityResult } from "@/src/types/eligibility";
const ICON = { MET: "✔", MISSING: "✖", PENDING: "⏳", EXPIRED: "⚠" } as const;
export function EligibilityChecklist({ result }: { result: EligibilityResult }) {
  return (
    <section aria-labelledby="elig" className="card">
      <h2 id="elig" className="font-semibold">Eligibility {result.eligible ? "— you're good to book" : "— action needed"}</h2>
      <ul className="mt-3 space-y-2">{result.results.map((i) => (
        <li key={i.requirementId} className="text-sm"><span className="font-medium">{ICON[i.status]} {i.label}</span> <span className="text-slate-500">({i.status})</span>
          <p className="text-slate-600">{i.message}{i.howToFix && <> <em>How to fix: {i.howToFix}</em></>}</p></li>))}</ul>
    </section>);
}
