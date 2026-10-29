export const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
export const ERROR_HINTS: Record<string, string> = { UNAUTHENTICATED: "Please sign in.", FORBIDDEN: "You don't have access to this.", ELIGIBILITY_FAILED: "Requirements not met.", QUOTA_EXCEEDED: "Limit reached.", SLOT_UNAVAILABLE: "Slot taken.", INVALID_TRANSITION: "Action not allowed in this state.", CONFLICT: "Changed by someone else; refresh.", INTERNAL_ERROR: "Something went wrong. Try again." };
export const CHECKLIST = ["Powers on / works as expected", "All accessories present", "No visible damage", "Clean and ready for next user"];
export const HAS_LIFECYCLE = true; // check-in/return pages exist in this build
export function asList<T>(r: T[] | { ok: boolean; data?: T[] }): T[] { return Array.isArray(r) ? r : r.ok && r.data ? r.data : []; }
