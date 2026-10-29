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
  const [customDuration, setCustomDuration] = useState(false);
  const [earliestStart, setEarliestStart] = useState("");

  const endAt = useMemo(() => {
    if (!startAt || !Number.isFinite(Number(duration)) || Number(duration) <= 0) return "";
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return "";
    return localDateTimeValue(new Date(start.getTime() + Number(duration) * 60 * 60 * 1000));
  }, [startAt, duration]);

  const durationHours = Number(duration);
  const validDuration = duration !== "" && Number.isFinite(durationHours) && durationHours > 0 && durationHours <= maxHours;
  const durationOptions = Array.from({ length: Math.max(1, Math.floor(maxHours * 2)) }, (_, index) => (index + 1) / 2)
    .filter((hours) => hours <= maxHours);

  return (
    <form action={action} className="card booking-panel space-y-5" aria-busy={pending}>
      <div className="booking-heading"><span className="booking-heading-icon">✳</span><div><p className="eyebrow eyebrow-teal">NEW BOOKING</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Plan your session</h2><p className="mt-1 text-sm text-slate-500">Choose a date and time that works for you.</p></div></div>

      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="endAt" value={endAt} />

      <section className="booking-section">
        <div className="booking-section-title"><span className="step-number">1</span><div><h3>Date & start time</h3><p>Choose when you’d like to use this resource.</p></div></div>
        <label className="field-label mt-4">
          Start date and time
          <input
            required
            type="datetime-local"
            name="startAt"
            value={startAt}
            min={earliestStart || undefined}
            onFocus={() => {
              if (!earliestStart) setEarliestStart(localDateTimeValue(new Date()));
            }}
            onChange={(event) => setStartAt(event.target.value)}
            className="input booking-date-input mt-2"
          />
          <span className="field-hint">Campus time · India Standard Time (IST)</span>
        </label>
      </section>

      <section className="booking-section">
        <div className="booking-section-title"><span className="step-number step-number-orange">2</span><div><h3>How long do you need it?</h3><p>Pick a duration · up to {maxHours} {maxHours === 1 ? "hour" : "hours"}.</p></div></div>
        <div className="duration-options mt-4" role="group" aria-label="Booking duration">
          {durationOptions.map((hours) => <button key={hours} type="button" aria-pressed={!customDuration && duration === String(hours)} onClick={() => { setCustomDuration(false); setDuration(String(hours)); }} className={`duration-chip ${!customDuration && duration === String(hours) ? "duration-chip-active" : ""}`}>{hours} <span>{hours === 1 ? "hour" : "hours"}</span></button>)}
          <button type="button" aria-pressed={customDuration} onClick={() => { setCustomDuration(true); setDuration(""); }} className={`duration-chip ${customDuration ? "duration-chip-active" : ""}`}>Custom</button>
        </div>
        {customDuration && <label className="field-label mt-4 block max-w-xs">Custom duration (hours)
          <input required type="number" inputMode="decimal" min="0.25" max={maxHours} step="0.25" value={duration} onChange={(event) => setDuration(event.target.value)} className="input mt-2" placeholder="e.g. 1.25" />
          <span className="field-hint">Enter 15-minute increments, up to {maxHours} {maxHours === 1 ? "hour" : "hours"}.</span>
        </label>}
      </section>

      <div className="session-preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900">Your planned session</span>
          <span className="duration-summary">{duration || "—"} {durationHours === 1 ? "hour" : "hours"}</span>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          {startAt && endAt && validDuration
            ? `${new Date(startAt).toLocaleString()} – ${new Date(endAt).toLocaleString()}`
            : "Choose a start time to preview your booking."}
        </p>
        <p className="mt-1 text-xs text-slate-500">We’ll check the resource limits and time availability when you submit.</p>
      </div>

      <section className="booking-section">
        <div className="booking-section-title"><span className="step-number step-number-lilac">3</span><div><h3>What’s it for?</h3><p>This helps the resource owner review your request.</p></div></div>
        <label className="field-label mt-4">
        Purpose
        <select name="purpose" className="input mt-2" defaultValue="COURSEWORK">
          <option value="COURSEWORK">Coursework</option>
          <option value="RESEARCH">Research</option>
          <option value="STUDENT_PROJECT">Student project</option>
          <option value="OTHER">Other</option>
        </select>
        </label>

        <label className="field-label mt-4">
        Reason for booking <span className="text-rose-600">(required)</span>
        <textarea required name="purposeNote" rows={3} className="input mt-2" placeholder="Tell the owner why you need this resource." />
        </label>
      </section>

      {!canBook && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Some requirements are not met yet. Review the checklist above before requesting access.
        </p>
      )}

      <button className="btn btn-teal w-full" disabled={pending || !startAt || !endAt || !validDuration}>
        {pending ? "Sending request…" : "Request this session →"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
