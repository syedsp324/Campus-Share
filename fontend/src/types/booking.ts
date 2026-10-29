import type { UUID, BookingStatus, PurposeType, ConditionStatus } from "./common";
export interface BookingSummary { id: UUID; resourceId: UUID; resourceName: string; userId: UUID; requesterName: string; startAt: string; endAt: string; purpose: PurposeType; status: BookingStatus; decisionReason: string | null; priorityScore: number | null; }
export interface RequestBookingInput { resourceId: UUID; startAt: string; endAt: string; purpose: PurposeType; purposeNote?: string; teamName?: string; }
export interface DecideBookingInput { bookingId: UUID; decision: "APPROVE" | "REJECT" | "WAITLIST"; reason: string; }
export interface ConditionReportInput { bookingId: UUID; phase: "BEFORE" | "AFTER"; overall: ConditionStatus; notes?: string; checklist: Array<{ item: string; ok: boolean; note?: string }>; }
export interface BookingDetail extends BookingSummary { checkedInAt: string | null; returnedAt: string | null; conditionReports: ConditionReportInput[]; }
