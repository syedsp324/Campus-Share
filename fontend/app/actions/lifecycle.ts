"use server";
// Additive server actions: reads + check-in/return + eligibility. All writes go through SQL functions (migration 0003).
import { createClient } from "../../lib/supabase/server";
import type { ActionResult, BookingStatus, ConditionStatus, PurposeType } from "../../src/types/common";
import type { BookingSummary } from "../../src/types/booking";
import type { EligibilityItem, EligibilityResult } from "../../src/types/eligibility";
import type { BookingFullDetail, CheckInInput, TimelineEvent } from "../../src/types/lifecycle";

const MSG: Record<string, string> = { UNAUTHENTICATED: "Please sign in.", FORBIDDEN: "You don't have access to this.", NOT_FOUND: "We couldn't find that booking.",
  VALIDATION_ERROR: "Please check the details and try again.", INVALID_TRANSITION: "That action isn't allowed for the booking's current status.",
  CONFLICT: "A report for this step already exists.", INTERNAL_ERROR: "Something went wrong. Please try again." };
// Never leak raw SQL errors: map to a contract code + safe message.
function fail(message = "", pgCode?: string): ActionResult<never> {
  const code = pgCode === "23505" ? "CONFLICT" : pgCode === "23514" ? "VALIDATION_ERROR" : Object.keys(MSG).find((k) => message.includes(k)) ?? "INTERNAL_ERROR";
  const custom = message.startsWith("VALIDATION_ERROR:") ? message.slice(17).trim() : undefined;
  return { ok: false, error: { code, message: custom ?? MSG[code] } };
}
type Row = { id: string; resource_id: string; resource_name: string; user_id: string; requester_name: string; start_at: string; end_at: string;
  purpose: PurposeType; status: BookingStatus; decision_reason: string | null; priority_score: number | null; checked_in_at: string | null; returned_at: string | null };
const toSummary = (r: Row): BookingSummary => ({ id: r.id, resourceId: r.resource_id, resourceName: r.resource_name, userId: r.user_id, requesterName: r.requester_name,
  startAt: r.start_at, endAt: r.end_at, purpose: r.purpose, status: r.status, decisionReason: r.decision_reason, priorityScore: r.priority_score });

async function list(scope: "mine" | "owner_active" | "owner_requests"): Promise<ActionResult<BookingSummary[]>> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("list_bookings", { p_scope: scope });
  if (error) return fail(error.message, error.code);
  return { ok: true, data: ((data ?? []) as Row[]).map(toSummary) };
}
export async function listMyBookings() { return list("mine"); }
export async function listActiveBookings() { return list("owner_active"); }
export async function listRequestQueue() { return list("owner_requests"); }

export async function getBookingDetail(bookingId: string): Promise<ActionResult<BookingFullDetail>> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("get_booking_detail", { p_booking_id: bookingId });
  if (error) return fail(error.message, error.code);
  if (!data) return fail("NOT_FOUND");
  const d = data as { booking: Row; resource_name: string; requester_name: string; reports: { phase: "BEFORE" | "AFTER"; overall: ConditionStatus; notes: string | null; checklist: { item: string; ok: boolean; note?: string }[] }[]; timeline: TimelineEvent[] };
  const b = d.booking;
  return { ok: true, data: { ...toSummary({ ...b, resource_name: d.resource_name, requester_name: d.requester_name }), checkedInAt: b.checked_in_at, returnedAt: b.returned_at,
    conditionReports: d.reports.map((r) => ({ bookingId, phase: r.phase, overall: r.overall, notes: r.notes ?? undefined, checklist: r.checklist })), timeline: d.timeline } };
}
async function transition(fn: "check_in_booking" | "return_booking", i: CheckInInput): Promise<ActionResult<{ status: BookingStatus }>> {
  if (!i.checklist?.length) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Complete the condition checklist.", field: "checklist" } };
  const sb = await createClient();
  const { data, error } = await sb.rpc(fn, { p_booking_id: i.bookingId, p_overall: i.overall, p_notes: i.notes ?? null, p_checklist: i.checklist });
  if (error) return fail(error.message, error.code);
  return { ok: true, data: { status: (data as Row).status } };
}
export async function checkIn(i: CheckInInput) { return transition("check_in_booking", i); }
export async function returnResource(i: CheckInInput) { return transition("return_booking", i); }

// Honest eligibility: only checks the current schema can prove (no credential tables yet).
export async function getEligibility(resourceId: string): Promise<EligibilityResult> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: res } = await sb.from("resources").select("is_active,requires_staff_present,max_active_bookings_per_user").eq("id", resourceId).maybeSingle();
  const results: EligibilityItem[] = [];
  const item = (label: string, ok: boolean, message: string, howToFix: string | null = null): void => { results.push({ requirementId: label, label, status: ok ? "MET" : "MISSING", message, howToFix }); };
  item("Resource available", !!res?.is_active, res?.is_active ? "This resource is open for booking." : "This resource is not currently active.");
  if (user && res) {
    const { count } = await sb.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("resource_id", resourceId).in("status", ["REQUESTED", "APPROVED", "CHECKED_IN", "WAITLISTED"]);
    const used = count ?? 0, max = res.max_active_bookings_per_user as number;
    item("Active booking limit", used < max, `You have ${used} of ${max} active bookings for this resource.`, used < max ? null : "Cancel or finish an existing booking first.");
  }
  if (res?.requires_staff_present) item("Staff supervision", true, "Staff will be present; the owner checks you in.");
  return { eligible: results.every((r) => r.status === "MET"), results };
}
