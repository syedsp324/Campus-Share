"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "../form-actions";
export default function Login() {
  const [err, action, pending] = useActionState(signInAction, null);
  return (
    <div className="login-layout">
      <section className="login-story">
        <p className="eyebrow text-indigo-200">CAMPUSSHARE</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">More access.<br />More possibilities.</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-indigo-100">Sign in to find the shared spaces and equipment that help your campus ideas get moving.</p>
        <div className="login-signature"><span>✦</span><small>Built around<br />your campus</small></div>
      </section>
      <form action={action} className="login-form" aria-busy={pending}>
        <div><p className="eyebrow">WELCOME BACK</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Sign in</h2><p className="mt-2 text-sm text-slate-500">Use your campus account to continue.</p></div>
        <label className="field-label">College email<input name="email" type="email" required autoComplete="email" className="input mt-2" placeholder="you@campus.edu" /></label>
        <label className="field-label">Password<input name="password" type="password" required autoComplete="current-password" className="input mt-2" placeholder="Enter your password" /></label>
        <p className="-mt-3 text-right text-sm"><Link href="/forgot-password" className="font-medium text-teal-700 underline underline-offset-4">Forgot password?</Link></p>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Continue to CampusShare →"}</button>
        <p className="text-center text-sm text-slate-600">New to CampusShare? <Link href="/signup" className="font-semibold text-teal-700 underline underline-offset-4">Create an account</Link></p>
        <p className="text-center text-xs text-slate-500">Your campus resources are one sign-in away.</p>
      </form>
    </div>);
}
