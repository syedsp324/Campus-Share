
"use server";

import { headers } from "next/headers";
import { createClient } from "../../lib/supabase/server";
import type { ActionResult, UserRole } from "../../src/types/common";

async function getAuthCallbackUrl(flow?: "reset"): Promise<string | null> {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const requestHeaders = await headers();
  const origin = configuredUrl || requestHeaders.get("origin");
  if (!origin) return null;

  try {
    const siteUrl = new URL(origin);
    const isLocal = siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1";
    if (siteUrl.protocol !== "https:" && !(isLocal && siteUrl.protocol === "http:")) return null;

    if (!configuredUrl) {
      const requestHost = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
        .split(",")[0]
        .trim();
      if (!requestHost || requestHost.toLowerCase() !== siteUrl.host.toLowerCase()) return null;
    }

    const callbackUrl = new URL("/auth/callback", siteUrl);
    if (flow) callbackUrl.searchParams.set("flow", flow);
    return callbackUrl.toString();
  } catch {
    return null;
  }
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  const email = input.email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !input.password) {
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
        message: "We couldn't sign you in. Check your email and password, and confirm your email if you just registered.",
      },
    };
  }

  return { ok: true, data: { redirectTo: "/dashboard" } };
}

export async function requestPasswordReset(emailInput: string): Promise<ActionResult<{ sent: true }>> {
  const email = emailInput.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Enter a valid email address." } };
  }

  const redirectTo = await getAuthCallbackUrl("reset");
  if (!redirectTo) {
    return { ok: false, error: { code: "CONFIGURATION_ERROR", message: "Password reset is temporarily unavailable. Please try again later." } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    return { ok: false, error: { code: "RESET_EMAIL_FAILED", message: "We couldn't send reset instructions right now. Wait a minute and try again." } };
  }

  // Supabase intentionally does not reveal whether the email belongs to an account.
  return { ok: true, data: { sent: true } };
}

export async function updatePassword(password: string): Promise<ActionResult<null>> {
  if (password.length < 8) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Use a password with at least 8 characters." } };
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) {
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "This reset link has expired. Request a new one." } };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: { code: "PASSWORD_UPDATE_FAILED", message: "We couldn't update your password. Try a longer password." } };
  }

  return { ok: true, data: null };
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
