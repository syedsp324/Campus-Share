"use client";
import { useActionState } from "react";
import { signInAction } from "../form-actions";
export default function Login() {
  const [err, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="card mx-auto max-w-sm space-y-3" aria-busy={pending}>
      <h1 className="text-xl font-bold">Sign in to CampusShare</h1>
      <label className="block text-sm">College email<input name="email" type="email" required autoComplete="email" className="input mt-1" /></label>
      <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="input mt-1" /></label>
      {err && <p role="alert" className="text-sm text-red-700">✖ {err}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>);
}
