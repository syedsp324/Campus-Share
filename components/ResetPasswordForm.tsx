"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/app/form-actions";
import { Feedback } from "./Feedback";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);

  return (
    <form action={action} className="card mx-auto grid w-full max-w-lg gap-5" aria-busy={pending}>
      <div>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Use at least 8 characters. Your reset link can only be used once.</p>
      </div>
      <label className="field-label">New password
        <input required name="password" type="password" autoComplete="new-password" minLength={8} className="input mt-2" />
      </label>
      <label className="field-label">Confirm new password
        <input required name="confirmPassword" type="password" autoComplete="new-password" minLength={8} className="input mt-2" />
      </label>
      <button className="btn w-full" disabled={pending}>{pending ? "Updating…" : "Update password"}</button>
      <Feedback state={state} />
    </form>
  );
}
