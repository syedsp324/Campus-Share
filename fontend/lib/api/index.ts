// Adapter over the real server actions. The handoff doesn't pin return shapes for some reads,
// so unwrap() accepts either a plain value or { ok, data }. Tighten once shapes are confirmed.
import type { ActionResult, UserRole } from "@/src/types/common";
import type { CreateResourceInput, ResourceDetail, ResourceFilters, ResourceSummary, UpdateResourceInput } from "@/src/types/resource";
import type { BookingSummary, DecideBookingInput, RequestBookingInput } from "@/src/types/booking";
import type { EligibilityResult } from "@/src/types/eligibility";
import * as auth from "@/app/actions/auth";
import * as res from "@/app/actions/resources";
import * as bk from "@/app/actions/bookings";
import * as lc from "@/app/actions/lifecycle";
export interface CurrentUser { id: string; name: string; role: UserRole }
function unwrap<T>(r: unknown, fallback: T): T {
  if (r && typeof r === "object" && "ok" in r) { const a = r as ActionResult<T>; return a.ok ? a.data : fallback; }
  return (r as T) ?? fallback;
}
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const u = unwrap<Record<string, unknown> | null>(await auth.getCurrentUser(), null);
  if (!u) return null;
  return { id: String(u.id ?? ""), role: (u.role ?? "user") as UserRole, name: String(u.fullName ?? u.full_name ?? u.name ?? u.email ?? "User") };
}
export const signIn = async (i: { email: string; password: string }) => (await auth.signIn(i)) as unknown as ActionResult<unknown>;
export const signOut = async () => { await auth.signOut(); };
export const createResource = async (i: CreateResourceInput) => (await res.createResource(i)) as unknown as ActionResult<unknown>;
export const updateResource = async (id: string, i: UpdateResourceInput) => (await res.updateResource(id, i)) as unknown as ActionResult<unknown>;
export const listResources = async (f: ResourceFilters = {}) => unwrap<ResourceSummary[]>(await res.listResources(f), []);
export const getResource = async (id: string) => unwrap<ResourceDetail | null>(await res.getResource(id), null);
export const requestBooking = async (i: RequestBookingInput) => (await bk.requestBooking(i)) as unknown as ActionResult<BookingSummary>;
export const decideBooking = async (i: DecideBookingInput) => (await bk.decideBooking(i)) as unknown as ActionResult<BookingSummary>;
export const cancelBooking = async (i: { bookingId: string; reason: string }) => (await bk.cancelBooking(i)) as unknown as ActionResult<BookingSummary>;
// Uses the DB-side queue so requester names resolve (the handoff flags names as broken in bk.listOwnerRequests).
export const listOwnerRequests = async () => unwrap<BookingSummary[]>(await lc.listRequestQueue(), []);
export const getEligibility = (id: string): Promise<EligibilityResult> => lc.getEligibility(id);
export const listMyBookings = () => lc.listMyBookings();
export const listActiveBookings = () => lc.listActiveBookings();
export const getBookingDetail = (id: string) => lc.getBookingDetail(id);
export const checkIn = (i: Parameters<typeof lc.checkIn>[0]) => lc.checkIn(i);
export const returnResource = (i: Parameters<typeof lc.returnResource>[0]) => lc.returnResource(i);
