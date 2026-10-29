"use client";

import { cancelAction } from "../app/form-actions";

export function CancelBookingForm({ bookingId }: { bookingId: string }) {
  return (
    <form action={cancelAction} className="space-y-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <button className="btn-ghost">Cancel booking</button>
    </form>
  );
}
