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
  const u = await api.getCurrentUser();
  redirect("/dashboard"); // dashboard adapts to the role
}
export async function signOutAction() { await api.signOut(); redirect("/login"); }

const iso = (v: FormDataEntryValue | null) => { const d = new Date(`${v}:00+05:30`); return isNaN(+d) ? "" : d.toISOString(); }; // form times are IST
export async function requestBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await api.requestBooking({ resourceId: String(fd.get("resourceId")), startAt: iso(fd.get("startAt")), endAt: iso(fd.get("endAt")), purpose: String(fd.get("purpose")) as PurposeType, purposeNote: String(fd.get("purposeNote") ?? "") || undefined });
  if (!r.ok) return r;
  revalidatePath("/my-bookings");
  return done(r.data.status === "APPROVED" ? "Booking approved!" : "Request sent. The owner will review it.");
}
export async function decideAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await api.decideBooking({ bookingId: String(fd.get("bookingId")), decision: String(fd.get("decision")) as "APPROVE" | "REJECT" | "WAITLIST", reason: String(fd.get("reason") ?? "") });
  if (!r.ok) return r;
  revalidatePath("/owner/requests"); return done("Decision recorded.");
}
export async function cancelAction(fd: FormData) { await api.cancelBooking({ bookingId: String(fd.get("bookingId")), reason: "Cancelled by requester" }); revalidatePath("/my-bookings"); }
export async function conditionAction(_: FormState, fd: FormData): Promise<FormState> {
  const phase = String(fd.get("phase")), ck = fd.getAll("ck").map(String);
  const input = { bookingId: String(fd.get("bookingId")), overall: String(fd.get("overall")) as ConditionStatus, notes: String(fd.get("notes") ?? "") || undefined, checklist: CHECKLIST.map((item) => ({ item, ok: ck.includes(item) })) };
  const r = phase === "BEFORE" ? await api.checkIn(input) : await api.returnResource(input);
  if (!r.ok) return r;
  revalidatePath("/owner/active"); revalidatePath("/my-bookings");
  return done(phase === "BEFORE" ? "Checked in. Before-report saved." : "Returned. After-report saved.");
}

import type { CreateResourceInput, ResourceCategory, UpdateResourceInput } from "@/src/types/resource";
function parseResource(fd: FormData): { ok: true; data: CreateResourceInput } | { ok: false; error: { code: string; message: string; field?: string } } {
  const name = String(fd.get("name") ?? "").trim(), location = String(fd.get("location") ?? "").trim();
  if (!name) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name is required.", field: "name" } };
  if (!location) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Location is required.", field: "location" } };
  return { ok: true, data: { name, location, category: String(fd.get("category")) as ResourceCategory,
    description: String(fd.get("description") ?? "").trim() || undefined, usageRules: String(fd.get("usageRules") ?? "").trim() || undefined,
    requiresStaffPresent: fd.get("requiresStaffPresent") === "on", isHighDemand: fd.get("isHighDemand") === "on" } };
}
export async function saveResourceAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = parseResource(fd); if (!p.ok) return p;
  const id = String(fd.get("id") ?? "");
  // Creation uses the full create contract; editing uses a separate partial-update contract.
  const update: UpdateResourceInput = { ...p.data, isActive: fd.get("isActive") === "on" };
  const r = id ? await api.updateResource(id, update) : await api.createResource(p.data);
  if (!r.ok) return r;
  revalidatePath("/owner/resources"); revalidatePath("/resources");
  redirect("/owner/resources");
}
