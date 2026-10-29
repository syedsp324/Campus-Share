"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction } from "@/app/form-actions";
import { Feedback } from "./Feedback";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="card mx-auto grid w-full max-w-lg gap-5" aria-busy={pending}>
      <div>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email on your account. If it matches, we’ll send a secure reset link.</p>
      </div>
      <label className="field-label">College email
        <input required name="email" type="email" autoComplete="email" maxLength={254} className="input mt-2" placeholder="you@campus.edu" />
      </label>
      <button className="btn w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
      <Feedback state={state} />
      <p className="text-center text-sm text-slate-600"><Link href="/login" className="font-semibold text-teal-700 underline underline-offset-4">Back to sign in</Link></p>
    </form>
  );
}
