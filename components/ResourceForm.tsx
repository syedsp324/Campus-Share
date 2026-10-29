"use client";

import { useActionState } from "react";
import { saveResourceAction } from "@/app/form-actions";
import type { ResourceDetail } from "@/src/types/resource";
import { Feedback } from "./Feedback";

const CATS = ["LAB", "MAKERSPACE_TOOL", "CAMERA", "COMPUTER", "ROOM", "TEST_DEVICE"];

export function ResourceForm({ initial }: { initial?: ResourceDetail }) {
  const [state, action, pending] = useActionState(saveResourceAction, null);

  return (
    <form action={action} className="card form-card space-y-5" aria-busy={pending}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <p className="eyebrow">{initial ? "RESOURCE SETTINGS" : "NEW LISTING"}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{initial ? "Update resource details" : "List a campus resource"}</h2>
        <p className="mt-1 text-sm text-slate-600">Keep access requirements and usage rules clear so students know what to expect.</p>
      </div>

      <label className="field-label">
        Resource name
        <input required name="name" defaultValue={initial?.name} className="input mt-2" placeholder="e.g. Sony camera kit" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Category
          <select name="category" defaultValue={initial?.category ?? "LAB"} className="input mt-2">
            {CATS.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="field-label">
          Location
          <input required name="location" defaultValue={initial?.location ?? ""} className="input mt-2" placeholder="e.g. Block B, Lab 204" />
        </label>
      </div>

      <label className="field-label">
        Description
        <textarea name="description" rows={3} defaultValue={initial?.description ?? ""} className="input mt-2" placeholder="What is it useful for?" />
      </label>
      <label className="field-label">
        Usage rules
        <textarea name="usageRules" rows={3} defaultValue={initial?.usageRules ?? ""} className="input mt-2" placeholder="Safety rules, handover instructions, or restrictions…" />
      </label>

      {initial && <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold">Booking limits</h3>
        <label className="field-label mt-3 block max-w-xs">
          Maximum duration per booking (hours)
          <input required type="number" name="maxBookingLengthHours" min="1" step="1" defaultValue={initial.maxBookingLengthHours} className="input mt-2" />
          <span className="field-hint">This limit applies to new requests. Existing bookings keep their scheduled times.</span>
        </label>
      </section>}

      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold">Access and demand</p>
        <label className="toggle-row">
          <input type="checkbox" name="requiresStaffPresent" defaultChecked={initial?.requiresStaffPresent} />
          <span><strong>Staff must be present</strong><small>Tell students this resource requires supervised use.</small></span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" name="isHighDemand" defaultChecked={initial?.isHighDemand} />
          <span><strong>High demand</strong><small>Requests may need an owner’s manual review.</small></span>
        </label>
        {initial && (
          <label className="toggle-row border-t border-slate-100 pt-3">
            <input type="checkbox" name="isActive" defaultChecked={initial.isActive} />
            <span>
              <strong>Available in discovery</strong>
              <small>{initial.isActive ? "Active resources can be discovered and requested." : "Inactive resources are hidden from normal discovery but remain manageable by their owner."}</small>
            </span>
          </label>
        )}
      </div>

      <button className="btn w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save resource changes" : "Create resource"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
