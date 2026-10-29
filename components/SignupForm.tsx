"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/app/form-actions";
import { Feedback } from "./Feedback";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, null);

  return (
    <form action={action} className="login-form" aria-busy={pending}>
      <div>
        <p className="eyebrow">JOIN YOUR CAMPUS</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Create your account</h2>
        <p className="mt-2 text-sm text-slate-500">Use your campus email to get started.</p>
      </div>
      <label className="field-label">
        Full name
        <input required name="fullName" type="text" autoComplete="name" minLength={2} maxLength={80} className="input mt-2" placeholder="Your name" />
      </label>
      <label className="field-label">
        College email
        <input required name="email" type="email" autoComplete="email" maxLength={254} className="input mt-2" placeholder="you@campus.edu" />
      </label>
      <label className="field-label">
        Password
        <input required name="password" type="password" autoComplete="new-password" minLength={8} className="input mt-2" placeholder="At least 8 characters" />
      </label>
      <label className="field-label">
        Confirm password
        <input required name="confirmPassword" type="password" autoComplete="new-password" minLength={8} className="input mt-2" placeholder="Enter your password again" />
      </label>
      <p className="text-xs leading-5 text-slate-500">New accounts start with the student role. Owners are assigned separately by a CampusShare administrator.</p>
      <button className="btn w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account →"}
      </button>
      <Feedback state={state} />
      <p className="text-center text-sm text-slate-600">Already have an account? <Link href="/login" className="font-semibold text-teal-700 underline underline-offset-4">Sign in</Link></p>
    </form>
  );
}
