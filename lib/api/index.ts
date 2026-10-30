// Adapter over the real server actions. The handoff doesn't pin return shapes for some reads,
// so unwrap() accepts either a plain value or { ok, data }. Tighten once shapes are confirmed.
import type { ActionResult, UserRole } from "../../src/types/common";
import type { CreateResourceInput, ResourceDetail, ResourceFilters, ResourceSummary, UpdateResourceInput } from "../../src/types/resource";
import type { BookingSummary, DecideBookingInput, RequestBookingInput } from "../../src/types/booking";
import * as auth from "../../app/actions/auth";
import * as resources from "../../app/actions/resources";
import * as bookings from "../../app/actions/bookings";
import * as lifecycle from "../../app/actions/lifecycle";

export interface CurrentUser { id: string; name: string; role: UserRole }
function unwrap<T>(result: ActionResult<T>, fallback: T): T {
  return result.ok ? result.data : fallback;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await auth.getCurrentUser();
  if (!result.ok || !result.data) return null;
  return { id: result.data.id, name: result.data.fullName || "User", role: result.data.role };
}

export const signIn = auth.signIn;
export const requestPasswordReset = auth.requestPasswordReset;
export const updatePassword = auth.updatePassword;
export const signOut = auth.signOut;
export const createResource = (input: CreateResourceInput) => resources.createResource(input);
export const updateResource = (id: string, input: UpdateResourceInput) => resources.updateResource(id, input);
export async function listResources(filters: ResourceFilters = {}): Promise<ResourceSummary[]> {
  return unwrap(await resources.listResources(filters), []);
}
export const listResourceResult = (filters: ResourceFilters = {}) => resources.listResources(filters);
export async function listManageableResources(filters: ResourceFilters = {}): Promise<ResourceSummary[]> {
  return unwrap(await resources.listManageableResources(filters), []);
}
export async function getResource(id: string): Promise<ResourceDetail | null> {
  return unwrap(await resources.getResource(id), null);
}

export const requestBooking = (input: RequestBookingInput) => bookings.requestBooking(input);
export const decideBooking = (input: DecideBookingInput) => bookings.decideBooking(input);
export const cancelBooking = (input: { bookingId: string; reason: string }) => bookings.cancelBooking(input);
export async function listOwnerRequests(): Promise<BookingSummary[]> {
  return unwrap(await bookings.listOwnerRequests(), []);
}
export const listMyBookings = () => lifecycle.listMyBookings();
export const listActiveBookings = () => lifecycle.listActiveBookings();
export const getBookingDetail = (id: string) => lifecycle.getBookingDetail(id);
export const checkIn = (input: Parameters<typeof lifecycle.checkIn>[0]) => lifecycle.checkIn(input);
export const returnResource = (input: Parameters<typeof lifecycle.returnResource>[0]) => lifecycle.returnResource(input);
