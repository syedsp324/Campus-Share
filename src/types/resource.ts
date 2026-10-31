import type { UUID } from "./common";

export type ResourceCategory = "LAB" | "MAKERSPACE_TOOL" | "CAMERA" | "COMPUTER" | "ROOM" | "TEST_DEVICE";

export interface ResourceSummary {
  id: UUID;
  ownerId: UUID | null;
  name: string;
  category: ResourceCategory;
  description: string | null;
  location: string | null;
  photoUrl: string | null;
  isHighDemand: boolean;
  isActive: boolean;
  ownerName: string;
}

export interface ResourceDetail extends ResourceSummary {
  usageRules: string | null;
  requiresStaffPresent: boolean;
  depositAmount: number;
  maxHoursPerUserPerWeek: number;
  maxActiveBookingsPerUser: number;
  maxBookingLengthHours: number;
}

export interface ResourceFilters {
  query?: string;
  category?: ResourceCategory;
  location?: string;
  availableFrom?: string;
  availableTo?: string;
}

export interface CreateResourceInput {
  name: string;
  category: ResourceCategory;
  description?: string;
  location: string;
  usageRules?: string;
  requiresStaffPresent: boolean;
  isHighDemand: boolean;
}

/** Partial updates are intentionally separate from creation fields. */
export interface UpdateResourceInput {
  name?: string;
  category?: ResourceCategory;
  description?: string | null;
  location?: string;
  usageRules?: string | null;
  requiresStaffPresent?: boolean;
  isHighDemand?: boolean;
  isActive?: boolean;
  maxBookingLengthHours?: number;
}
