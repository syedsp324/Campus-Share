
"use server";

import { createClient } from "../../lib/supabase/server";
import type { ActionResult, BookingStatus, ConditionStatus, PurposeType } from "../../src/types/common";
import type {
  BookingDetail,
  BookingSummary,
  BookingTimelineEvent,
  DecideBookingInput,
  RequestBookingInput,
} from "../../src/types/booking";
import type { ConditionReportInput } from "../../src/types/booking";
import type { EligibilityResult } from "../../src/types/eligibility";

// Shape of a booking row returned by PostgreSQL.
type DbBooking = {
  id: string;
  resource_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
  purpose: PurposeType;
  purpose_note?: string | null;
  status: BookingStatus;
  decision_reason: string | null;
  priority_score: number | null;
  checked_in_at?: string | null;
  returned_at?: string | null;
};

type DbBookingSummary = DbBooking & {
  resource_name: string;
  requester_name: string;
};

// Convert database column names into the shared frontend format.
function toBookingSummary(
  row: DbBooking,
  resourceName: string,
  requesterName: string,
): BookingSummary {
  return {
    id: row.id,
    resourceId: row.resource_id,
    resourceName,
    userId: row.user_id,
    requesterName,
    startAt: row.start_at,
    endAt: row.end_at,
    purpose: row.purpose,
    status: row.status,
    decisionReason: row.decision_reason,
    priorityScore: row.priority_score,
  };
}

// Convert PostgreSQL errors into predictable messages for the UI.
function getActionError(message: string) {
  if (message.includes("BOOKING_REASON_REQUIRED")) {
    return { code: "VALIDATION_ERROR", message: "Please explain why you need this resource." };
  }
  if (message.includes("UNAUTHENTICATED")) {
    return { code: "UNAUTHENTICATED", message: "Please sign in first." };
  }
  if (message.includes("FORBIDDEN")) {
    return { code: "FORBIDDEN", message: "You don't have permission to do that." };
  }
  if (message.includes("NOT_FOUND")) {
    return { code: "NOT_FOUND", message: "The resource or booking was not found." };
  }
  if (message.includes("QUOTA_EXCEEDED")) {
    return { code: "QUOTA_EXCEEDED", message: "Your booking limit has been reached." };
  }
  if (message.includes("23505") || message.includes("CONFLICT")) {
    return { code: "CONFLICT", message: "This booking changed while you were working. Refresh and try again." };
  }
  if (message.includes("INVALID_TRANSITION")) {
    return { code: "INVALID_TRANSITION", message: "This booking can no longer be changed that way." };
  }
  if (message.includes("23P01") || message.includes("no_overlapping_active_bookings")) {
    return { code: "SLOT_UNAVAILABLE", message: "This time slot has already been booked." };
  }
  if (message.includes("VALIDATION_ERROR")) {
    return { code: "VALIDATION_ERROR", message: "Please check your booking details." };
  }

  return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

// Call a database function and normalize any errors it returns.
function failure<T>(message: string): ActionResult<T> {
  return { ok: false, error: getActionError(message) };
}

async function getSignedInUser() {
  const supabase = await createClient();

  // Never trust a user ID supplied by the browser.
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { supabase, user: null };
  }

  return { supabase, user: data.user };
}

// Submit a request; PostgreSQL validates dates, limits, and permissions.
export async function requestBooking(
  input: RequestBookingInput,
): Promise<ActionResult<BookingSummary>> {
  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return failure("UNAUTHENTICATED");
  }

  const purposeNote = input.purposeNote.trim();
  if (!purposeNote) return failure("BOOKING_REASON_REQUIRED");

  const { data, error } = await supabase.rpc("request_booking", {
    p_resource_id: input.resourceId,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_purpose: input.purpose,
    p_purpose_note: purposeNote,
    p_team_name: input.teamName ?? null,
  });

  if (error) {
    return failure(error.message);
  }

  const row = data as unknown as DbBooking;

  // Fetch the resource name for the frontend's shared booking summary.
  const { data: resource } = await supabase
    .from("resources")
    .select("name")
    .eq("id", row.resource_id)
    .maybeSingle();

  return {
    ok: true,
    data: toBookingSummary(row, resource?.name ?? "Resource", "You"),
  };
}

