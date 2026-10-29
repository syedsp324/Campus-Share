
"use server";

"use server";

import { createClient } from "../../lib/supabase/server";
import type { ActionResult, UserRole } from "../../src/types/common";
import type {
  CreateResourceInput,
  ResourceDetail,
  ResourceFilters,
  ResourceSummary,
  UpdateResourceInput,
} from "../../src/types/resource";

type DbResource = {
  id: string;
  name: string;
  category: ResourceSummary["category"];
  description: string | null;
  location: string | null;
  photo_url: string | null;
  usage_rules: string | null;
  requires_staff_present: boolean;
  is_high_demand: boolean;
  is_active: boolean;
  deposit_amount: number;
  max_hours_per_user_per_week: number;
  max_active_bookings_per_user: number;
  max_booking_length_hours: number;
  owner_id: string;
};

function toSummary(
  resource: DbResource,
  ownerName: string,
): ResourceSummary {
  return {
    id: resource.id,
    ownerId: resource.owner_id,
    name: resource.name,
    category: resource.category,
    description: resource.description,
    location: resource.location,
    photoUrl: resource.photo_url,
    isHighDemand: resource.is_high_demand,
    isActive: resource.is_active,
    ownerName,
  };
}

function toDetail(
  resource: DbResource,
  ownerName: string,
): ResourceDetail {
  return {
    ...toSummary(resource, ownerName),
    usageRules: resource.usage_rules,
    requiresStaffPresent: resource.requires_staff_present,
    depositAmount: Number(resource.deposit_amount),
    maxHoursPerUserPerWeek: resource.max_hours_per_user_per_week,
    maxActiveBookingsPerUser: resource.max_active_bookings_per_user,
    maxBookingLengthHours: resource.max_booking_length_hours,
  };
}

async function getActor() {
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { error: "UNAUTHENTICATED" as const };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) return { error: "INTERNAL_ERROR" as const };
  if (!profile) return { error: "FORBIDDEN" as const };

  return {
    supabase,
    userId: profile.id,
    role: profile.role as UserRole,
  };
}

function failure(
  code: string,
  message: string,
): ActionResult<never> {
  return { ok: false, error: { code, message } };
}

export async function listResources(
  filters: ResourceFilters = {},
): Promise<ActionResult<ResourceSummary[]>> {
  return listResourceRows(filters, false);
}

export async function listManageableResources(
  filters: ResourceFilters = {},
): Promise<ActionResult<ResourceSummary[]>> {
  return listResourceRows(filters, true);
}

async function listResourceRows(
  filters: ResourceFilters,
  includeInactive: boolean,
): Promise<ActionResult<ResourceSummary[]>> {
  const actor = await getActor();

  if ("error" in actor && actor.error) {
    return failure(actor.error, "Unable to access resources.");
    }

  if (includeInactive && actor.role === "user") {
    return failure("FORBIDDEN", "Only resource owners and managers can manage resources.");
  }

  let query = actor.supabase
    .from("resources")
    .select(`
      id, name, category, description, location, photo_url,
      usage_rules, requires_staff_present, is_high_demand,
      is_active, deposit_amount, max_hours_per_user_per_week,
      max_active_bookings_per_user, max_booking_length_hours,
      owner_id
    `)
    .order("name");

  if (!includeInactive) query = query.eq("is_active", true);
  if (includeInactive && actor.role === "owner") {
    query = query.eq("owner_id", actor.userId);
  }

  if (filters.category) query = query.eq("category", filters.category);

  if (filters.location) {
    query = query.ilike("location", `%${filters.location.trim()}%`);
  }

  if (filters.query) {
    const search = filters.query.trim().replace(/[,%()]/g, "");
    if (search) query = query.ilike("name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return failure("INTERNAL_ERROR", "Unable to load resources.");
  }

  const resources = (data ?? []) as DbResource[];
  const ownerIds = [...new Set(resources.map((r) => r.owner_id))];

  const { data: profiles } = ownerIds.length
    ? await actor.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds)
    : { data: [] };

  const names = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name]),
  );

  return {
    ok: true,
    data: resources.map((r) =>
      toSummary(r, names.get(r.owner_id) || "Campus resource owner"),
    ),
  };
}

