import type { BookingDetail } from "./booking";
export interface TimelineEvent { action: string; reason: string | null; actor: string; at: string }
export interface BookingFullDetail extends BookingDetail { timeline: TimelineEvent[] }
export type CheckInInput = { bookingId: string; overall: import("./common").ConditionStatus; notes?: string; checklist: { item: string; ok: boolean }[] };