// Only the database function can authorize and perform the decision.
export async function decideBooking(
  input: DecideBookingInput,
): Promise<ActionResult<BookingSummary>> {
  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return failure("UNAUTHENTICATED");
  }

  const { data, error } = await supabase.rpc("decide_booking", {
    p_booking_id: input.bookingId,
    p_decision: input.decision,
    p_reason: input.reason,
  });

  if (error) {
    return failure(error.message);
  }

  const row = data as unknown as DbBooking;

  const { data: resource } = await supabase
    .from("resources")
    .select("name")
    .eq("id", row.resource_id)
    .maybeSingle();

  return {
    ok: true,
    data: toBookingSummary(row, resource?.name ?? "Resource", "Requester"),
  };
}

// Requesters can cancel only the states allowed by the database function.
export async function cancelBooking(input: {
  bookingId: string;
  reason: string;
}): Promise<ActionResult<BookingSummary>> {
  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return failure("UNAUTHENTICATED");
  }

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: input.bookingId,
    p_reason: input.reason,
  });

  if (error) {
    return failure(error.message);
  }

  const row = data as unknown as DbBooking;

  const { data: resource } = await supabase
    .from("resources")
    .select("name")
    .eq("id", row.resource_id)
    .maybeSingle();

  return {
    ok: true,
    data: toBookingSummary(row, resource?.name ?? "Resource", "You"),
  };
}

// List requests visible to the signed-in owner or manager.
export async function listOwnerRequests(): Promise<
  ActionResult<BookingSummary[]>
> {
  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return failure("UNAUTHENTICATED");
  }

  // The scoped RPC applies owner/manager checks and returns names without
  // broadening profile-table access beyond its existing RLS policy.
  const { data, error } = await supabase.rpc("list_booking_summaries", {
    p_scope: "owner_requests",
  });

  if (error) {
    return failure(error.message);
  }

  return {
    ok: true,
    data: ((data ?? []) as unknown as DbBookingSummary[]).map((row) =>
      toBookingSummary(row, row.resource_name, row.requester_name),
    ),
  };
}

// List the signed-in user's bookings; the database helper enforces the scope.
export async function listMyBookings(): Promise<ActionResult<BookingSummary[]>> {
  const { supabase, user } = await getSignedInUser();
  if (!user) return failure("UNAUTHENTICATED");

  const { data, error } = await supabase.rpc("list_booking_summaries", {
    p_scope: "mine",
  });
  if (error) return failure(error.message);

  return {
    ok: true,
    data: ((data ?? []) as unknown as DbBookingSummary[]).map((row) =>
      toBookingSummary(row, row.resource_name, row.requester_name),
    ),
  };
}

// Approved and checked-in bookings for resources the caller manages.
export async function listActiveBookings(): Promise<ActionResult<BookingSummary[]>> {
  const { supabase, user } = await getSignedInUser();
  if (!user) return failure("UNAUTHENTICATED");

  const { data, error } = await supabase.rpc("list_booking_summaries", {
    p_scope: "owner_active",
  });
  if (error) return failure(error.message);

  return {
    ok: true,
    data: ((data ?? []) as unknown as DbBookingSummary[]).map((row) =>
      toBookingSummary(row, row.resource_name, row.requester_name),
    ),
  };
}

type DbBookingDetailPayload = {
  booking: DbBooking & { checked_in_at: string | null; returned_at: string | null };
  resource_name: string;
  requester_name: string;
  reports: Array<{
    phase: "BEFORE" | "AFTER";
    overall: ConditionStatus;
    notes: string | null;
    checklist: ConditionReportInput["checklist"];
  }>;
  timeline: BookingTimelineEvent[];
};

