
"use server";

import { createClient } from "../../lib/supabase/server";
import type { ActionResult, UserRole } from "../../src/types/common";

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const email = input.email.trim();

  if (!email || !input.password) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Email and password are required.",
      },
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Unable to sign in. Check your credentials.",
      },
    };
  }

  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to sign out. Please try again.",
      },
    };
  }

  return { ok: true, data: null };
}

export async function getCurrentUser(): Promise<
  ActionResult<{
    id: string;
    fullName: string;
    role: UserRole;
  } | null>
> {
  const supabase = await createClient();

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { ok: true, data: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load your user profile.",
      },
    };
  }

  if (!profile) {
    return { ok: true, data: null };
  }

  return {
    ok: true,
    data: {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role as UserRole,
    },
  };
}
