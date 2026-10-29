import { ERROR_HINTS } from "@/lib/format";
import type { FormState } from "@/app/form-actions";
export function Feedback({ state }: { state: FormState }) {
  if (!state) return null;
  return state.ok
    ? <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-900">✔ {state.data.message}</p>
    : <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-900">✖ {state.error.message} <span className="text-xs opacity-70">({ERROR_HINTS[state.error.code] ?? state.error.code})</span></p>;
}
export const EmptyState = ({ title, hint }: { title: string; hint?: string }) => <div className="card text-center text-sm text-slate-600"><p className="font-medium">{title}</p>{hint && <p>{hint}</p>}</div>;