export async function getBookingDetail(
  bookingId: string,
): Promise<ActionResult<BookingDetail>> {
  const { supabase, user } = await getSignedInUser();
  if (!user) return failure("UNAUTHENTICATED");

  const { data, error } = await supabase.rpc("get_booking_detail", {
    p_booking_id: bookingId,
  });
  if (error) return failure(error.message);
  if (!data) return failure("NOT_FOUND");

  const detail = data as unknown as DbBookingDetailPayload;
  const row = detail.booking;
  return {
    ok: true,
    data: {
      ...toBookingSummary(row, detail.resource_name, detail.requester_name),
      checkedInAt: row.checked_in_at,
      returnedAt: row.returned_at,
      purposeNote: row.purpose_note?.trim() || null,
      conditionReports: detail.reports.map((report) => ({
        bookingId: row.id,
        phase: report.phase,
        overall: report.overall,
        notes: report.notes ?? undefined,
        checklist: report.checklist,
      })),
      timeline: detail.timeline,
    },
  };
}

type EligibilityInput = { resourceId: string; startAt: string; endAt: string };

// These checks mirror the booking RPC's current limits; the RPC remains the
// final authority when the request is submitted or another user books first.
export async function getEligibility(
  input: EligibilityInput,
): Promise<EligibilityResult> {
  const { supabase, user } = await getSignedInUser();
  const results: EligibilityResult["results"] = [];
  const add = (
    requirementId: string,
    label: string,
    met: boolean,
    message: string,
    howToFix: string | null = null,
  ) => results.push({
    requirementId,
    label,
    status: met ? "MET" : "MISSING",
    message,
    howToFix,
  });

  if (!user) {
    add("signed_in", "Sign in", false, "Sign in before requesting a booking.", "Open the sign-in page.");
    return { eligible: false, results };
  }

  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  const validDates = Number.isFinite(start.getTime())
    && Number.isFinite(end.getTime())
    && start > new Date()
    && end > start;
  add(
    "booking_time",
    "Valid booking time",
    validDates,
    validDates ? "The requested time is in the future." : "Choose a valid future start and end time.",
  );
  if (!validDates) return { eligible: false, results };

  const { data: resource, error: resourceError } = await supabase
    .from("resources")
    .select("is_active, max_booking_length_hours, max_active_bookings_per_user, max_hours_per_user_per_week")
    .eq("id", input.resourceId)
    .maybeSingle();
  if (resourceError || !resource) {
    add("resource_available", "Resource available", false, "This resource could not be loaded or is unavailable.");
    return { eligible: false, results };
  }

  add(
    "resource_active",
    "Resource available",
    resource.is_active,
    resource.is_active ? "This resource is open for booking." : "This resource is not currently active.",
  );
  const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
  const durationOk = durationHours <= resource.max_booking_length_hours;
  add(
    "booking_length",
    "Maximum booking length",
    durationOk,
    durationOk
      ? `The booking is within the ${resource.max_booking_length_hours}-hour limit.`
      : `This resource allows bookings up to ${resource.max_booking_length_hours} hours.`,
  );

  const activeStatuses = ["REQUESTED", "VERIFYING", "PENDING_REVIEW", "APPROVED", "CHECKED_IN", "OVERDUE"];
  const { count: activeCount, error: activeError } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", activeStatuses);
  const activeOk = !activeError && (activeCount ?? 0) < resource.max_active_bookings_per_user;
  add(
    "active_booking_limit",
    "Active booking limit",
    activeOk,
    activeError
      ? "We could not confirm your active booking count."
      : `You have ${activeCount ?? 0} of ${resource.max_active_bookings_per_user} active bookings.`,
    activeOk ? null : "Cancel or finish an existing booking first.",
  );

  // The database uses the start time's calendar week and the user's bookings
  // for this resource, counting approved/check-in/overdue hours.
  const weekStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - ((day + 6) % 7));
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { data: weeklyRows, error: weeklyError } = await supabase
    .from("bookings")
    .select("start_at, end_at")
    .eq("user_id", user.id)
    .eq("resource_id", input.resourceId)
    .in("status", ["APPROVED", "CHECKED_IN", "OVERDUE"])
    .lt("start_at", weekEnd.toISOString())
    .gt("end_at", weekStart.toISOString());
  const existingHours = (weeklyRows ?? []).reduce((total, booking) => {
    const clippedStart = Math.max(new Date(booking.start_at).getTime(), weekStart.getTime());
    const clippedEnd = Math.min(new Date(booking.end_at).getTime(), weekEnd.getTime());
    return total + Math.max(0, clippedEnd - clippedStart) / 3_600_000;
  }, 0);
  const weeklyOk = !weeklyError
    && existingHours + durationHours <= resource.max_hours_per_user_per_week;
  add(
    "weekly_hours",
    "Weekly resource hours",
    weeklyOk,
    weeklyError
      ? "We could not confirm your weekly booking hours."
      : `This request uses ${durationHours.toFixed(1)} of your remaining ${Math.max(0, resource.max_hours_per_user_per_week - existingHours).toFixed(1)} weekly hours.`,
    weeklyOk ? null : "Choose a shorter booking or another week.",
  );

  const { data: slotAvailable, error: overlapError } = await supabase.rpc(
    "is_booking_slot_available",
    {
      p_resource_id: input.resourceId,
      p_start_at: start.toISOString(),
      p_end_at: end.toISOString(),
    },
  );
  const slotOk = !overlapError && slotAvailable === true;
  add(
    "slot_available",
    "Time slot available",
    slotOk,
    overlapError
      ? "We could not confirm this time slot."
      : slotOk ? "No approved booking overlaps this time." : "An approved booking already uses part of this time slot.",
    slotOk ? null : "Choose another time slot.",
  );

  return { eligible: results.every((item) => item.status === "MET"), results };
}



