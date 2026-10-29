"use client";

import { useActionState, useMemo, useState } from "react";
import { requestBookingAction } from "@/app/form-actions";
import { Feedback } from "./Feedback";

function localDateTimeValue(date: Date) {
  // datetime-local is a wall-clock value; use local display fields rather than UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BookingForm({
  resourceId,
  maxHours,
  canBook,
}: {
  resourceId: string;
  maxHours: number;
  canBook: boolean;
}) {
  const [state, action, pending] = useActionState(requestBookingAction, null);
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState("1");

  const endAt = useMemo(() => {
    if (!startAt || !Number.isFinite(Number(duration)) || Number(duration) <= 0) return "";
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return "";
    return localDateTimeValue(new Date(start.getTime() + Number(duration) * 60 * 60 * 1000));
  }, [startAt, duration]);

  const durationHours = Number(duration);
  const validDuration = duration !== "" && durationHours > 0 && durationHours <= maxHours;

  return (
    <form action={action} className="card booking-panel space-y-5" aria-busy={pending}>
      <div>
        <p className="eyebrow">RESERVE A RESOURCE</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">Plan your session</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pick a start time and how long you need it. We’ll calculate the end time for you.
        </p>
      </div>

      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="endAt" value={endAt} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Start date and time
          <input
            required
            type="datetime-local"
            name="startAt"
            value={startAt}
            min={localDateTimeValue(new Date())}
            onChange={(event) => setStartAt(event.target.value)}
            className="input mt-2"
          />
          <span className="field-hint">Times shown in your device’s local time (campus time is IST).</span>
        </label>

        <label className="field-label">
          Duration
          <select
            required
            name="durationHours"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="input mt-2"
          >
            {Array.from({ length: Math.max(1, Math.floor(maxHours * 2)) }, (_, index) => (index + 1) / 2)
              .filter((hours) => hours <= maxHours)
              .map((hours) => (
                <option key={hours} value={hours}>{hours} {hours === 1 ? "hour" : "hours"}</option>
              ))}
          </select>
          <span className="field-hint">Maximum for this resource: {maxHours} {maxHours === 1 ? "hour" : "hours"}.</span>
        </label>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-indigo-950">Your planned session</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-800">{duration || "—"}h</span>
        </div>
        <p className="mt-2 text-sm text-indigo-900">
          {startAt && endAt && validDuration
            ? `${new Date(startAt).toLocaleString()} – ${new Date(endAt).toLocaleString()}`
            : "Choose a start time to preview your booking."}
        </p>
        <p className="mt-1 text-xs text-indigo-800/80">The server will re-check the resource limit, eligibility and slot conflicts before saving.</p>
      </div>

      <label className="field-label">
        Purpose
        <select name="purpose" className="input mt-2" defaultValue="COURSEWORK">
          <option value="COURSEWORK">Coursework</option>
          <option value="RESEARCH">Research</option>
          <option value="STUDENT_PROJECT">Student project</option>
          <option value="OTHER">Other</option>
        </select>
      </label>

      <label className="field-label">
        Notes <span className="font-normal text-slate-500">(optional)</span>
        <textarea name="purposeNote" rows={3} className="input mt-2" placeholder="What will you use the resource for?" />
      </label>

      {!canBook && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Some requirements are not met yet. Review the checklist above before requesting access.
        </p>
      )}

      <button className="btn w-full sm:w-auto" disabled={pending || !startAt || !endAt || !validDuration}>
        {pending ? "Sending request…" : "Request this session"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
