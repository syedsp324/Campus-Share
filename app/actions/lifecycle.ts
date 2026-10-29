"use server";

import {
  getBookingDetail as readBookingDetail,
  getEligibility as checkEligibility,
  listActiveBookings as readActiveBookings,
  listMyBookings as readMyBookings,
  checkIn as submitCheckIn,
  returnResource as submitReturn,
} from "./bookings";
import type { ConditionReportInput } from "../../src/types/booking";

// Thin compatibility layer for the overlay; mutations still use existing RPCs.
export async function listMyBookings() {
  return readMyBookings();
}

export async function listActiveBookings() {
  return readActiveBookings();
}

export async function getBookingDetail(bookingId: string) {
  return readBookingDetail(bookingId);
}

export async function getEligibility(input: {
  resourceId: string;
  startAt: string;
  endAt: string;
}) {
  return checkEligibility(input);
}

export async function checkIn(input: ConditionReportInput) {
  return submitCheckIn(input);
}

export async function returnResource(input: ConditionReportInput) {
  return submitReturn(input);
}
