"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as api from "@/lib/api";
import { CHECKLIST } from "@/lib/format";
import type { ActionResult, ConditionStatus, PurposeType } from "@/src/types/common";

export type FormState = ActionResult<{ message: string }> | null;
const done = (message: string): FormState => ({ ok: true, data: { message } });

export async function signInAction(_: string | null, fd: FormData): Promise<string | null> {
  const r = await api.signIn({ email: String(fd.get("email") ?? "").trim(), password: String(fd.get("password") ?? "") });
  if (!r.ok) return r.error.message;
  redirect("/dashboard"); // dashboard adapts to the role
}
export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  void _;
  void fd;
  return {
    ok: false,
    error: {
      code: "SIGNUP_DISABLED",
      message: "New account registration is closed. Sign in using the User or Owner demo account.",
    },
  };
}
export async function requestPasswordResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const result = await api.requestPasswordReset(String(fd.get("email") ?? ""));
  if (!result.ok) return { ok: false, error: result.error };
  return done("If an account uses this email, password reset instructions will be sent. Check your inbox and spam folder.");
}
export async function updatePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  const confirmPassword = String(fd.get("confirmPassword") ?? "");
  if (password !== confirmPassword) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "The passwords don't match." } };
  }
  const result = await api.updatePassword(password);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function signOutAction() { await api.signOut(); redirect("/login"); }

const iso = (v: FormDataEntryValue | null) => { const d = new Date(`${v}:00+05:30`); return isNaN(+d) ? "" : d.toISOString(); }; // form times are IST
export async function requestBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const purposeNote = String(fd.get("purposeNote") ?? "").trim();
  if (!purposeNote) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Please explain why you need this resource." } };
  }
  const r = await api.requestBooking({ resourceId: String(fd.get("resourceId")), startAt: iso(fd.get("startAt")), endAt: iso(fd.get("endAt")), purpose: String(fd.get("purpose")) as PurposeType, purposeNote });
  if (!r.ok) return r;
  revalidatePath("/my-bookings");
  return done(r.data.status === "APPROVED" ? "Booking approved!" : "Request sent. The owner will review it.");
}
export async function decideAction(_: FormState, fd: FormData): Promise<FormState> {
  const decision = String(fd.get("decision")) as "APPROVE" | "REJECT" | "WAITLIST";
  const defaultReason = decision === "APPROVE"
    ? "Approved by the resource owner."
    : decision === "WAITLIST"
      ? "Added to the waitlist by the resource owner."
      : "Request declined by the resource owner.";
  const r = await api.decideBooking({ bookingId: String(fd.get("bookingId")), decision, reason: defaultReason });
  if (!r.ok) return r;
  revalidatePath("/owner/requests"); return done("Decision recorded.");
}
export async function cancelAction(fd: FormData) { await api.cancelBooking({ bookingId: String(fd.get("bookingId")), reason: "Cancelled by requester" }); revalidatePath("/my-bookings"); }
export async function conditionAction(_: FormState, fd: FormData): Promise<FormState> {
  const phase = String(fd.get("phase")), ck = fd.getAll("ck").map(String);
  const input = { bookingId: String(fd.get("bookingId")), phase: phase as "BEFORE" | "AFTER", overall: String(fd.get("overall")) as ConditionStatus, notes: String(fd.get("notes") ?? "") || undefined, checklist: CHECKLIST.map((item) => ({ item, ok: ck.includes(item) })) };
  const r = phase === "BEFORE" ? await api.checkIn(input) : await api.returnResource(input);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/owner/active"); revalidatePath("/my-bookings");
  return done(phase === "BEFORE" ? "Checked in. Before-report saved." : "Returned. After-report saved.");
}

import type { CreateResourceInput, ResourceCategory, UpdateResourceInput } from "@/src/types/resource";
function parseResource(fd: FormData): { ok: true; data: CreateResourceInput; maxBookingLengthHours?: number } | { ok: false; error: { code: string; message: string; field?: string } } {
  const name = String(fd.get("name") ?? "").trim(), location = String(fd.get("location") ?? "").trim();
  if (!name) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name is required.", field: "name" } };
  if (!location) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Location is required.", field: "location" } };
  const category = String(fd.get("category")) as ResourceCategory;
  const categories: ResourceCategory[] = ["LAB", "MAKERSPACE_TOOL", "CAMERA", "COMPUTER", "ROOM", "TEST_DEVICE"];
  if (!categories.includes(category)) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid category.", field: "category" } };
  const isEdit = String(fd.get("id") ?? "").trim().length > 0;
  const maxBookingLengthHours = Number(fd.get("maxBookingLengthHours"));
  if (isEdit && (!Number.isInteger(maxBookingLengthHours) || maxBookingLengthHours < 1)) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Maximum booking duration must be a whole number of hours greater than zero.", field: "maxBookingLengthHours" } };
  }
  return { ok: true, data: { name, location, category,
    description: String(fd.get("description") ?? "").trim() || undefined, usageRules: String(fd.get("usageRules") ?? "").trim() || undefined,
    requiresStaffPresent: fd.get("requiresStaffPresent") === "on", isHighDemand: fd.get("isHighDemand") === "on" }, ...(isEdit ? { maxBookingLengthHours } : {}) };
}
export async function saveResourceAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseResource(fd); if (!p.ok) return p;
  const id = String(fd.get("id") ?? "");
  // Creation uses the full create contract; editing uses a separate partial-update contract.
  const update: UpdateResourceInput = { ...p.data, ...(p.maxBookingLengthHours !== undefined ? { maxBookingLengthHours: p.maxBookingLengthHours } : {}), isActive: fd.get("isActive") === "on" };
  const r = id ? await api.updateResource(id, update) : await api.createResource(p.data);
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/owner/resources"); revalidatePath("/resources");
  if (id) revalidatePath(`/resources/${id}`);
  redirect("/owner/resources");
}
