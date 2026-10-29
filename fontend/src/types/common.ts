export type UserRole = "user" | "manager" | "owner" | "admin";
export type BookingStatus = "REQUESTED"|"VERIFYING"|"PENDING_REVIEW"|"APPROVED"|"REJECTED"|"WAITLISTED"|"CHECKED_IN"|"RETURNED"|"CLOSED"|"CANCELLED"|"OVERDUE"|"DISPUTED";
export type RequirementStatus = "MET" | "MISSING" | "PENDING" | "EXPIRED";
export type PurposeType = "COURSEWORK" | "RESEARCH" | "STUDENT_PROJECT" | "OTHER";
export type ConditionStatus = "GOOD" | "MINOR_WEAR" | "DAMAGED" | "MISSING_PARTS";
export type UUID = string;
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; field?: string } };
