"use client";
import { useActionState } from "react";
import { conditionAction } from "@/app/form-actions";
import { CHECKLIST } from "@/lib/format";
import { Feedback } from "./Feedback";
// phase BEFORE = check-in, AFTER = return. Both save a condition report atomically with the status change.
export function ConditionForm({ bookingId, phase }: { bookingId: string; phase: "BEFORE" | "AFTER" }) {
  const [state, action, pending] = useActionState(conditionAction, null);
  return (
    <form action={action} className="mt-3 space-y-3" aria-busy={pending}>
      <input type="hidden" name="bookingId" value={bookingId} /><input type="hidden" name="phase" value={phase} />
      <fieldset className="space-y-1"><legend className="text-sm font-medium">{phase === "BEFORE" ? "Condition before use" : "Condition after use"}</legend>
        {CHECKLIST.map((c) => <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="ck" value={c} defaultChecked />{c}</label>)}</fieldset>
      <label className="block text-sm">Overall condition<select name="overall" className="input mt-1" defaultValue="GOOD"><option value="GOOD">Good</option><option value="MINOR_WEAR">Minor wear</option><option value="DAMAGED">Damaged</option><option value="MISSING_PARTS">Missing parts</option></select></label>
      <label className="block text-sm">Notes (optional)<textarea name="notes" rows={2} className="input mt-1" /></label>
      <button className="btn" disabled={pending}>{pending ? "Saving…" : phase === "BEFORE" ? "Check in" : "Mark returned"}</button>
      <Feedback state={state} />
    </form>);
}
