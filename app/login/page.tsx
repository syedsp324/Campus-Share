"use client";
import { useActionState } from "react";
import { useState } from "react";
import Link from "next/link";
import { signInAction } from "../form-actions";

const demoAccounts = {
  user: { email: "demo.student@campusshare.test", password: "TestPass1" },
  owner: { email: "demo.owner@campusshare.test", password: "TestPass2" },
} as const;

export default function Login() {
  const [err, action, pending] = useActionState(signInAction, null);
  const [accountType, setAccountType] = useState<keyof typeof demoAccounts>("user");
  const [email, setEmail] = useState<string>(demoAccounts.user.email);
  const [password, setPassword] = useState<string>(demoAccounts.user.password);

  function selectAccount(type: keyof typeof demoAccounts) {
    setAccountType(type);
    setEmail(demoAccounts[type].email);
    setPassword(demoAccounts[type].password);
  }

  return (
    <div className="login-layout">
      <section className="login-story">
        <p className="eyebrow text-indigo-200">CAMPUSSHARE</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">More access.<br />More possibilities.</h1>
        <p className="mt-4 max-w-sm text-sm leading-6 text-indigo-100">Sign in to find the shared spaces and equipment that help your campus ideas get moving.</p>
        <div className="login-signature"><span>✦</span><small>Built around<br />your campus</small></div>
      </section>
      <form action={action} className="login-form" aria-busy={pending}>
        <div><p className="eyebrow">WELCOME BACK</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Sign in</h2><p className="mt-2 text-sm text-slate-500">Choose your account type to fill in the shared demo credentials.</p></div>
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Demo account type">
          <button id="user-tab" type="button" role="tab" aria-selected={accountType === "user"} aria-controls="signin-panel" onClick={() => selectAccount("user")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${accountType === "user" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>User</button>
          <button id="owner-tab" type="button" role="tab" aria-selected={accountType === "owner"} aria-controls="signin-panel" onClick={() => selectAccount("owner")} className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${accountType === "owner" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>Owner</button>
        </div>
        <div id="signin-panel" role="tabpanel" aria-labelledby={`${accountType}-tab`} className="grid gap-4">
          <label className="field-label">College email<input name="email" type="email" required autoComplete="username" className="input mt-2" placeholder="you@campus.edu" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field-label">Password<input name="password" type="password" required autoComplete="current-password" className="input mt-2" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        </div>
        <p className="-mt-3 text-right text-sm"><Link href="/forgot-password" className="font-medium text-teal-700 underline underline-offset-4">Forgot password?</Link></p>
        {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Continue to CampusShare →"}</button>
        <p className="text-center text-xs text-slate-500">Shared demo credentials are for hackathon evaluation.</p>
      </form>
    </div>);
}
