"use client";
import { useActionState } from "react";
import { decideAction } from "@/app/form-actions";
import { Feedback } from "./Feedback";
export function DecideForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(decideAction, null);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap gap-2">
        {(["APPROVE", "WAITLIST", "REJECT"] as const).map((d) => <button key={d} name="decision" value={d} disabled={pending} className={d === "APPROVE" ? "btn" : "btn-ghost"}>{d === "WAITLIST" ? "Waitlist" : d[0] + d.slice(1).toLowerCase()}</button>)}
      </div>
      <p className="text-xs text-slate-500">The requester’s reason is shown above. Your decision will be recorded and sent to them.</p>
      <Feedback state={state} />
    </form>);
}