export async function getResource(
  resourceId: string,
): Promise<ActionResult<ResourceDetail>> {
  const actor = await getActor();

  if ("error" in actor && actor.error) {
    return failure(actor.error, "Unable to access resources.");
    }

  const { data, error } = await actor.supabase
    .from("resources")
    .select(`
      id, name, category, description, location, photo_url,
      usage_rules, requires_staff_present, is_high_demand,
      is_active, deposit_amount, max_hours_per_user_per_week,
      max_active_bookings_per_user, max_booking_length_hours,
      owner_id
    `)
    .eq("id", resourceId)
    .maybeSingle();

  if (error) return failure("INTERNAL_ERROR", "Unable to load resource.");
  if (!data) return failure("NOT_FOUND", "Resource not found.");

  const resource = data as DbResource;
  const { data: owner } = await actor.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", resource.owner_id)
    .maybeSingle();

  return {
    ok: true,
    data: toDetail(resource, owner?.full_name || "Campus resource owner"),
  };
}

export async function createResource(
  input: CreateResourceInput,
): Promise<ActionResult<ResourceDetail>> {
  const actor = await getActor();

  if ("error" in actor && actor.error) {
    return failure(actor.error, "Unable to access resources.");
    }

  if (!["owner", "admin"].includes(actor.role)) {
    return failure("FORBIDDEN", "Only resource owners can list resources.");
  }

  const name = input.name.trim();
  const location = input.location.trim();

  if (!name || !location) {
    return failure("VALIDATION_ERROR", "Name and location are required.");
  }

  const { data, error } = await actor.supabase
    .from("resources")
    .insert({
      owner_id: actor.userId,
      name,
      category: input.category,
      description: input.description?.trim() || null,
      location,
      usage_rules: input.usageRules?.trim() || null,
      requires_staff_present: input.requiresStaffPresent,
      is_high_demand: input.isHighDemand,
    })
    .select(`
      id, name, category, description, location, photo_url,
      usage_rules, requires_staff_present, is_high_demand,
      is_active, deposit_amount, max_hours_per_user_per_week,
      max_active_bookings_per_user, max_booking_length_hours,
      owner_id
    `)
    .single();

  if (error || !data) {
    return failure("INTERNAL_ERROR", "Unable to create resource.");
  }

  return {
    ok: true,
    data: toDetail(data as DbResource, "You"),
  };
}

export async function updateResource(
  resourceId: string,
  input: UpdateResourceInput,
): Promise<ActionResult<ResourceDetail>> {
  const actor = await getActor();

    if ("error" in actor && actor.error) {
    return failure(actor.error, "Unable to access resources.");
    }

  if (!["owner", "admin"].includes(actor.role)) {
    return failure("FORBIDDEN", "You cannot update resources.");
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return failure("VALIDATION_ERROR", "Name is required.");
    updates.name = name;
  }
  if (input.category !== undefined) {
    const categories = ["LAB", "MAKERSPACE_TOOL", "CAMERA", "COMPUTER", "ROOM", "TEST_DEVICE"];
    if (!categories.includes(input.category)) return failure("VALIDATION_ERROR", "Choose a valid resource category.");
    updates.category = input.category;
  }
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.location !== undefined) {
    const location = input.location.trim();
    if (!location) return failure("VALIDATION_ERROR", "Location is required.");
    updates.location = location;
  }
  if (input.usageRules !== undefined) updates.usage_rules = input.usageRules?.trim() || null;
  if (input.requiresStaffPresent !== undefined) updates.requires_staff_present = input.requiresStaffPresent;
  if (input.isHighDemand !== undefined) updates.is_high_demand = input.isHighDemand;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.maxBookingLengthHours !== undefined) {
    if (!Number.isInteger(input.maxBookingLengthHours) || input.maxBookingLengthHours < 1) {
      return failure("VALIDATION_ERROR", "Maximum booking duration must be a whole number of hours greater than zero.");
    }
    updates.max_booking_length_hours = input.maxBookingLengthHours;
  }
  if (!Object.keys(updates).length) return failure("VALIDATION_ERROR", "No resource changes were provided.");

  const { data, error } = await actor.supabase
    .from("resources")
    .update(updates)
    .eq("id", resourceId)
    .select(`
      id, name, category, description, location, photo_url,
      usage_rules, requires_staff_present, is_high_demand,
      is_active, deposit_amount, max_hours_per_user_per_week,
      max_active_bookings_per_user, max_booking_length_hours,
      owner_id
    `)
    .maybeSingle();

  if (error) return failure("INTERNAL_ERROR", "Unable to update resource.");
  if (!data) {
    return failure(
      "FORBIDDEN",
      "Resource not found or you do not own it.",
    );
  }

  const resource = data as DbResource;
  const { data: owner } = await actor.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", resource.owner_id)
    .maybeSingle();

  return {
    ok: true,
    data: toDetail(resource, owner?.full_name || "Campus resource owner"),
  };
}
