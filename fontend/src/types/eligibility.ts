import type { UUID, RequirementStatus } from "./common";
export interface EligibilityItem { requirementId: UUID; label: string; status: RequirementStatus; message: string; howToFix: string | null; }
export interface EligibilityResult { eligible: boolean; results: EligibilityItem[]; }
