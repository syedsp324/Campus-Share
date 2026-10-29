import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const confirmationTypes = new Set<EmailOtpType>(["signup", "email", "recovery"]);

export async function handleAuthCallback(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  const code = redirectUrl.searchParams.get("code");
  const tokenHash = redirectUrl.searchParams.get("token_hash");
  const type = redirectUrl.searchParams.get("type");

  let verified = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (tokenHash && type && confirmationTypes.has(type as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    verified = !error;
  }

  const isPasswordRecovery = redirectUrl.searchParams.get("flow") === "reset" || type === "recovery";
  redirectUrl.pathname = verified
    ? isPasswordRecovery ? "/reset-password" : "/dashboard"
    : "/auth/confirmation-error";
  redirectUrl.search = "";
  redirectUrl.hash = "";
  return NextResponse.redirect(redirectUrl);
}