// Record the initial condition and check the resource out to the student.
export async function checkIn(
  input: ConditionReportInput,
): Promise<ActionResult<BookingSummary>> {
  const { supabase, user } = await getSignedInUser();

  if (!user) return failure("UNAUTHENTICATED");

  if (input.phase !== "BEFORE") {
    return failure("VALIDATION_ERROR: Check-in requires a BEFORE report");
  }

  const { data, error } = await supabase.rpc("check_in_booking", {
    p_booking_id: input.bookingId,
    p_overall: input.overall,
    p_notes: input.notes ?? null,
    p_checklist: input.checklist,
  });

  if (error) return failure(error.message);

  const row = data as unknown as DbBooking;

  const { data: resource } = await supabase
    .from("resources")
    .select("name")
    .eq("id", row.resource_id)
    .maybeSingle();

  return {
    ok: true,
    data: toBookingSummary(row, resource?.name ?? "Resource", "You"),
  };
}

// Record the return condition and mark the booking as returned.
export async function returnResource(
  input: ConditionReportInput,
): Promise<ActionResult<BookingSummary>> {
  const { supabase, user } = await getSignedInUser();

  if (!user) return failure("UNAUTHENTICATED");

  if (input.phase !== "AFTER") {
    return failure("VALIDATION_ERROR: Return requires an AFTER report");
  }

  const { data, error } = await supabase.rpc("return_booking", {
    p_booking_id: input.bookingId,
    p_overall: input.overall,
    p_notes: input.notes ?? null,
    p_checklist: input.checklist,
  });

  if (error) return failure(error.message);

  const row = data as unknown as DbBooking;

  const { data: resource } = await supabase
    .from("resources")
    .select("name")
    .eq("id", row.resource_id)
    .maybeSingle();

  return {
    ok: true,
    data: toBookingSummary(row, resource?.name ?? "Resource", "You"),
  };
}
